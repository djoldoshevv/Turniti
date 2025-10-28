# Пошаговая настройка бота

## Шаг 1: Создание Telegram бота

1. Откройте Telegram и найдите **@BotFather**
2. Отправьте команду `/newbot`
3. Введите имя для вашего бота (например: "Academi File Bot")
4. Введите username для бота (должен заканчиваться на "bot", например: "academi_file_bot")
5. Скопируйте полученный токен (выглядит примерно так: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Шаг 2: Настройка проекта

1. Создайте файл `.env`:
```bash
cp .env.example .env
```

2. Откройте `.env` и вставьте ваш токен:
```
TELEGRAM_BOT_TOKEN=ваш_токен_здесь
```

## Шаг 3: Исследование academi.cx

Перед запуском бота нужно понять, как работает academi.cx:

### Вариант А: Использование инспектора

Запустите скрипт инспектора:
```bash
node inspect-academi.js
```

Этот скрипт:
- Откроет браузер с academi.cx
- Покажет все найденные элементы (кнопки, формы, input)
- Будет логировать все сетевые запросы
- Сохранит структуру страницы в файл

**Что делать:**
1. Дождитесь открытия браузера
2. Вручную загрузите тестовый файл
3. Следите за консолью - там будут показаны все HTTP запросы
4. Запишите:
   - URL куда отправляется файл
   - Метод (POST/GET)
   - Имя поля для файла
   - Как приходит ответ с обработанным файлом

### Вариант Б: Ручная проверка через DevTools

1. Откройте https://academi.cx в браузере
2. Нажмите F12 (Developer Tools)
3. Перейдите на вкладку **Network**
4. Загрузите файл на сайт
5. Найдите POST запрос в списке
6. Посмотрите:
   - Request URL
   - Request Headers
   - Form Data
   - Response

## Шаг 4: Настройка кода под academi.cx

### Если нашли API endpoint (HTTP метод):

Используйте `bot-http.js`:

1. Откройте `bot-http.js`
2. Найдите строку:
```javascript
const ACADEMI_UPLOAD_URL = 'https://academi.cx/upload';
```
3. Замените на реальный URL из DevTools

4. Найдите секцию с formData и добавьте нужные поля:
```javascript
formData.append('file', fs.createReadStream(filePath));
// Добавьте другие поля если нужно:
formData.append('action', 'process');
formData.append('type', 'document');
```

5. Настройте парсинг ответа в функции `uploadToAcademiCxHTTP`

6. Запустите бот:
```bash
node bot-http.js
```

### Если API нет (нужен браузер):

Используйте `bot.js`:

1. Откройте `bot.js`
2. Найдите функцию `uploadToAcademiCx`
3. Обновите селекторы:

```javascript
// Селектор для input file
await page.waitForSelector('input[type="file"]');
// Замените на: await page.waitForSelector('#file-upload'); // пример

// Селектор для кнопки отправки
const submitButton = await page.$('button[type="submit"]');
// Замените на: const submitButton = await page.$('#submit-btn'); // пример

// Селектор для ссылки скачивания
await page.waitForSelector('a[download]');
// Замените на: await page.waitForSelector('.download-link'); // пример
```

4. Запустите бот:
```bash
node bot.js
```

## Шаг 5: Тестирование

1. Найдите вашего бота в Telegram по username
2. Отправьте `/start`
3. Отправьте тестовый файл
4. Следите за консолью на наличие ошибок
5. Проверьте, что получили обработанный файл обратно

## Шаг 6: Отладка

### Если бот не отвечает:
- Проверьте правильность токена
- Убедитесь, что бот запущен (смотрите консоль)
- Проверьте интернет соединение

### Если ошибка при загрузке на academi.cx:
- Запустите `bot.js` с `headless: false` чтобы видеть браузер
- Добавьте скриншоты для отладки:
```javascript
await page.screenshot({ path: 'debug.png' });
```
- Проверьте селекторы - возможно сайт изменился

### Если файл не скачивается:
- Проверьте селектор ссылки скачивания
- Возможно нужно подождать дольше:
```javascript
await page.waitForSelector('.download-link', { timeout: 120000 }); // 2 минуты
```

## Шаг 7: Запуск в продакшене

### Использование PM2 (рекомендуется):

```bash
# Установить PM2
npm install -g pm2

# Запустить бота
pm2 start bot.js --name "academi-bot"

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Просмотр логов
pm2 logs academi-bot

# Остановка
pm2 stop academi-bot

# Перезапуск
pm2 restart academi-bot
```

### Использование systemd (Linux):

Создайте файл `/etc/systemd/system/academi-bot.service`:

```ini
[Unit]
Description=Academi Telegram Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/telegram-academi-bot
ExecStart=/usr/bin/node bot.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Затем:
```bash
sudo systemctl enable academi-bot
sudo systemctl start academi-bot
sudo systemctl status academi-bot
```

## Полезные команды

```bash
# Запуск бота
npm start

# Запуск с логированием
npm start > bot.log 2>&1

# Проверка логов
tail -f bot.log

# Остановка всех node процессов
pkill -f node
```

## Безопасность

1. **Никогда не коммитьте .env файл** - он в .gitignore
2. **Не показывайте токен бота** никому
3. **Ограничьте размер файлов** если нужно:
```javascript
bot.on('document', async (msg) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (msg.document.file_size > maxSize) {
        return bot.sendMessage(msg.chat.id, 'Файл слишком большой!');
    }
    // ... остальной код
});
```

## Дополнительные возможности

### Добавить поддержку фото:
```javascript
bot.on('photo', async (msg) => {
    const photo = msg.photo[msg.photo.length - 1]; // Largest size
    // ... обработка как документ
});
```

### Добавить статистику:
```javascript
let stats = { processed: 0, errors: 0 };

bot.onText(/\/stats/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `📊 Статистика:\n` +
        `Обработано файлов: ${stats.processed}\n` +
        `Ошибок: ${stats.errors}`
    );
});
```

### Добавить список пользователей:
```javascript
const users = new Set();

bot.on('message', (msg) => {
    users.add(msg.from.id);
});

bot.onText(/\/users/, (msg) => {
    bot.sendMessage(msg.chat.id, `👥 Пользователей: ${users.size}`);
});
```

## Поддержка

Если возникли проблемы:
1. Проверьте логи в консоли
2. Убедитесь что все зависимости установлены
3. Проверьте что academi.cx доступен
4. Попробуйте запустить `inspect-academi.js` для отладки
