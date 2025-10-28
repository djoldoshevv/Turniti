const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Replace with your Telegram Bot Token
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// Academi.cx endpoint (you need to find this by inspecting network requests)
const ACADEMI_UPLOAD_URL = 'https://academi.cx/upload'; // Example - adjust as needed
const ACADEMI_BASE_URL = 'https://academi.cx';

// Create bot instance
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Temporary directory for file storage
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

console.log('Bot started successfully (HTTP version)!');

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        '👋 Привет! Я бот для работы с academi.cx (HTTP версия)\n\n' +
        'Отправьте мне файл, и я обработаю его через academi.cx\n\n' +
        'Команды:\n' +
        '/start - Начать работу\n' +
        '/help - Помощь'
    );
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        '📖 Инструкция:\n\n' +
        '1. Отправьте мне файл (документ)\n' +
        '2. Я загружу его на academi.cx через HTTP\n' +
        '3. Получу обработанный файл\n' +
        '4. Отправлю вам результат\n\n' +
        'Поддерживаемые форматы: PDF, DOC, DOCX, TXT и другие'
    );
});

// Handle document uploads
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;
    const fileId = document.file_id;
    const fileName = document.file_name;

    try {
        // Send processing message
        const processingMsg = await bot.sendMessage(chatId, '⏳ Загружаю файл...');

        // Download file from Telegram
        const fileLink = await bot.getFileLink(fileId);
        const filePath = path.join(TEMP_DIR, `${Date.now()}_${fileName}`);
        
        await downloadFile(fileLink, filePath);
        
        await bot.editMessageText('📤 Отправляю на academi.cx...', {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });

        // Upload to academi.cx and get processed file
        const processedFilePath = await uploadToAcademiCxHTTP(filePath, fileName);

        await bot.editMessageText('✅ Файл обработан! Отправляю вам...', {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });

        // Send processed file back to user
        await bot.sendDocument(chatId, processedFilePath, {
            caption: '✅ Обработанный файл от academi.cx'
        });

        // Delete processing message
        await bot.deleteMessage(chatId, processingMsg.message_id);

        // Clean up temporary files
        fs.unlinkSync(filePath);
        fs.unlinkSync(processedFilePath);

    } catch (error) {
        console.error('Error processing file:', error);
        bot.sendMessage(chatId, 
            '❌ Произошла ошибка при обработке файла.\n' +
            `Ошибка: ${error.message}\n\n` +
            'Попробуйте еще раз или обратитесь к администратору.'
        );
    }
});

// Function to download file from URL
async function downloadFile(url, filePath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// Function to upload file to academi.cx via HTTP
async function uploadToAcademiCxHTTP(filePath, fileName) {
    console.log('Starting academi.cx HTTP processing...');

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath), {
            filename: fileName,
            contentType: 'application/octet-stream'
        });

        // Add any additional fields required by academi.cx
        // formData.append('action', 'process');
        // formData.append('type', 'document');

        // Upload file to academi.cx
        const uploadResponse = await axios.post(ACADEMI_UPLOAD_URL, formData, {
            headers: {
                ...formData.getHeaders(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Origin': ACADEMI_BASE_URL,
                'Referer': ACADEMI_BASE_URL + '/'
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 120000 // 2 minutes timeout
        });

        console.log('Upload response:', uploadResponse.data);

        // Extract download URL from response
        // This depends on the actual API response structure
        let downloadUrl;
        
        if (uploadResponse.data.downloadUrl) {
            downloadUrl = uploadResponse.data.downloadUrl;
        } else if (uploadResponse.data.url) {
            downloadUrl = uploadResponse.data.url;
        } else if (uploadResponse.data.file) {
            downloadUrl = uploadResponse.data.file;
        } else if (typeof uploadResponse.data === 'string' && uploadResponse.data.startsWith('http')) {
            downloadUrl = uploadResponse.data;
        } else {
            throw new Error('Could not find download URL in response');
        }

        // Make sure URL is absolute
        if (!downloadUrl.startsWith('http')) {
            downloadUrl = ACADEMI_BASE_URL + downloadUrl;
        }

        console.log('Download URL:', downloadUrl);

        // Download processed file
        const processedFilePath = path.join(TEMP_DIR, `processed_${Date.now()}_${fileName}`);
        await downloadFile(downloadUrl, processedFilePath);

        console.log('File processed successfully!');
        
        return processedFilePath;

    } catch (error) {
        console.error('Error in uploadToAcademiCxHTTP:', error.response?.data || error.message);
        throw error;
    }
}

// Handle errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down bot...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down bot...');
    bot.stopPolling();
    process.exit(0);
});
