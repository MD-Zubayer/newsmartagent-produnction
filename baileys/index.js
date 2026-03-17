const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    jidNormalizedUser 
} = require('@whiskeysockets/baileys');

// Baileys 6.x+ এ makeInMemoryStore এই পাথ থেকে নিতে হয়:
const makeInMemoryStore = require('@whiskeysockets/baileys/lib/Store').makeInMemoryStore;

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
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

// ─── FORWARD MESSAGE TO N8N ───────────────────────────────────────────────────
async function forwardToN8n(payload) {
  if (!N8N_WEBHOOK_URL) {
    logger.warn('N8N_WEBHOOK_URL not set, skipping forward');
    return;
  }
  try {
    const res = await axios.post(N8N_WEBHOOK_URL, payload);
    logger.info({ status: res.status }, 'Forwarded to n8n');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to forward to n8n');
  }
}

// ─── CONNECT TO WHATSAPP ──────────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  logger.info({ version }, 'Starting WhatsApp connection...');

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, 
    auth: state,
    browser: ['NewsSmartAgent', 'Chrome', '120.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  // Store bind করা
  if (store && store.bind) {
      store.bind(sock.ev);
  }

  // ── Connection Update ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = qr;
      connectionState = 'connecting';
      logger.info('QR code generated - scan with WhatsApp');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      connectionState = 'close';
      connectedPhone = null;
      qrCodeData = null;

      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.info({ statusCode, shouldReconnect }, 'Connection closed');

      if (shouldReconnect) {
        logger.info('Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
      } else {
        logger.warn('Logged out! Delete auth folder and restart to re-scan QR.');
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

  // ── Incoming Messages ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const from = msg.key.remoteJid;
      const isGroup = from?.endsWith('@g.us');
      if (isGroup) continue;

      const messageContent =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

      if (!messageContent) continue;

      const payload = {
        from: from,
        phone: from.replace('@s.whatsapp.net', ''),
        message: messageContent,
        messageId: msg.key.id,
        timestamp: msg.messageTimestamp,
        pushName: msg.pushName || '',
        isGroup: isGroup,
      };

      logger.info({ from, message: messageContent }, '📨 Incoming message');
      await forwardToN8n(payload);
    }
  });
}

// ─── EXPRESS REST API ─────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

function requireAuth(req, res, next) {
  const secret = req.headers['x-api-secret'] || req.query.secret;
  if (secret !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/status', (req, res) => {
  res.json({
    status: connectionState,
    phone: connectedPhone,
    hasQR: !!qrCodeData,
  });
});

app.get('/qr', (req, res) => {
  if (connectionState === 'open') {
    return res.json({ status: 'already_connected', phone: connectedPhone });
  }
  if (!qrCodeData) {
    return res.json({ status: 'waiting_for_qr' });
  }
  res.json({ status: 'qr_available', qr: qrCodeData });
});

app.post('/send-message', requireAuth, async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Required fields missing' });
  if (connectionState !== 'open') return res.status(503).json({ error: 'WhatsApp not connected' });

  try {
    let jid = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true, to: jid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Baileys REST API running on port ${PORT}`);
});

connectToWhatsApp();

process.on('SIGTERM', async () => {
  await sock?.end();
  process.exit(0);
});