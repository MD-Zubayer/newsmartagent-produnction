const Baileys = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const axios = require('axios');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || process.env.N8N_WHATSAPP_WEBHOOK_URL || '';
const N8N_WEBHOOK_INTERNAL_URL = process.env.N8N_WEBHOOK_INTERNAL_URL || 'http://n8n:5678';
const DJANGO_WHATSAPP_WEBHOOK_URL = process.env.DJANGO_WHATSAPP_WEBHOOK_URL || process.env.DJANGO_WHATSAPP_INCOMING_URL || '';
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
const qrRateLimiter = new Map(); // Track QR generation times per session to prevent rapid regeneration
const recentMessages = new Map(); // Cache recent incoming messages for media fallback

const MAX_QUEUE_LENGTH = parseInt(process.env.BAILEYS_MAX_QUEUE_LENGTH || '10000', 10);
const MAX_QUEUE_PER_SESSION = parseInt(process.env.BAILEYS_MAX_QUEUE_PER_SESSION || '3000', 10);
const MESSAGE_SEND_RETRY_ATTEMPTS = parseInt(process.env.BAILEYS_SEND_RETRY_ATTEMPTS || '2', 10);
const MESSAGE_SEND_RETRY_BASE_MS = parseInt(process.env.BAILEYS_SEND_RETRY_BASE_MS || '500', 10);
const MESSAGE_SEND_DELAY_MS = parseInt(process.env.BAILEYS_SEND_DELAY_MS || '0', 10);
const RECENT_MESSAGE_CACHE_LIMIT = parseInt(process.env.BAILEYS_RECENT_MESSAGE_CACHE_LIMIT || '2000', 10);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const delay = ms => new Promise(res => setTimeout(res, ms));

function getSessionQueue(sessionId) {
    if (!messageQueues.has(sessionId)) {
        messageQueues.set(sessionId, { messages: [], processing: false });
    }
    return messageQueues.get(sessionId);
}

async function sendMessageWithRetries(session, jid, msgObj) {
    let lastError = null;
    for (let attempt = 1; attempt <= MESSAGE_SEND_RETRY_ATTEMPTS; attempt += 1) {
        try {
            return await session.sock.sendMessage(jid, msgObj);
        } catch (err) {
            lastError = err;
            const errMsg = err?.message || 'unknown error';
            logger.warn(`⚠️ [Baileys] sendMessage attempt ${attempt}/${MESSAGE_SEND_RETRY_ATTEMPTS} failed for ${jid}: ${errMsg}`);
            if (attempt < MESSAGE_SEND_RETRY_ATTEMPTS) {
                const backoffMs = MESSAGE_SEND_RETRY_BASE_MS * Math.pow(2, attempt - 1);
                logger.info(`⏳ [Baileys] retrying message to ${jid} after ${backoffMs}ms`);
                await delay(backoffMs);
            }
        }
    }
    throw lastError;
}

async function processQueue(sessionId) {
    const queueData = messageQueues.get(sessionId);
    if (!queueData || queueData.processing) return;

    queueData.processing = true;
    try {
        while (queueData.messages.length > 0) {
            const session = sessions.get(sessionId);
            if (!session || session.state !== 'open') {
                return;
            }

            const { jid, message, buttons, listMessage, type, media_url, image_base64, resolve, reject } = queueData.messages.shift();
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

                if (MESSAGE_SEND_DELAY_MS > 0) {
                    logger.info(`⏳ [Baileys] waiting ${MESSAGE_SEND_DELAY_MS}ms before sending to ${resolvedJid}`);
                    await delay(MESSAGE_SEND_DELAY_MS);
                }

                let msgObj = { text: message };

                if (type === 'image_base64' && image_base64) {
                    // Handle base64 image (for invoice delivery)
                    logger.info(`🖼️ [Baileys] Preparing base64 image message. Size: ${image_base64.length / 1024 / 1024}MB`);
                    try {
                        const imageBuffer = Buffer.from(image_base64, 'base64');
                        msgObj = {
                            image: imageBuffer,
                            caption: message || 'Invoice'
                        };
                        logger.info(`🖼️ [Baileys] Base64 image converted to buffer (${imageBuffer.length} bytes) for sending`);
                    } catch (convertErr) {
                        logger.error(`❌ [Baileys] Failed to convert base64 image: ${convertErr.message}`);
                        msgObj = { text: `[Image failed to process: ${convertErr.message}]` };
                    }
                } else if (type === 'image' && media_url) {
                    logger.info(`🖼️ [Baileys] Preparing image message from URL: ${media_url.substring(0, 120)}`);
                    try {
                        const imageResponse = await axios.get(media_url, { responseType: 'arraybuffer', timeout: 20000 });
                        const imageBuffer = Buffer.from(imageResponse.data);
                        logger.info(`🖼️ [Baileys] Image downloaded. Buffer size: ${imageBuffer.length} bytes`);
                        
                        let resizedBuffer = imageBuffer;
                        try {
                            const image = await Jimp.read(imageBuffer);
                            const maxWidth = 1080;
                            const originalMime = image.getMIME();
                            if (image.bitmap.width > maxWidth) {
                                image.resize(maxWidth, Jimp.AUTO);
                            }

                            if (originalMime === Jimp.MIME_JPEG) {
                                image.quality(85);
                                resizedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
                            } else {
                                resizedBuffer = await image.getBufferAsync(originalMime);
                            }

                            logger.info(`🖼️ [Baileys] Image resized to ${image.bitmap.width}x${image.bitmap.height} and encoded as ${originalMime}. New size: ${resizedBuffer.length} bytes`);
                        } catch (resizeErr) {
                            logger.warn(`⚠️ [Baileys] Image resize failed, sending original image: ${resizeErr.message}`);
                        }

                        msgObj = {
                            image: resizedBuffer,
                            caption: message || ''
                        };
                        logger.info(`🖼️ [Baileys] Image message prepared for sending with caption: ${message ? message.substring(0, 120) : '<empty>'}`);
                    } catch (downloadErr) {
                        logger.error(`❌ [Baileys] Failed to download image from ${media_url}: ${downloadErr.message}`);
                        msgObj = { text: message || `[Image failed to download: ${downloadErr.message}]` };
                    }
                } else if (type === 'audio' && media_url) {
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

                const sent = await sendMessageWithRetries(session, resolvedJid, msgObj);
                logger.info(`✅ [Baileys] Sent successfully to ${resolvedJid}. MessageId: ${sent?.key?.id}`);
                logger.debug(`📝 [Baileys] Full message object sent: ${JSON.stringify(msgObj).substring(0, 300)}`);
                logger.debug(`📝 [Baileys] Send response: ${JSON.stringify(sent).substring(0, 300)}`);
                resolve({ success: true, messageId: sent?.key?.id });
            } catch (err) {
                logger.error(`❌ [Baileys] Send FAILED to ${jid}: ${err.message}`);
                reject(err);
            }
        }
    } catch (err) {
        logger.error(`❌ [Baileys] Queue processing failed for sessionId=${sessionId}: ${err.message}`);
    } finally {
        queueData.processing = false;
    }
}

async function forwardToN8n(payload) {
    const targetWebhook = DJANGO_WHATSAPP_WEBHOOK_URL || N8N_WEBHOOK_URL || `${N8N_WEBHOOK_INTERNAL_URL}/webhook/whatsapp-incoming`;
    if (!targetWebhook) {
        logger.warn(`⚠️ [Baileys→Ingress] No webhook configured, skipping forward`);
        return;
    }

    const tryPost = async (url) => {
        logger.info(`📤 [Baileys→Ingress] Forwarding message from ${payload.phone} to ${url}: "${payload.message.substring(0, 50)}..."`);
        logger.debug(`📦 [Baileys→Ingress] Payload: ${JSON.stringify(payload)}`);
        return axios.post(url, payload, { timeout: 15000 });
    };

    try {
        const response = await tryPost(targetWebhook);
        logger.info(`✅ [Baileys→Ingress] Message forwarded successfully. Status: ${response.status}`);
        logger.debug(`📄 [Baileys→Ingress] Response: ${JSON.stringify(response.data).substring(0, 200)}`);
        return;
    } catch (err) {
        logger.error(`❌ [Baileys→Ingress] Primary webhook forward failed: ${err.message}`);
        logger.error(`   URL: ${targetWebhook}`);
        logger.error(`   Error Code: ${err.code || err.response?.status}`);
        logger.error(`   Detail: ${err.response?.data ? JSON.stringify(err.response.data) : err.stack}`);

        if (targetWebhook !== N8N_WEBHOOK_URL && N8N_WEBHOOK_URL) {
            try {
                logger.info(`🔁 [Baileys→Ingress] Trying configured N8N webhook fallback: ${N8N_WEBHOOK_URL}`);
                const response = await tryPost(N8N_WEBHOOK_URL);
                logger.info(`✅ [Baileys→Ingress] N8N fallback forwarded successfully. Status: ${response.status}`);
                logger.debug(`📄 [Baileys→Ingress] N8N fallback response: ${JSON.stringify(response.data).substring(0, 200)}`);
                return;
            } catch (fallbackErr) {
                logger.error(`❌ [Baileys→Ingress] N8N fallback failed: ${fallbackErr.message}`);
                logger.error(`   URL: ${N8N_WEBHOOK_URL}`);
                logger.error(`   Error Code: ${fallbackErr.code || fallbackErr.response?.status}`);
                logger.error(`   Detail: ${fallbackErr.response?.data ? JSON.stringify(fallbackErr.response.data) : fallbackErr.stack}`);
            }
        }

        const internalUrl = `${N8N_WEBHOOK_INTERNAL_URL}/webhook/whatsapp-incoming`;
        if (internalUrl !== targetWebhook && internalUrl !== N8N_WEBHOOK_URL) {
            try {
                logger.info(`🔁 [Baileys→Ingress] Trying internal fallback URL: ${internalUrl}`);
                const response = await tryPost(internalUrl);
                logger.info(`✅ [Baileys→Ingress] Internal fallback forwarded successfully. Status: ${response.status}`);
                logger.debug(`📄 [Baileys→Ingress] Internal response: ${JSON.stringify(response.data).substring(0, 200)}`);
                return;
            } catch (fallbackErr) {
                logger.error(`❌ [Baileys→Ingress] Internal webhook fallback failed: ${fallbackErr.message}`);
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
        if (existing.state === 'open' || existing.state === 'connecting') {
            logger.info(`[Session: ${sessionId}] initSession called while already active (${existing.state}) - reusing existing session`);
            return existing;
        }
        if (existing.sock) {
            existing.sock.ev.removeAllListeners();
            try {
                await existing.sock.logout();
            } catch (err) {
                logger.warn(`[Session: ${sessionId}] previous socket logout failed: ${err.message}`);
            }
        }
    }

    const sessionData = {
        sessionId,
        sock: null,
        qr: null,
        pairingCode: null,
        state: 'close',
        phone: null,
        initializing: true
    };
    sessions.set(sessionId, sessionData);
    getSessionQueue(sessionId);

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
            const statusCode = lastDisconnect?.error ? (lastDisconnect.error.output?.statusCode || 0) : 0;
            const payload = { connection, statusCode, qr: !!qr, update };
            logger.info(`[Session: ${sessionId}] connection.update: ${JSON.stringify(payload)}`);

            if (qr) {
                sessionData.qr = qr;
                sessionData.state = 'connecting';
                logger.info(`[Session: ${sessionId}] QR generated`);
            }

            if (connection === 'connecting') {
                sessionData.state = 'connecting';
                logger.info(`[Session: ${sessionId}] connection is connecting`);
            }

            if (connection === 'open') {
                sessionData.state = 'open';
                sessionData.qr = null;
                sessionData.pairingCode = null;
                sessionData.initializing = false;
                sessionData.phone = jidNormalizedUser(sock.user?.id)?.split('@')[0];
                logger.info(`[Session: ${sessionId}] ✅ Connected as ${sessionData.phone}`);
                await notifyDjangoSync(sessionId, sessionData.phone, sock.user?.name || '');
                const queueData = getSessionQueue(sessionId);
                if (queueData.messages.length > 0) {
                    logger.info(`[Session: ${sessionId}] Resuming queued messages: ${queueData.messages.length}`);
                    processQueue(sessionId).catch(err => logger.error(`Queue resume error: ${err.message}`));
                }
                return;
            }

            if (connection === 'close') {
                sessionData.state = 'close';
                sessionData.qr = null;
                sessionData.pairingCode = null;
                sessionData.phone = null;
                const isLoggedOut = statusCode === DisconnectReason?.loggedOut;
                logger.info(`[Session: ${sessionId}] Closed (${statusCode}) loggedOut=${isLoggedOut}`);

                if (isLoggedOut) {
                    await cleanupSession(sessionId, { removeFolder: true });
                } else {
                    setTimeout(() => initSession(sessionId), 5000);
                }
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
                if (msg?.key?.id) {
                    recentMessages.set(msg.key.id, { sessionId, message: msg });
                    if (recentMessages.size > RECENT_MESSAGE_CACHE_LIMIT) {
                        recentMessages.delete(recentMessages.keys().next().value);
                    }
                }
                const messageType = Object.keys(msg.message || {})[0] || 'unknown';
                let messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
                let mediaPayload = {};

                // Helper function to decrypt media using Baileys
                const decryptMedia = async (messageObj, type) => {
                    try {
                        logger.info(`🔐 [Baileys] Decrypting ${type} media...`);
                        const mediaBuffer = await downloadMediaMessage(
                            messageObj,
                            'buffer',
                            {},
                            {
                                logger,
                                reuploadRequest: sock.updateMediaMessage
                            }
                        );
                        if (!mediaBuffer || mediaBuffer.length === 0) {
                            logger.warn(`⚠️  [Baileys] Media decryption returned empty buffer for ${type}`);
                            return null;
                        }
                        const mediaBase64 = Buffer.from(mediaBuffer).toString('base64');
                        logger.info(`✅ [Baileys] ${type} decrypted successfully. Buffer size: ${mediaBuffer.length} bytes, Base64 length: ${mediaBase64.length}`);
                        return mediaBase64;
                    } catch (decryptErr) {
                        logger.error(`❌ [Baileys] Media decryption failed for ${type}: ${decryptErr.message}`);
                        return null;
                    }
                };

                if (messageType === 'imageMessage') {
                    const imageBase64 = await decryptMedia(msg, 'image');
                    mediaPayload = {
                        message_type: 'image',
                        mimetype: msg.message.imageMessage?.mimetype || 'image/jpeg',
                        caption: msg.message.imageMessage?.caption || null,
                        image_base64: imageBase64,
                        media_url: null,
                        mediaUrl: null
                    };
                    if (!messageContent) {
                        messageContent = msg.message.imageMessage?.caption || '[Image received]';
                    }
                    logger.info(`📸 [Baileys] Image decrypted: ${imageBase64 ? imageBase64.substring(0, 50) : 'FAILED'}`);
                } else if (messageType === 'videoMessage') {
                    const videoBase64 = await decryptMedia(msg, 'video');
                    mediaPayload = {
                        message_type: 'video',
                        mimetype: msg.message.videoMessage?.mimetype || 'video/mp4',
                        caption: msg.message.videoMessage?.caption || null,
                        video_base64: videoBase64,
                        media_url: null,
                        mediaUrl: null
                    };
                    if (!messageContent) {
                        messageContent = msg.message.videoMessage?.caption || '[Video received]';
                    }
                } else if (messageType === 'audioMessage') {
                    const audioBase64 = await decryptMedia(msg, 'audio');
                    mediaPayload = {
                        message_type: 'audio',
                        mimetype: msg.message.audioMessage?.mimetype || 'audio/ogg',
                        audio_base64: audioBase64,
                        media_url: null,
                        mediaUrl: null
                    };
                    if (!messageContent) {
                        messageContent = '[Audio received]';
                    }
                } else if (messageType === 'documentMessage') {
                    const documentBase64 = await decryptMedia(msg, 'document');
                    mediaPayload = {
                        message_type: 'document',
                        mimetype: msg.message.documentMessage?.mimetype || 'application/octet-stream',
                        fileName: msg.message.documentMessage?.fileName || null,
                        document_base64: documentBase64,
                        media_url: null,
                        mediaUrl: null
                    };
                    if (!messageContent) {
                        messageContent = msg.message.documentMessage?.fileName ? `[Document: ${msg.message.documentMessage.fileName}]` : '[Document received]';
                    }
                }

                if (!messageContent) {
                    logger.warn(`⚠️  [Baileys] Unsupported non-text message. Type: ${messageType}`);
                    continue;
                }

                logger.info(`💬 [Baileys] Incoming message from ${from}: "${messageContent.substring(0, 60)}..."`);

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
                    message_type: mediaPayload.message_type || messageType,
                    message_id: msg.key.id,
                    pushName: msg.pushName || '',
                    ...mediaPayload
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

app.get('/pairing-code/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.pairingCode) return res.status(404).json({ error: 'Pairing code not available' });
    res.json({ pairingCode: session.pairingCode });
});

app.get('/media/message/:sessionId/:messageId', async (req, res) => {
    const { sessionId, messageId } = req.params;
    if (!sessionId || !messageId) {
        return res.status(400).json({ error: 'sessionId and messageId are required' });
    }

    const session = sessions.get(sessionId);
    if (!session || session.state !== 'open') {
        return res.status(503).json({ error: 'WhatsApp session not connected' });
    }

    const cached = recentMessages.get(messageId);
    if (!cached || cached.sessionId !== sessionId || !cached.message) {
        return res.status(404).json({ error: 'Message not cached or not found' });
    }

    try {
        const buffer = await downloadMediaMessage(
            cached.message,
            'buffer',
            {},
            {
                logger,
                reuploadRequest: session.sock.updateMediaMessage
            }
        );
        if (!buffer || buffer.length === 0) {
            return res.status(500).json({ error: 'Failed to decrypt media' });
        }

        const mediaType = Object.keys(cached.message.message || {})[0] || 'application/octet-stream';
        let mimeType = 'application/octet-stream';
        if (mediaType === 'imageMessage') mimeType = cached.message.message.imageMessage?.mimetype || 'image/jpeg';
        if (mediaType === 'videoMessage') mimeType = cached.message.message.videoMessage?.mimetype || 'video/mp4';
        if (mediaType === 'audioMessage') mimeType = cached.message.message.audioMessage?.mimetype || 'audio/ogg';
        if (mediaType === 'documentMessage') mimeType = cached.message.message.documentMessage?.mimetype || 'application/octet-stream';

        res.set('Content-Type', mimeType);
        res.send(buffer);
    } catch (err) {
        logger.error(`❌ [Baileys] /media/message download failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
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

    const queueData = getSessionQueue(sessionId);
    const totalQueueLength = Array.from(messageQueues.values()).reduce((count, queue) => count + queue.messages.length, 0);
    if (totalQueueLength >= MAX_QUEUE_LENGTH) {
        logger.warn(`⚠️ [Queue] Global queue limit reached: ${totalQueueLength}`);
        return res.status(429).json({ error: 'Global message queue limit reached. Try again later.' });
    }
    if (queueData.messages.length >= MAX_QUEUE_PER_SESSION) {
        logger.warn(`⚠️ [Queue] Session queue limit reached for ${sessionId}: ${queueData.messages.length}`);
        return res.status(429).json({ error: 'Session queue limit reached. Please retry shortly.' });
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

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

// ─── SEND BASE64 IMAGE MESSAGE (for invoice delivery) ──────────────────────
app.post('/send-message-base64', async (req, res) => {
    const { sessionId, to, image_base64, caption } = req.body;
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) {
        logger.warn(`🔑 [HTTP] Unauthorized /send-message-base64 attempt. sessionId=${sessionId}, to=${to}`);
        return res.status(401).send('Unauthorized');
    }

    logger.info(`📥 [HTTP] /send-message-base64 request. sessionId=${sessionId}, to=${to}, caption="${(caption || '').substring(0, 60)}"`);

    const session = sessions.get(sessionId);
    const sessionState = session ? session.state : 'missing';

    if (!session || session.state !== 'open') {
        logger.warn(`⭕ [Session] send-message-base64 blocked. sessionId=${sessionId}, state=${sessionState}`);
        return res.status(503).json({ error: 'WhatsApp session not connected' });
    }

    const queueData = getSessionQueue(sessionId);
    const totalQueueLength = Array.from(messageQueues.values()).reduce((count, queue) => count + queue.messages.length, 0);
    if (totalQueueLength >= MAX_QUEUE_LENGTH) {
        logger.warn(`⚠️ [Queue] Global queue limit reached: ${totalQueueLength}`);
        return res.status(429).json({ error: 'Global message queue limit reached. Try again later.' });
    }
    if (queueData.messages.length >= MAX_QUEUE_PER_SESSION) {
        logger.warn(`⚠️ [Queue] Session queue limit reached for ${sessionId}: ${queueData.messages.length}`);
        return res.status(429).json({ error: 'Session queue limit reached. Please retry shortly.' });
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    const sendPromise = new Promise((resolve, reject) => {
        queueData.messages.push({
            jid,
            message: caption || 'Invoice',
            type: 'image_base64',
            image_base64: image_base64,
            resolve,
            reject
        });
    });

    logger.info(`📬 [Queue] enqueue base64 image for sessionId=${sessionId}, to=${jid}, size=${image_base64.length} bytes`);

    processQueue(sessionId).catch(err => logger.error(`Queue error: ${err.message}`));

    if (queueData.messages.length > 1) {
        res.json({ success: true, status: 'queued', queueLength: queueData.messages.length });
    } else {
        try {
            const result = await sendPromise;
            logger.info(`✅ [HTTP] /send-message-base64 delivered for sessionId=${sessionId}, to=${jid}`);
            res.json(result);
        } catch (err) {
            logger.error(`❌ [HTTP] /send-message-base64 failed for sessionId=${sessionId}, to=${jid}: ${err.message}`);
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