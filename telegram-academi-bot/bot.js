require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { userDB, checksDB, transactionDB } = require('./database');
const { startAdminPanel } = require('./admin-panel');

// Replace with your Telegram Bot Token
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// Academi.cx credentials
const ACADEMI_EMAIL = process.env.ACADEMI_EMAIL;
const ACADEMI_PASSWORD = process.env.ACADEMI_PASSWORD;
const ACADEMI_URL = process.env.ACADEMI_URL || 'https://academi.cx';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN || '';
const PAYMENT_CURRENCY = process.env.PAYMENT_CURRENCY || 'USD'; // e.g., USD, EUR
const USE_TELEGRAM_PAYMENTS = (process.env.USE_TELEGRAM_PAYMENTS || 'false').toLowerCase() === 'true';

// Create bot instance
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Temporary directory for file storage
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

// Store user sessions
const userSessions = new Map();

console.log('Bot started successfully!');

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const user = userDB.getOrCreate(chatId, msg.from);
    
    bot.sendMessage(chatId, 
        '👋 Добро пожаловать в Turnitin Bot!\n\n' +
        '📝 Проверка документов через официальный Turnitin\n\n' +
        '✅ Что я делаю:\n' +
        '• Проверяю на плагиат\n' +
        '• Создаю AI отчет\n' +
        '• Анализирую качество текста\n\n' +
        `🎁 У вас ${user.checks_remaining} бесплатных проверок!\n\n` +
        '💰 Стоимость: 500 сом за проверку\n' +
        '📦 Есть выгодные пакеты со скидкой до 40%\n\n' +
        '📤 Просто отправьте мне ваш документ!\n\n' +
        'Команды:\n' +
        '/profile - Ваш профиль\n' +
        '/buy - Купить проверки\n' +
        '/help - Помощь'
    );
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        '📖 Как пользоваться Turnitin Bot:\n\n' +
        '1️⃣ Отправьте мне ваш документ\n' +
        '2️⃣ Я проверю его через Turnitin\n' +
        '3️⃣ Создам подробный AI отчет\n' +
        '4️⃣ Отправлю вам результаты проверки\n\n' +
        '📄 Поддерживаемые форматы:\n' +
        'PDF, DOC, DOCX, TXT и другие\n\n' +
        '⏱ Время обработки: 30-60 секунд\n\n' +
        '🔒 Ваши документы в безопасности и удаляются после проверки\n\n' +
        'Команды:\n' +
        '/profile - Ваш профиль и подписка\n' +
        '/buy - Купить подписку'
    );
});

// Handle /profile command
bot.onText(/\/profile/, (msg) => {
    const chatId = msg.chat.id;
    const user = userDB.getOrCreate(chatId, msg.from);
    
    const now = Math.floor(Date.now() / 1000);
    const isActive = user.subscription_type !== 'free' && user.subscription_expires > now;
    
    let message = '👤 Ваш профиль:\n\n';
    message += `📊 Подписка: ${user.subscription_type === 'free' ? '🆓 Бесплатная' : '💎 ' + user.subscription_type.toUpperCase()}\n`;
    
    if (isActive) {
        const daysLeft = Math.ceil((user.subscription_expires - now) / 86400);
        message += `⏰ Действует до: ${new Date(user.subscription_expires * 1000).toLocaleDateString()}\n`;
        message += `📅 Осталось дней: ${daysLeft}\n`;
    }
    
    message += `\n✅ Проверок осталось: ${user.checks_remaining}\n`;
    message += `📈 Всего проверок: ${user.total_checks}\n`;
    message += `📅 Зарегистрирован: ${new Date(user.created_at * 1000).toLocaleDateString()}\n\n`;
    
    if (!isActive && user.checks_remaining === 0) {
        message += '💎 Купите подписку: /buy';
    }
    
    bot.sendMessage(chatId, message);
});

// Handle /buy command
bot.onText(/\/buy/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!USE_TELEGRAM_PAYMENTS) {
        console.log('Payment mode: Stars (XTR)');
        const keyboard = {
            inline_keyboard: [
                [{ text: '1️⃣ 1 проверка — 1 Star', callback_data: 'buy_1check' }]
            ]
        };
        bot.sendMessage(chatId,
            '💫 Оплата через Telegram Stars (тест)\n\n' +
            'Пакет:\n' +
            '• 1 проверка — 1 Star\n\n' +
            'Нажмите кнопку ниже, чтобы оплатить',
            { reply_markup: keyboard }
        );
    } else {
        console.log('Payment mode: Telegram Payments (provider)');
        const keyboard = {
            inline_keyboard: [
                [{ text: '1️⃣ 1 проверка — $5', callback_data: 'buy_1check' }],
                [{ text: '5️⃣ 5 проверок — $18 💰', callback_data: 'buy_5checks' }],
                [{ text: '🔟 10 проверок — $32 🔥', callback_data: 'buy_10checks' }],
                [{ text: '2️⃣0️⃣ 20 проверок — $55 ⭐', callback_data: 'buy_20checks' }]
            ]
        };
        bot.sendMessage(chatId,
            '💳 Оплата через Telegram Payments (FreedomPay, тест)\n\n' +
            'Тарифы (USD):\n' +
            '• 1 проверка — $5\n' +
            '• 5 проверок — $18\n' +
            '• 10 проверок — $32\n' +
            '• 20 проверок — $55\n\n' +
            'Выберите пакет ниже и оплатите прямо в Telegram',
            { reply_markup: keyboard }
        );
    }
});

// Handle document uploads
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;
    const fileId = document.file_id;
    const fileName = document.file_name;

    try {
        // Создать или получить пользователя
        const user = userDB.getOrCreate(chatId, msg.from);
        userDB.updateLastActive(chatId);
        
        // Проверить доступ
        const access = userDB.canUseBot(chatId);
        
        if (!access.allowed) {
            return bot.sendMessage(chatId,
                '❌ У вас закончились проверки!\n\n' +
                '💰 Стоимость одной проверки: 500 сом\n\n' +
                '📦 Или купите пакет проверок:\n' +
                '• 5 проверок - 2000 сом (скидка 20%)\n' +
                '• 10 проверок - 3500 сом (скидка 30%)\n' +
                '• 20 проверок - 6000 сом (скидка 40%)\n\n' +
                'Используйте /buy для покупки'
            );
        }
        // Send processing message
        const processingMsg = await bot.sendMessage(chatId, '⏳ Загружаю файл...');

        // Download file from Telegram
        const fileLink = await bot.getFileLink(fileId);
        const filePath = path.join(TEMP_DIR, `${Date.now()}_${fileName}`);
        
        await downloadFile(fileLink, filePath);
        
        await bot.editMessageText('📤 Отправляю на обработку...', {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });

        // Upload and get processed file
        const processedFilePath = await uploadToAcademiCx(filePath, fileName);
        
        // Использовать одну проверку
        userDB.useCheck(chatId);
        
        // Записать в историю
        checksDB.add(chatId, fileName, document.file_size, 'success');

        await bot.editMessageText('✅ Файл обработан! Отправляю вам...', {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });

        // Log file info before sending
        console.log('Sending file to user:');
        console.log('  Path:', processedFilePath);
        console.log('  Exists:', fs.existsSync(processedFilePath));
        if (fs.existsSync(processedFilePath)) {
            const stats = fs.statSync(processedFilePath);
            console.log('  Size:', stats.size, 'bytes');
            console.log('  Name:', path.basename(processedFilePath));
        }

        // Send processed file back to user
        await bot.sendDocument(chatId, processedFilePath, {
            caption: '✅ Проверка завершена!\n\n📊 Ваш Turnitin отчет готов\n🔍 Результаты анализа во вложении'
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

// Function to upload file and get processed file
async function uploadToAcademiCx(filePath, fileName) {
    console.log('Starting file processing...');

    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new',  // Скрытый браузер для продакшн
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Navigate to processing service
        console.log('Navigating to processing service...');
        await page.goto(ACADEMI_URL, { waitUntil: 'networkidle2' });

        // Check if login is required and credentials are provided
        if (ACADEMI_EMAIL && ACADEMI_PASSWORD) {
            console.log('Attempting to login...');
            
            // Try to find login button or link
            let loginButton = await page.$('a[href*="login"]');
            if (!loginButton) {
                loginButton = await page.$('.login-btn');
            }
            if (!loginButton) {
                // Try to find button with "Login" text
                loginButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    return buttons.find(btn => 
                        btn.textContent.toLowerCase().includes('login') ||
                        btn.textContent.toLowerCase().includes('sign in')
                    );
                });
            }
            
            if (loginButton && loginButton.asElement()) {
                console.log('Found login button, clicking...');
                await loginButton.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Fill in email
            try {
                await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 5000 });
                await page.type('input[type="email"], input[name="email"], #email', ACADEMI_EMAIL);
                console.log('Email entered');
            } catch (e) {
                console.log('Email field not found, might already be on main page');
            }

            // Fill in password
            try {
                await page.type('input[type="password"], input[name="password"], #password', ACADEMI_PASSWORD);
                console.log('Password entered');
            } catch (e) {
                console.log('Password field not found');
            }

            // Click login/submit button
            try {
                const submitBtn = await page.$('button[type="submit"]');
                if (submitBtn) {
                    await submitBtn.click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    console.log('Logged in successfully!');
                }
            } catch (e) {
                console.log('Submit button not found or already logged in');
            }
        }

        // Step 1: Go to Dashboard
        console.log('Looking for Dashboard button...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let dashboardButton = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            return buttons.find(btn => 
                btn.textContent.toLowerCase().includes('dashboard') ||
                btn.textContent.toLowerCase().includes('go to dashboard')
            );
        });
        
        if (dashboardButton && dashboardButton.asElement()) {
            console.log('Found Dashboard button, clicking...');
            await dashboardButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            console.log('Dashboard button not found, might already be on dashboard');
        }

        // Step 2: Click "Upload a file" (if exists)
        console.log('Looking for Upload a file button...');
        const uploadButtonClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, div'));
            const found = buttons.find(btn => {
                const text = btn.textContent.toLowerCase().trim();
                return text.includes('upload a file') || 
                       text.includes('upload file') ||
                       text.includes('new upload');
            });
            
            if (found) {
                found.click();
                return true;
            }
            return false;
        });
        
        if (uploadButtonClicked) {
            console.log('Found Upload a file button, clicking...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            console.log('Upload a file button not found, might already be on upload page');
        }

        // Wait for file input
        console.log('Looking for file upload input...');
        try {
            await page.waitForSelector('input[type="file"]', { timeout: 10000 });
        } catch (e) {
            console.log('File input not found, taking screenshot for debugging...');
            await page.screenshot({ path: path.join(TEMP_DIR, 'debug_screenshot.png') });
            throw new Error('File input not found after clicking Upload button');
        }

        // Upload file
        const fileInput = await page.$('input[type="file"]');
        await fileInput.uploadFile(filePath);
        console.log('File uploaded!');

        // Wait a bit for file to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Wait for submit button and click it if exists
        try {
            let submitButton = await page.$('button[type="submit"]');
            if (!submitButton) {
                submitButton = await page.$('input[type="submit"]');
            }
            if (!submitButton) {
                submitButton = await page.$('.submit-btn');
            }
            if (!submitButton) {
                // Try to find button with "Upload" text
                submitButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => 
                        btn.textContent.toLowerCase().includes('upload') ||
                        btn.textContent.toLowerCase().includes('submit')
                    );
                });
            }
            
            if (submitButton && submitButton.asElement()) {
                console.log('Clicking submit button...');
                await submitButton.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } catch (e) {
            console.log('No submit button found or already submitted');
        }

        // Step 3: Wait for processing to complete (results to appear)
        console.log('Waiting for file processing and results...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Увеличено время ожидания

        // Step 4: Click "View results" button
        console.log('Looking for View results button...');
        let viewResultsButton = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            return buttons.find(btn => {
                const text = btn.textContent.toLowerCase().trim();
                return text.includes('view results') || text.includes('view result');
            });
        });
        
        if (viewResultsButton && viewResultsButton.asElement()) {
            console.log('Found View results button, clicking...');
            await viewResultsButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            console.log('View results button not found, might already be on results page');
        }

        // Step 5: Click "Download AI report" button
        console.log('Looking for Download AI report button...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Сначала получим информацию о всех кнопках для отладки
        const allButtons = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            return buttons
                .filter(btn => {
                    const text = btn.textContent.toLowerCase().trim();
                    return text.includes('download') || text.includes('report');
                })
                .map(btn => ({
                    text: btn.textContent.trim(),
                    href: btn.href || null,
                    onclick: btn.onclick ? btn.onclick.toString() : null,
                    tagName: btn.tagName
                }));
        });
        
        console.log('Found buttons with "download" or "report":', JSON.stringify(allButtons, null, 2));
        
        // Ищем кнопку через evaluate и кликаем внутри браузера
        const downloadButtonClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            
            // Ищем именно "Download AI report"
            let found = buttons.find(btn => {
                const text = btn.textContent.toLowerCase().trim();
                return text.includes('download') && text.includes('ai') && text.includes('report');
            });
            
            if (!found) {
                // Или просто "AI report"
                found = buttons.find(btn => {
                    const text = btn.textContent.toLowerCase().trim();
                    return text.includes('ai report');
                });
            }
            
            if (!found) {
                // Или "download ai"
                found = buttons.find(btn => {
                    const text = btn.textContent.toLowerCase().trim();
                    return text.includes('download') && text.includes('ai');
                });
            }
            
            if (found) {
                console.log('Found button:', found.textContent);
                found.click();
                return { 
                    clicked: true, 
                    text: found.textContent, 
                    href: found.href || null,
                    dataUrl: found.getAttribute('data-url') || null,
                    dataFile: found.getAttribute('data-file') || null
                };
            }
            
            return { clicked: false };
        });

        // Настройка CDP для скачивания файлов
        console.log('Setting up download behavior...');
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: TEMP_DIR
        });

        // Отслеживание скачанных файлов
        const downloadedFiles = [];
        client.on('Browser.downloadProgress', (event) => {
            console.log('Download progress:', event.state, event.guid);
            if (event.state === 'completed') {
                console.log('Download completed:', event.guid);
                downloadedFiles.push(event.guid);
            }
        });

        // Отслеживание новых вкладок/окон
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                console.log('New tab/window opened:', target.url());
            }
        });

        // Получаем список файлов ДО нажатия кнопки
        const filesBefore = fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR) : [];
        console.log('Files before download:', filesBefore.length);

        if (downloadButtonClicked.clicked) {
            console.log('Download AI report button clicked!');
            console.log('Button text:', downloadButtonClicked.text);
            
            // Проверяем есть ли прямая ссылка
            if (downloadButtonClicked.href && !downloadButtonClicked.href.includes('#') && 
                (downloadButtonClicked.href.includes('.pdf') || downloadButtonClicked.href.includes('.docx') || 
                 downloadButtonClicked.href.includes('download'))) {
                console.log('Found direct download link:', downloadButtonClicked.href);
                // Скачиваем напрямую через axios
                const processedFilePath = path.join(TEMP_DIR, `processed_${Date.now()}_${fileName}`);
                await downloadFile(downloadButtonClicked.href, processedFilePath);
                console.log('File downloaded successfully via direct link!');
                return processedFilePath;
            } else {
                console.log('Button clicked (JavaScript download), waiting for file...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        } else {
            console.log('Download AI report button not found!');
            throw new Error('Download AI report button not found');
        }

        // Ждем появления нового файла
        console.log('Waiting for new file to appear...');
        let attempts = 0;
        let newFile = null;
        
        while (attempts < 20 && !newFile) { // 20 попыток по 1 секунде = 20 секунд
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const filesAfter = fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR) : [];
            const newFiles = filesAfter.filter(f => !filesBefore.includes(f) && !f.startsWith(path.basename(filePath)));
            
            if (newFiles.length > 0) {
                newFile = newFiles[0];
                console.log('New file detected:', newFile);
                break;
            }
            
            attempts++;
            if (attempts % 5 === 0) {
                console.log(`Still waiting... (${attempts} seconds)`);
            }
        }

        if (newFile) {
            const downloadedFile = path.join(TEMP_DIR, newFile);
            
            // Используем оригинальное имя скачанного файла (с правильным расширением)
            const downloadedExt = path.extname(newFile); // .pdf
            const originalBaseName = path.basename(fileName, path.extname(fileName)); // без расширения
            const processedFilePath = path.join(TEMP_DIR, `processed_${Date.now()}_${originalBaseName}${downloadedExt}`);
            
            // Ждем пока файл полностью скачается
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            fs.renameSync(downloadedFile, processedFilePath);
            console.log('File processed successfully!');
            console.log('Final file:', path.basename(processedFilePath));
            return processedFilePath;
        } else {
            console.log('No new file found after 20 seconds');
            throw new Error('Could not find downloaded file - timeout after 20 seconds');
        }

    } finally {
        await browser.close();
    }
}

// Handle callback queries (кнопки покупки)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data.startsWith('buy_')) {
        if (!USE_TELEGRAM_PAYMENTS) {
            // Stars pricing (XTR) — test: 1 check = 1 Star
            const packages = {
                'buy_1check': { checks: 1, stars: 1, name: '1 проверка' }
            };

            const pkg = packages[data];
            if (pkg) {
                try {
                    await bot.answerCallbackQuery(query.id, { text: `Счёт: ${pkg.name}` });
                    const title = `Пакет: ${pkg.name}`;
                    const description = `Оплата через Telegram Stars. После оплаты будет начислено: ${pkg.checks} проверка.`;
                    const payload = JSON.stringify({ user_id: chatId, checks: pkg.checks, pkg: data });
                    const currency = 'XTR';
                    const prices = [{ label: pkg.name, amount: pkg.stars }]; // in stars
                    await bot.sendInvoice(
                        chatId,
                        title,
                        description,
                        payload,
                        '',
                        currency,
                        prices,
                        { need_name: false, need_phone_number: false, is_flexible: false }
                    );
                } catch (e) {
                    console.error('sendInvoice error:', e);
                    try { if (e.response && e.response.body) console.error('Telegram response body:', e.response.body); } catch (_) {}
                    const apiDescription = (e && e.response && e.response.body && e.response.body.description) ? ` — ${e.response.body.description}` : '';
                    await bot.sendMessage(chatId, `❌ Не удалось выставить счёт${apiDescription}. Попробуйте позже.`);
                }
            }
            return; // end Stars branch
        }

        // Payments provider branch (USD cents)
        const packages = {
            'buy_1check': { checks: 1, amount: 500, name: '1 проверка' },
            'buy_5checks': { checks: 5, amount: 1800, name: '5 проверок' },
            'buy_10checks': { checks: 10, amount: 3200, name: '10 проверок' },
            'buy_20checks': { checks: 20, amount: 5500, name: '20 проверок' }
        };
    }
});

// Handle errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Telegram Payments: confirm checkout
bot.on('pre_checkout_query', (query) => {
    // Always answer OK. Additional checks could be done here.
    bot.answerPreCheckoutQuery(query.id, true).catch((e) => console.error('pre_checkout_query error', e));
});

// Telegram Payments: successful payment handler
bot.on('message', (msg) => {
    if (msg.successful_payment) {
        try {
            const chatId = msg.chat.id;
            const payment = msg.successful_payment;
            const payload = JSON.parse(payment.invoice_payload || '{}');
            const checks = parseInt(payload.checks || '0', 10);

            if (checks > 0) {
                userDB.addFreeChecks(chatId, checks);
                transactionDB && transactionDB.create && transactionDB.create(chatId, payment.total_amount, payment.currency, `${checks}_checks`, 'telegram_stars');
                bot.sendMessage(chatId, `✅ Оплата получена! Начислено проверок: ${checks}`);
            }
        } catch (e) {
            console.error('successful_payment handling error:', e);
        }
    }
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

// Запуск админ-панели
startAdminPanel();
