const Baileys = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const SYNC_AGENT_URL = process.env.SYNC_AGENT_URL || 'http://newsmartagent-django:8000/api/whatsapp/sync-agent/';
const API_SECRET = process.env.BAILEYS_API_SECRET || 'nsa-baileys-secret-2024';
const AUTH_BASE_FOLDER = './auth_info_baileys';

// ─── LOGGER ───────────────────────────────────────────────────────────────────
const logger = pino({ name: 'baileys-multi-service', level: 'info' });

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
const jidNormalizedUser = getFromBaileys('jidNormalizedUser');

// ─── GLOBAL SESSION STATE ─────────────────────────────────────────────────────
const sessions = new Map();
const cleanupPromises = new Map();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function forwardToN8n(payload) {
    if (!N8N_WEBHOOK_URL) return;
    try {
        await axios.post(N8N_WEBHOOK_URL, payload);
    } catch (err) {
        logger.error(`n8n forward failed: ${err.message}`);
    }
}

async function notifyDjangoSync(sessionId, phone, pushName) {
    try {
        await axios.post(SYNC_AGENT_URL, {
            sessionId,
            phone,
            pushName,
            secret: API_SECRET
        });
        logger.info(`Sync notification sent to Django for session: ${sessionId}`);
    } catch (err) {
        logger.error(`sync-agent notification failed: ${err.message}`);
    }
}

// ─── SESSION CORE ─────────────────────────────────────────────────────────────
async function initSession(sessionId) {
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId);
        if (existing.state === 'open') return existing;
        // If closed or error, we might want to reinitting
        if (existing.sock) existing.sock.logout().catch(() => {});
    }

    const sessionData = {
        sessionId,
        sock: null,
        qr: null,
        state: 'close',
        phone: null
    };
    sessions.set(sessionId, sessionData);

    try {
        const sessionFolder = path.join(AUTH_BASE_FOLDER, sessionId);
        if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['NewsSmartAgent', 'Chrome', '120.0.0'],
            syncFullHistory: false
        });

        sessionData.sock = sock;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                sessionData.qr = qr;
                sessionData.state = 'connecting';
                logger.info(`[Session: ${sessionId}] QR generated`);
            }

            if (connection === 'close') {
                sessionData.state = 'close';
                sessionData.qr = null;
                sessionData.phone = null;
                const statusCode = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
                
                logger.info(`[Session: ${sessionId}] Closed (${statusCode})`);
                
                if (statusCode !== DisconnectReason.loggedOut) {
                    setTimeout(() => initSession(sessionId), 5000);
                } else {
                    // Logged out, clean up
                    await cleanupSession(sessionId, { removeFolder: true });
                }
            }

            if (connection === 'open') {
                sessionData.state = 'open';
                sessionData.qr = null;
                sessionData.phone = jidNormalizedUser(sock.user?.id)?.split('@')[0];
                logger.info(`[Session: ${sessionId}] ✅ Connected as ${sessionData.phone}`);

                // Notify Django to sync AgentAI
                await notifyDjangoSync(sessionId, sessionData.phone, sock.user?.name || '');
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
                    phone: from.split('@')[0],
                    receiver: sessionData.phone || sock.user?.id?.split(':')[0]?.split('@')[0],
                    sessionId: sessionId,
                    message: messageContent,
                    pushName: msg.pushName || ''
                };
                await forwardToN8n(payload);
            }
        });

        return sessionData;
    } catch (err) {
        logger.error(`[Session: ${sessionId}] Initialization failed: ${err.message}`);
        sessions.delete(sessionId);
        throw err;
    }
}

async function cleanupSession(sessionId, { removeFolder = true } = {}) {
    if (cleanupPromises.has(sessionId)) {
        return cleanupPromises.get(sessionId);
    }

    const sessionFolder = path.join(AUTH_BASE_FOLDER, sessionId);
    const cleanup = (async () => {
        const existing = sessions.get(sessionId);
        if (existing?.sock) {
            try {
                await existing.sock.logout();
            } catch (err) {
                logger.warn(`[Session: ${sessionId}] logout during cleanup failed: ${err.message}`);
            }
        }

        if (removeFolder) {
            try {
                fs.rmSync(sessionFolder, { recursive: true, force: true });
            } catch (err) {
                logger.warn(`[Session: ${sessionId}] auth folder cleanup failed: ${err.message}`);
            }
        }

        sessions.delete(sessionId);
        cleanupPromises.delete(sessionId);
    })();

    cleanupPromises.set(sessionId, cleanup);
    return cleanup;
}

// ─── EXPRESS API ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Init a session (called by Dashboard)
app.post('/init/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        await initSession(sessionId);
        res.json({ success: true, message: 'Session initialization started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/status/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ state: session.state, phone: session.phone });
});

app.get('/qr/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ qr: session.qr });
});

app.post('/send-message', async (req, res) => {
    const { sessionId, to, message } = req.body;
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) return res.status(401).send('Unauthorized');

    const session = sessions.get(sessionId);
    if (!session || session.state !== 'open') {
        return res.status(503).json({ error: 'WhatsApp session not connected' });
    }

    try {
        let jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        await session.sock.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });

    const existed = sessions.has(sessionId) || fs.existsSync(path.join(AUTH_BASE_FOLDER, sessionId));

    try {
        await cleanupSession(sessionId);
        res.json({ success: true, existed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto-restart existing sessions on startup
async function restoreSessions() {
    if (!fs.existsSync(AUTH_BASE_FOLDER)) return;
    const folders = fs.readdirSync(AUTH_BASE_FOLDER);
    for (const sessionId of folders) {
        if (fs.statSync(path.join(AUTH_BASE_FOLDER, sessionId)).isDirectory()) {
            logger.info(`Restoring session: ${sessionId}`);
            initSession(sessionId).catch(e => logger.error(`Failed to restore ${sessionId}: ${e.message}`));
        }
    }
}

app.listen(PORT, () => {
    logger.info(`Baileys Multi-Session API on port ${PORT}`);
    restoreSessions();
});
