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
const SYNC_CONTACT_URL = process.env.SYNC_CONTACT_URL || 'http://newsmartagent-django:8000/api/whatsapp/sync-contacts/';

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
const jidMap = new Map(); // Store LID -> Phone mappings
const messageQueues = new Map(); // Store message queues per session

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const delay = ms => new Promise(res => setTimeout(res, ms));

async function processQueue(sessionId) {
    const queueData = messageQueues.get(sessionId);
    if (!queueData || queueData.processing) return;

    queueData.processing = true;
    while (queueData.messages.length > 0) {
        const session = sessions.get(sessionId);
        if (!session || session.state !== 'open') {
            queueData.processing = false;
            return;
        }

        const { jid, message, buttons, listMessage, resolve, reject } = queueData.messages.shift();
        try {
            // "Fake Typing" behavior: send presence update first
            await session.sock.sendPresenceUpdate('composing', jid);

            // Random delay between 2-5 seconds
            const randomDelay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
            logger.info(`⏳ [Baileys] Typing for ${randomDelay}ms before sending to ${jid}`);
            await delay(randomDelay);

            let msgObj = { text: message };

            if (listMessage) {
                // Baileys-এ লিস্ট মেসেজ পাঠানোর সঠিক পদ্ধতি (To avoid .match() crash)
                msgObj = {
                    text: listMessage.description || message || "Please select an option",
                    footer: listMessage.footerText || "",
                    title: listMessage.title || "",
                    buttonText: listMessage.buttonText || "Select",
                    sections: listMessage.sections,
                    viewOnce: true
                };
            } else if (buttons && buttons.length > 0) {
                msgObj = {
                    text: message,
                    buttons: buttons,
                    headerType: 1,
                    viewOnce: true
                };
            }

            const sent = await session.sock.sendMessage(jid, msgObj);
            logger.info(`✅ [Baileys] Sent successfully to ${jid}`);
            resolve({ success: true, messageId: sent?.key?.id });
        } catch (err) {
            logger.error(`❌ [Baileys] Send FAILED to ${jid}: ${err.message}`);
            reject(err);
        }
    }
    queueData.processing = false;
}

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

async function notifyDjangoContactSync(sessionId, contacts) {
    try {
        await axios.post(SYNC_CONTACT_URL, {
            sessionId,
            contacts,
            secret: API_SECRET
        });
        logger.info(`Contact sync sent to Django for session: ${sessionId}`);
    } catch (err) {
        logger.error(`contact-sync notification failed: ${err.message}`);
    }
}

// ─── SESSION CORE ─────────────────────────────────────────────────────────────
async function initSession(sessionId, phoneNumber = null) {
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId);
        if (existing.state === 'open') return existing;
        if (existing.sock) {
            existing.sock.ev.removeAllListeners();
            existing.sock.logout().catch(() => { });
        }
    }

    const sessionData = {
        sessionId,
        sock: null,
        qr: null,
        pairingCode: null,
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
            syncFullHistory: true
        });

        sessionData.sock = sock;

        // --- PAIRING CODE LOGIC ---
        if (phoneNumber && !state.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    sessionData.pairingCode = code;
                    logger.info(`[Session: ${sessionId}] Pairing Code generated: ${code}`);
                } catch (err) {
                    logger.error(`[Session: ${sessionId}] Pairing Code failed: ${err.message}`);
                }
            }, 3000); // Wait for socket to be ready
        }

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
                    await cleanupSession(sessionId, { removeFolder: true });
                }
            }

            if (connection === 'open') {
                sessionData.state = 'open';
                sessionData.qr = null;
                sessionData.phone = jidNormalizedUser(sock.user?.id)?.split('@')[0];
                logger.info(`[Session: ${sessionId}] ✅ Connected as ${sessionData.phone}`);
                await notifyDjangoSync(sessionId, sessionData.phone, sock.user?.name || '');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // LID থেকে ফোন নম্বর ম্যাপিং হ্যান্ডলার
        sock.ev.on('contacts.upsert', (contacts) => {
            contacts.forEach(c => {
                if (c.id && c.id.includes('@lid')) {
                    jidMap.set(c.id, { lid: c.id, name: c.name || c.notify });
                }
            });
            notifyDjangoContactSync(sessionId, contacts);
        });

        sock.ev.on('contacts.update', (updates) => {
            updates.forEach(u => {
                if (u.id && (u.phoneNumber || u.id.includes('@s.whatsapp.net'))) {
                    const realPhone = u.phoneNumber || u.id.split('@')[0];
                    if (u.lid) jidMap.set(u.lid, { ...jidMap.get(u.lid), phone: realPhone });
                }
            });
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            for (const msg of messages) {
                if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

                const from = msg.key.remoteJid;
                const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
                if (!messageContent) continue;

                // LID হ্যান্ডলিং লজিক
                let resolvedPhone = from.split('@')[0];
                if (from.includes('@lid')) {
                    const mapped = jidMap.get(from);
                    if (mapped && mapped.phone) {
                        resolvedPhone = mapped.phone;
                    } else if (msg.key.participant) {
                        resolvedPhone = msg.key.participant.split('@')[0];
                    } else {
                        // Fallback: Use onWhatsApp to try and resolve the number
                        try {
                            const [result] = await sock.onWhatsApp(from);
                            if (result && result.exists) {
                                resolvedPhone = jidNormalizedUser(result.jid).split('@')[0];
                                jidMap.set(from, { ...mapped, phone: resolvedPhone });
                                logger.info(`🔍 [Baileys] Fallback resolved LID ${from} to phone ${resolvedPhone}`);
                            }
                        } catch (err) {
                            logger.warn(`⚠️ [Baileys] Failed to resolve LID ${from}: ${err.message}`);
                        }
                    }
                }

                const payload = {
                    from,
                    phone: resolvedPhone, // এটি n8n এ আসল নম্বর হিসেবে যাবে
                    raw_phone: from.split('@')[0],
                    receiver: sessionData.phone || sock.user?.id?.split(':')[0]?.split('@')[0],
                    sessionId: sessionId,
                    message: messageContent,
                    message_id: msg.key.id,
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
    if (cleanupPromises.has(sessionId)) return cleanupPromises.get(sessionId);
    const sessionFolder = path.join(AUTH_BASE_FOLDER, sessionId);
    const cleanup = (async () => {
        const existing = sessions.get(sessionId);
        if (existing?.sock) {
            try { await existing.sock.logout(); } catch (err) { }
        }
        if (removeFolder) {
            try { fs.rmSync(sessionFolder, { recursive: true, force: true }); } catch (err) { }
        }
        sessions.delete(sessionId);
        messageQueues.delete(sessionId);
        cleanupPromises.delete(sessionId);
    })();
    cleanupPromises.set(sessionId, cleanup);
    return cleanup;
}

// ─── EXPRESS API ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.post('/init/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { phone } = req.body; // Optional phone for pairing code
    try {
        await initSession(sessionId, phone);
        res.json({ success: true, message: 'Session initialization started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/status/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({
        state: session.state,
        phone: session.phone,
        qr: session.qr,
        pairingCode: session.pairingCode
    });
});

app.get('/qr/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ qr: session.qr });
});

app.post('/send-message', async (req, res) => {
    const { sessionId, to, message, text, buttons, interactiveButtons, listMessage } = req.body;
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) return res.status(401).send('Unauthorized');

    const session = sessions.get(sessionId);
    if (!session || session.state !== 'open') {
        return res.status(503).json({ error: 'WhatsApp session not connected' });
    }

    if (!messageQueues.has(sessionId)) {
        messageQueues.set(sessionId, { messages: [], processing: false });
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const queueData = messageQueues.get(sessionId);

    // Final merge of aliases
    const finalMessage = message || text || "";
    const finalButtons = buttons || interactiveButtons || [];

    // Return promise after queuing
    const sendPromise = new Promise((resolve, reject) => {
        queueData.messages.push({ jid, message: finalMessage, buttons: finalButtons, listMessage, resolve, reject });
    });

    processQueue(sessionId).catch(err => logger.error(`Queue error: ${err.message}`));

    // Option: Return immediately to acknowledge receipt, or wait for the promise.
    // Given the request for rate limiting, it's better to return immediately to the caller
    // but here we wait for the result to keep the API response consistent for now.
    // However, if the queue gets long, this might timeout.
    // Let's return the message as "Queued" if the queue is not empty.

    if (queueData.messages.length > 1) {
        res.json({ success: true, status: 'queued', queueLength: queueData.messages.length });
    } else {
        try {
            const result = await sendPromise;
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    await cleanupSession(sessionId);
    res.json({ success: true });
});

async function restoreSessions() {
    if (!fs.existsSync(AUTH_BASE_FOLDER)) return;
    const folders = fs.readdirSync(AUTH_BASE_FOLDER);
    for (const sessionId of folders) {
        if (fs.statSync(path.join(AUTH_BASE_FOLDER, sessionId)).isDirectory()) {
            logger.info(`Restoring: ${sessionId}`);
            initSession(sessionId).catch(() => { });
        }
    }
}

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    restoreSessions();
});