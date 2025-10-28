# 🤖 Telegram Bot для Academi.cx

> Телеграм бот для автоматической обработки файлов через сервис academi.cx

[![Node.js](https://img.shields.io/badge/Node.js-14+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## 📖 Документация

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| **[QUICKSTART.md](QUICKSTART.md)** | 🚀 Быстрый старт за 5 минут | 5 мин |
| **[CHECKLIST.md](CHECKLIST.md)** | ✅ Пошаговый чек-лист настройки | 10 мин |
| **[SETUP.md](SETUP.md)** | 🔧 Подробная инструкция по настройке | 15 мин |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | 📐 Архитектура и схемы работы | 10 мин |
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | 📊 Итоговая сводка проекта | 5 мин |

## 🎯 Быстрый старт

```bash
# 1. Установите зависимости (уже сделано)
npm install

# 2. Создайте .env файл
cp .env.example .env

# 3. Добавьте токен бота в .env
# TELEGRAM_BOT_TOKEN=ваш_токен

# 4. Проверьте токен
npm test

# 5. Исследуйте academi.cx
npm run inspect

# 6. Запустите бота
npm start
```

👉 **Подробнее**: [QUICKSTART.md](QUICKSTART.md)

## 🚀 Возможности

- Прием файлов от пользователей в Telegram
- Автоматическая загрузка файлов на academi.cx
- Получение обработанных файлов
- Отправка результатов обратно пользователю

## 📋 Требования

- Node.js (версия 14 или выше)
- npm или yarn
- Telegram Bot Token (получить у @BotFather)

## 🛠 Установка

1. Клонируйте или скачайте проект

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

4. Получите токен бота:
   - Откройте Telegram и найдите @BotFather
   - Отправьте команду `/newbot`
   - Следуйте инструкциям и получите токен
   - Скопируйте токен в файл `.env`

5. Отредактируйте файл `.env`:
```
TELEGRAM_BOT_TOKEN=ваш_токен_здесь
```

## 🎯 Запуск

```bash
node bot.js
```

Или добавьте скрипт в `package.json`:
```bash
npm start
```

## 📖 Использование

1. Найдите вашего бота в Telegram
2. Отправьте команду `/start`
3. Отправьте файл боту
4. Дождитесь обработки
5. Получите обработанный файл обратно

## ⚙️ Настройка под academi.cx

**ВАЖНО:** Файл `bot.js` содержит базовую реализацию с Puppeteer для автоматизации браузера.

Вам нужно будет настроить следующие части кода под реальную структуру сайта academi.cx:

### 1. Селекторы для загрузки файла
```javascript
// Найдите правильный селектор для input file на сайте
await page.waitForSelector('input[type="file"]');
```

### 2. Кнопка отправки
```javascript
// Найдите правильный селектор для кнопки отправки
const submitButton = await page.$('button[type="submit"]');
```

### 3. Ссылка на скачивание
```javascript
// Найдите правильный селектор для ссылки скачивания
await page.waitForSelector('a[download]');
```

### Как найти правильные селекторы:

1. Откройте academi.cx в браузере
2. Нажмите F12 (Developer Tools)
3. Используйте инспектор элементов
4. Найдите нужные элементы и их селекторы
5. Обновите код в функции `uploadToAcademiCx()`

## 🔧 Альтернативный подход (если есть API)

Если у academi.cx появится API или вы найдете способ работы через HTTP запросы, можно заменить Puppeteer на более простой код:

```javascript
async function uploadToAcademiCx(filePath, fileName) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    
    const response = await axios.post('https://academi.cx/api/upload', formData, {
        headers: formData.getHeaders()
    });
    
    // Получить обработанный файл
    const processedFile = await axios.get(response.data.downloadUrl, {
        responseType: 'stream'
    });
    
    // Сохранить файл
    const processedFilePath = path.join(TEMP_DIR, `processed_${fileName}`);
    // ... сохранение файла
    
    return processedFilePath;
}
```

## 📝 Команды бота

- `/start` - Начать работу с ботом
- `/help` - Показать справку

## 🐛 Отладка

Для отладки работы с academi.cx:

1. Запустите Puppeteer в режиме с видимым браузером:
```javascript
const browser = await puppeteer.launch({
    headless: false, // Изменить на false
    args: ['--no-sandbox']
});
```

2. Добавьте скриншоты для отладки:
```javascript
await page.screenshot({ path: 'debug.png' });
```

3. Выведите HTML страницы:
```javascript
const html = await page.content();
console.log(html);
```

## 📦 Зависимости

- `node-telegram-bot-api` - Telegram Bot API
- `axios` - HTTP клиент
- `form-data` - Работа с формами
- `puppeteer` - Автоматизация браузера

## ⚠️ Важные замечания

1. **Puppeteer требует Chrome/Chromium** - при первом запуске автоматически скачается
2. **Селекторы могут измениться** - если academi.cx обновит сайт, нужно будет обновить селекторы
3. **Временные файлы** - автоматически удаляются после обработки
4. **Безопасность** - не храните токен в коде, используйте `.env`

## 📄 Лицензия

ISC

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте правильность токена бота
2. Убедитесь, что все зависимости установлены
3. Проверьте логи в консоли
4. Убедитесь, что селекторы для academi.cx актуальны
