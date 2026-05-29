const Baileys = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || process.env.N8N_WHATSAPP_WEBHOOK_URL || '';
const N8N_WEBHOOK_INTERNAL_URL = process.env.N8N_WEBHOOK_INTERNAL_URL || 'http://n8n:5678';
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

        const { jid, message, buttons, listMessage, type, media_url, resolve, reject } = queueData.messages.shift();
        try {
            // Resolve LID to actual phone number if necessary
            let resolvedJid = jid;
            if (jid.includes('@lid')) {
                const lidMapping = jidMap.get(jid);
                if (lidMapping && lidMapping.phone) {
                    resolvedJid = `${lidMapping.phone}@s.whatsapp.net`;
                    logger.info(`🔍 [Baileys] Resolved LID ${jid} to phone: ${resolvedJid}`);
                } else {
                    logger.warn(`⚠️ [Baileys] LID ${jid} not resolved, trying to send anyway`);
                }
            }

            // "Fake Typing" behavior: send presence update first
            await session.sock.sendPresenceUpdate('composing', resolvedJid);

            // Random delay between 2-5 seconds
            const randomDelay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
            logger.info(`⏳ [Baileys] Typing for ${randomDelay}ms before sending to ${resolvedJid}`);
            await delay(randomDelay);

            let msgObj = { text: message };

            if (type === 'audio' && media_url) {
                // Audio message - download from URL and convert to buffer
                logger.info(`📻 [Baileys] Preparing audio message. Downloading from: ${media_url.substring(0, 80)}`);
                try {
                    const audioResponse = await axios.get(media_url, { responseType: 'arraybuffer', timeout: 15000 });
                    const audioBuffer = Buffer.from(audioResponse.data);
                    logger.info(`📻 [Baileys] Audio downloaded. Buffer size: ${audioBuffer.length} bytes`);
                    
                    msgObj = {
                        audio: audioBuffer,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true,
                        caption: message || undefined
                    };
                    logger.info(`📻 [Baileys] Audio buffer prepared for sending. mimetype=audio/ogg; codecs=opus, ptt=true, size=${audioBuffer.length}`);
                } catch (downloadErr) {
                    logger.error(`❌ [Baileys] Failed to download audio from ${media_url}: ${downloadErr.message}`);
                    msgObj = { text: `[Audio failed to download: ${downloadErr.message}]` };
                }
            } else if (listMessage) {
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
            logger.info(`✅ [Baileys] Sent successfully to ${jid}. MessageId: ${sent?.key?.id}`);
            logger.debug(`📝 [Baileys] Full message object sent: ${JSON.stringify(msgObj).substring(0, 300)}`);
            logger.debug(`📝 [Baileys] Send response: ${JSON.stringify(sent).substring(0, 300)}`);
            resolve({ success: true, messageId: sent?.key?.id });
        } catch (err) {
            logger.error(`❌ [Baileys] Send FAILED to ${jid}: ${err.message}`);
            reject(err);
        }
    }
    queueData.processing = false;
}

async function forwardToN8n(payload) {
    const webhookUrl = N8N_WEBHOOK_URL || `${N8N_WEBHOOK_INTERNAL_URL}/webhook/whatsapp-incoming`;
    if (!webhookUrl) {
        logger.warn(`⚠️ [Baileys→N8N] No N8N webhook configured, skipping forward`);
        return;
    }

    const tryPost = async (url) => {
        logger.info(`📤 [Baileys→N8N] Forwarding message from ${payload.phone} to ${url}: "${payload.message.substring(0, 50)}..."`);
        logger.debug(`📦 [Baileys→N8N] Payload: ${JSON.stringify(payload)}`);
        return axios.post(url, payload, { timeout: 10000 });
    };

    try {
        const response = await tryPost(webhookUrl);
        logger.info(`✅ [Baileys→N8N] Message forwarded successfully. Status: ${response.status}`);
        logger.debug(`📄 [Baileys→N8N] Response: ${JSON.stringify(response.data).substring(0, 200)}`);
        return;
    } catch (err) {
        logger.error(`❌ [Baileys→N8N] Primary webhook forward failed: ${err.message}`);
        logger.error(`   URL: ${webhookUrl}`);
        logger.error(`   Error Code: ${err.code || err.response?.status}`);
        logger.error(`   Detail: ${err.response?.data ? JSON.stringify(err.response.data) : err.stack}`);

        // Fallback to internal Docker n8n if the external URL is unreachable or not matching
        const internalUrl = `${N8N_WEBHOOK_INTERNAL_URL}/webhook/whatsapp-incoming`;
        if (internalUrl !== webhookUrl) {
            try {
                logger.info(`🔁 [Baileys→N8N] Trying internal fallback URL: ${internalUrl}`);
                const response = await tryPost(internalUrl);
                logger.info(`✅ [Baileys→N8N] Internal fallback forwarded successfully. Status: ${response.status}`);
                logger.debug(`📄 [Baileys→N8N] Internal response: ${JSON.stringify(response.data).substring(0, 200)}`);
                return;
            } catch (fallbackErr) {
                logger.error(`❌ [Baileys→N8N] Internal webhook fallback failed: ${fallbackErr.message}`);
                logger.error(`   URL: ${internalUrl}`);
                logger.error(`   Error Code: ${fallbackErr.code || fallbackErr.response?.status}`);
                logger.error(`   Detail: ${fallbackErr.response?.data ? JSON.stringify(fallbackErr.response.data) : fallbackErr.stack}`);
            }
        }
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
                logger.info(`📨 [Baileys] Message event received. From: ${msg.key.remoteJid}, fromMe: ${msg.key.fromMe}`);
                
                if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') {
                    logger.debug(`↩️  [Baileys] Skipping own message or status broadcast`);
                    continue;
                }

                const from = msg.key.remoteJid;
                const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
                
                if (!messageContent) {
                    logger.warn(`⚠️  [Baileys] Message has no text content. Type: ${Object.keys(msg.message || {})[0]}`);
                    continue;
                }

                logger.info(`💬 [Baileys] Text message from ${from}: "${messageContent.substring(0, 60)}..."`);

                // LID হ্যান্ডলিং লজিক
                let resolvedPhone = from.split('@')[0];
                if (from.includes('@lid')) {
                    logger.info(`🔍 [Baileys] LID detected: ${from}, attempting resolution...`);
                    const mapped = jidMap.get(from);
                    if (mapped && mapped.phone) {
                        resolvedPhone = mapped.phone;
                        logger.info(`✅ [Baileys] LID resolved from cache to: ${resolvedPhone}`);
                    } else if (msg.key.participant) {
                        resolvedPhone = msg.key.participant.split('@')[0];
                        logger.info(`✅ [Baileys] LID resolved from participant to: ${resolvedPhone}`);
                    } else {
                        // Fallback: Use onWhatsApp to try and resolve the number
                        try {
                            const [result] = await sock.onWhatsApp(from);
                            if (result && result.exists) {
                                resolvedPhone = jidNormalizedUser(result.jid).split('@')[0];
                                jidMap.set(from, { ...mapped, phone: resolvedPhone });
                                logger.info(`✅ [Baileys] LID resolved via onWhatsApp to: ${resolvedPhone}`);
                            }
                        } catch (err) {
                            logger.warn(`⚠️  [Baileys] Failed to resolve LID ${from}: ${err.message}`);
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
                
                logger.info(`📤 [Baileys] Attempting to forward message from ${resolvedPhone}...`);
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
    const { sessionId, to, message, text, buttons, interactiveButtons, listMessage, type, media_url } = req.body;
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) {
        logger.warn(`🔑 [HTTP] Unauthorized /send-message attempt. sessionId=${sessionId}, to=${to}`);
        return res.status(401).send('Unauthorized');
    }

    const finalMessage = message || text || "";
    const finalButtons = buttons || interactiveButtons || [];
    const msgType = type || 'text';
    logger.info(`📥 [HTTP] /send-message request. sessionId=${sessionId}, to=${to}, type=${msgType}, message="${finalMessage.substring(0,120)}", media_url=${media_url ? media_url.substring(0,80) : 'none'}, buttons=${finalButtons.length}, listMessage=${listMessage ? 'yes' : 'no'}`);
    logger.debug(`📦 [HTTP] Full body: ${JSON.stringify(req.body)}`);

    const session = sessions.get(sessionId);
    const sessionState = session ? session.state : 'missing';
    logger.info(`📍 [Session] sessionId=${sessionId}, currentState=${sessionState}`);

    if (!session || session.state !== 'open') {
        logger.warn(`⭕ [Session] send-message blocked. sessionId=${sessionId}, state=${sessionState}`);
        return res.status(503).json({ error: 'WhatsApp session not connected' });
    }

    if (!messageQueues.has(sessionId)) {
        messageQueues.set(sessionId, { messages: [], processing: false });
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const queueData = messageQueues.get(sessionId);

    const sendPromise = new Promise((resolve, reject) => {
        queueData.messages.push({ 
            jid, 
            message: finalMessage, 
            buttons: finalButtons, 
            listMessage,
            type: msgType,
            media_url: media_url,
            resolve, 
            reject 
        });
    });

    logger.info(`📬 [Queue] enqueue message for sessionId=${sessionId}, to=${jid}, type=${msgType}, media_url=${media_url ? media_url.substring(0,60) : 'none'}, queueLength=${queueData.messages.length}`);

    processQueue(sessionId).catch(err => logger.error(`Queue error: ${err.message}`));

    if (queueData.messages.length > 1) {
        res.json({ success: true, status: 'queued', queueLength: queueData.messages.length });
    } else {
        try {
            const result = await sendPromise;
            logger.info(`✅ [HTTP] /send-message delivered for sessionId=${sessionId}, to=${jid}`);
            res.json(result);
        } catch (err) {
            logger.error(`❌ [HTTP] /send-message failed for sessionId=${sessionId}, to=${jid}: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/profile/:sessionId/:jid', async (req, res) => {
    const { sessionId, jid } = req.params;
    const session = sessions.get(sessionId);
    if (!session || session.state !== 'open') {
        return res.status(503).json({ error: 'WhatsApp session not connected' });
    }

    try {
        const fullJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
        const url = await session.sock.profilePictureUrl(fullJid, 'image');
        res.json({ success: true, profilePictureUrl: url });
    } catch (err) {
        // If no profile pic, Baileys often throws 404/401
        res.status(404).json({ success: false, error: err.message });
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