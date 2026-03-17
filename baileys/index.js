const Baileys = require('@whiskeysockets/baileys');

// মেইন অবজেক্ট থেকে প্রয়োজনীয় ফাংশনগুলো বের করা হচ্ছে
const makeWASocket = Baileys.default || Baileys;
const { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeInMemoryStore, // ৬.৭.৯ ভার্সনে এটি এখানেই থাকে
    jidNormalizedUser 
} = Baileys;

const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { writeFileSync } = require('fs');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const API_SECRET = process.env.BAILEYS_API_SECRET || 'changeme123';
const AUTH_FOLDER = './auth_info_baileys';

// ─── LOGGER ───────────────────────────────────────────────────────────────────
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
}).child({ module: 'baileys' });

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
let sock = null;
let qrCodeData = null;
let connectionState = 'close';
let connectedPhone = null;

// ─── IN-MEMORY STORE ─────────────────────────────────────────────────────────
// এখানে makeInMemoryStore এখন সঠিকভাবে ফাংশন হিসেবে কাজ করবে
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

// ─── FORWARD MESSAGE TO N8N ───────────────────────────────────────────────────
async function forwardToN8n(payload) {
  if (!N8N_WEBHOOK_URL) return;
  try {
    await axios.post(N8N_WEBHOOK_URL, payload);
    logger.info('Forwarded to n8n');
  } catch (err) {
    logger.error({ err: err.message }, 'n8n forward failed');
  }
}

// ─── CONNECT TO WHATSAPP ──────────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  logger.info({ version }, 'Connecting...');

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

  sock.ev.on('connection.update', async (update) => {
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
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(connectToWhatsApp, 5000);
      }
    }

    if (connection === 'open') {
      connectionState = 'open';
      qrCodeData = null;
      connectedPhone = jidNormalizedUser(sock.user?.id);
      logger.info({ phone: connectedPhone }, '✅ WhatsApp connected!');
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

      logger.info({ from, message: messageContent }, 'Incoming message');
      await forwardToN8n(payload);
    }
  });
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