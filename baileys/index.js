const Baileys = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// ─── DEBUG DIAGNOSTICS ────────────────────────────────────────────────────────
console.log('--- Baileys Module Diagnostic ---');
console.log('Baileys type:', typeof Baileys);
console.log('Baileys keys:', Object.keys(Baileys));
if (Baileys.default) {
    console.log('Baileys.default keys:', Object.keys(Baileys.default));
}
console.log('-------------------------------');

// ─── ROBUST IMPORT LOGIC ─────────────────────────────────────────────────────
const getFromBaileys = (prop) => {
    if (Baileys[prop]) return Baileys[prop];
    if (Baileys.default && Baileys.default[prop]) return Baileys.default[prop];
    return null;
};

const makeWASocket = Baileys.default?.default || Baileys.default || Baileys;
const DisconnectReason = getFromBaileys('DisconnectReason');
const useMultiFileAuthState = getFromBaileys('useMultiFileAuthState');
const fetchLatestBaileysVersion = getFromBaileys('fetchLatestBaileysVersion');
const makeInMemoryStore = getFromBaileys('makeInMemoryStore');
const jidNormalizedUser = getFromBaileys('jidNormalizedUser');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const API_SECRET = process.env.BAILEYS_API_SECRET || 'changeme123';
const AUTH_FOLDER = './auth_info_baileys';

// ─── LOGGER (সিম্পল পিনো লগার - ট্রান্সপোর্ট এরর এড়াতে) ────────────────────────
const logger = pino({ name: 'baileys-service', level: 'info' });

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
let sock = null;
let qrCodeData = null;
let connectionState = 'close';
let connectedPhone = null;

// ─── IN-MEMORY STORE ─────────────────────────────────────────────────────────
let store = null;
if (typeof makeInMemoryStore === 'function') {
    store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });
} else {
    console.error('CRITICAL: makeInMemoryStore is NOT a function! Value:', typeof makeInMemoryStore);
}

// ─── FORWARD MESSAGE TO N8N ───────────────────────────────────────────────────
async function forwardToN8n(payload) {
  if (!N8N_WEBHOOK_URL) return;
  try {
    await axios.post(N8N_WEBHOOK_URL, payload);
    logger.info('Forwarded to n8n');
  } catch (err) {
    logger.error('n8n forward failed: ' + err.message);
  }
}

// ─── CONNECT TO WHATSAPP ──────────────────────────────────────────────────────
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    logger.info(`Connecting with Baileys v${version}...`);

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['NewsSmartAgent', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    if (store) store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeData = qr;
        connectionState = 'connecting';
        logger.info('Scan QR Code now:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        connectionState = 'close';
        connectedPhone = null;
        qrCodeData = null;
        const statusCode = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
        logger.info(`Connection closed (Status: ${statusCode})`);
        if (statusCode !== DisconnectReason.loggedOut) {
          logger.info('Attempting to reconnect...');
          setTimeout(connectToWhatsApp, 5000);
        }
      }

      if (connection === 'open') {
        connectionState = 'open';
        qrCodeData = null;
        connectedPhone = jidNormalizedUser(sock.user?.id);
        logger.info(`✅ WhatsApp connected as ${connectedPhone}`);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;
        
        const from = msg.key.remoteJid;
        const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

        if (!messageContent) continue;

        const payload = {
          from,
          phone: from.replace('@s.whatsapp.net', ''),
          message: messageContent,
          pushName: msg.pushName || ''
        };

        logger.info(`Incoming message from ${from}`);
        await forwardToN8n(payload);
      }
    });
  } catch (err) {
      logger.error('Connection logic failed: ' + err.message);
      setTimeout(connectToWhatsApp, 10000);
  }
}

// ─── EXPRESS API ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/status', (req, res) => res.json({ status: connectionState, phone: connectedPhone }));
app.get('/qr', (req, res) => res.json({ qr: qrCodeData }));

app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;
  const secret = req.headers['x-api-secret'];
  if (secret !== API_SECRET) return res.status(401).send('Unauthorized');

  if (connectionState !== 'open') return res.status(503).json({ error: 'WhatsApp not connected' });

  try {
    let jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => logger.info(`Baileys API on port ${PORT}`));
connectToWhatsApp();