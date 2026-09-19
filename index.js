const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('--- رابط رمز QR (افتحه في المتصفح) ---');
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            console.log('------------------------------------');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('انقطع الاتصال، جاري إعادة الاتصال...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('تم اتصال البوت بنجاح وهو يعمل الآن!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chat = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        if (chat.endsWith('@g.us')) {
            const text = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || '';

            const linkRegex = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi;

            if (linkRegex.test(text)) {
                console.log(`تم اكتشاف رابط من: ${sender}`);
                try {
                    await sock.sendMessage(chat, { delete: msg.key });
                    await sock.groupParticipantsUpdate(chat, [sender], 'remove');
                    console.log(`تم طرد العضو ${sender} وحذف الإعلان بنجاح.`);
                } catch (error) {
                    console.error('حدث خطأ أثناء الحذف أو الطرد. تأكد أن البوت مشرف (Admin):', error);
                }
            }
        }
    });
}

startBot();
