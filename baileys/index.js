import pkg from '@whiskeysockets/baileys';
const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  makeInMemoryStore, 
  jidNormalizedUser 
} = pkg;
import { Boom } from '@hapi/boom';
import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const API_SECRET = process.env.BAILEYS_API_SECRET || 'changeme123';
const AUTH_FOLDER = './auth_info_baileys';

// ─── LOGGER (পিনো - কম verbose) ──────────────────────────────────────────────
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
let connectionState = 'close'; // 'open' | 'connecting' | 'close'
let connectedPhone = null;

// ─── IN-MEMORY STORE (message history) ───────────────────────────────────────
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

// ─── FORWARD MESSAGE TO N8N ───────────────────────────────────────────────────
async function forwardToN8n(payload) {
  if (!N8N_WEBHOOK_URL) {
    logger.warn('N8N_WEBHOOK_URL not set, skipping forward');
    return;
  }
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    logger.info({ status: res.status }, 'Forwarded to n8n');
  } catch (err) {
    logger.error({ err }, 'Failed to forward to n8n');
  }
}

// ─── CONNECT TO WHATSAPP ──────────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  logger.info({ version }, 'Using Baileys version');

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }), // Baileys internal log silent
    printQRInTerminal: false, // আমরা নিজে handle করবো
    auth: state,
    browser: ['NewsSmartAgent', 'Chrome', '120.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
  });

  store.bind(sock.ev);

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

  // ── Save Credentials ──
  sock.ev.on('creds.update', saveCreds);

  // ── Incoming Messages ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // নিজের পাঠানো বা status update skip করুন
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const from = msg.key.remoteJid;
      const isGroup = from?.endsWith('@g.us');

      // Group message হলে ignore (প্রয়োজনে এটি সরাতে পারেন)
      if (isGroup) {
        logger.debug({ from }, 'Group message ignored');
        continue;
      }

      // Message content বের করুন
      const messageContent =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

      if (!messageContent) {
        logger.debug({ from }, 'Non-text message, skipping');
        continue;
      }

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

      // n8n-এ forward করুন
      await forwardToN8n(payload);
    }
  });
}

// ─── EXPRESS REST API ─────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Simple API key middleware
function requireAuth(req, res, next) {
  const secret = req.headers['x-api-secret'] || req.query.secret;
  if (secret !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── GET /status - Connection Status ──
app.get('/status', (req, res) => {
  res.json({
    status: connectionState,
    phone: connectedPhone,
    hasQR: !!qrCodeData,
  });
});

// ── GET /qr - Current QR Code (text format) ──
app.get('/qr', (req, res) => {
  if (connectionState === 'open') {
    return res.json({ status: 'already_connected', phone: connectedPhone });
  }
  if (!qrCodeData) {
    return res.json({ status: 'waiting_for_qr', message: 'QR not generated yet, try again in a few seconds' });
  }
  res.json({ status: 'qr_available', qr: qrCodeData });
});

// ── POST /send-message - Send WhatsApp Message (called by n8n) ──
app.post('/send-message', requireAuth, async (req, res) => {
  const { to, message, type = 'text' } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: '`to` and `message` are required' });
  }

  if (connectionState !== 'open') {
    return res.status(503).json({
      error: 'WhatsApp not connected',
      status: connectionState,
    });
  }

  try {
    // phone number normalize করুন
    let jid = to;
    if (!to.includes('@')) {
      // শুধু number দিলে auto-format করুন
      const cleaned = to.replace(/[^0-9]/g, '');
      jid = `${cleaned}@s.whatsapp.net`;
    }

    await sock.sendMessage(jid, { text: message });

    logger.info({ to: jid, message }, '✅ Message sent');
    res.json({ success: true, to: jid, message });
  } catch (err) {
    logger.error({ err }, 'Failed to send message');
    res.status(500).json({ error: err.message });
  }
});

// ── POST /logout - Logout from WhatsApp ──
app.post('/logout', requireAuth, async (req, res) => {
  try {
    await sock?.logout();
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Baileys REST API running on port ${PORT}`);
});

// ─── START WHATSAPP ───────────────────────────────────────────────────────────
connectToWhatsApp();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing...');
  await sock?.end();
  process.exit(0);
});
