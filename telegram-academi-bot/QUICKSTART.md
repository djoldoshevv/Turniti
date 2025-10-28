# Быстрый старт 🚀

## За 5 минут до запуска

### 1. Получите токен бота (2 минуты)

1. Откройте Telegram
2. Найдите **@BotFather**
3. Отправьте: `/newbot`
4. Придумайте имя: `Academi Bot`
5. Придумайте username: `academi_file_bot`
6. Скопируйте токен (выглядит так: `1234567890:ABC...`)

### 2. Настройте токен (1 минута)

```bash
# Создайте .env файл
cp .env.example .env

# Откройте .env и вставьте токен
nano .env
```

Или просто создайте файл `.env` с содержимым:
```
TELEGRAM_BOT_TOKEN=ваш_токен_сюда
```

### 3. Проверьте токен (30 секунд)

```bash
npm test
```

Вы должны увидеть информацию о вашем боте.

### 4. Исследуйте academi.cx (2 минуты)

```bash
npm run inspect
```

Это откроет браузер. Вам нужно:
1. Загрузить файл вручную на academi.cx
2. Посмотреть в консоль - там будут URL запросов
3. Записать URL куда отправляется файл

### 5. Настройте код (1 минута)

**Если нашли API endpoint:**

Откройте `bot-http.js` и измените:
```javascript
const ACADEMI_UPLOAD_URL = 'https://academi.cx/upload'; // Ваш URL сюда
```

**Если API нет:**

Откройте `bot.js` и обновите селекторы в функции `uploadToAcademiCx`:
```javascript
// Примеры - замените на реальные
await page.waitForSelector('#file-input');
const submitButton = await page.$('#submit-button');
await page.waitForSelector('.download-link');
```

### 6. Запустите бота (10 секунд)

```bash
# Если используете HTTP версию
npm run start:http

# Если используете Puppeteer версию
npm start
```

### 7. Протестируйте (30 секунд)

1. Откройте Telegram
2. Найдите вашего бота по username
3. Отправьте `/start`
4. Отправьте тестовый файл
5. Получите обработанный файл обратно

---

## Если что-то не работает

### Бот не отвечает?
```bash
# Проверьте токен
npm test
```

### Ошибка при загрузке на academi.cx?
```bash
# Запустите инспектор снова
npm run inspect
```

### Нужна помощь?
Смотрите подробную инструкцию в `SETUP.md`

---

## Полезные команды

```bash
npm start              # Запуск бота (Puppeteer версия)
npm run start:http     # Запуск бота (HTTP версия)
npm test               # Проверка токена
npm run inspect        # Исследование academi.cx
```

---

## Структура проекта

```
telegram-academi-bot/
├── bot.js              # Основной бот (с Puppeteer)
├── bot-http.js         # HTTP версия бота
├── inspect-academi.js  # Инспектор сайта
├── test-token.js       # Проверка токена
├── package.json        # Зависимости
├── .env                # Ваш токен (не коммитить!)
├── .env.example        # Пример .env
├── README.md           # Полная документация
├── SETUP.md            # Подробная настройка
└── QUICKSTART.md       # Этот файл
```

---

## Что дальше?

После успешного запуска:

1. **Настройте автозапуск** (см. SETUP.md)
2. **Добавьте функции** (статистика, ограничения и т.д.)
3. **Мониторинг** (логи, уведомления об ошибках)

Удачи! 🎉
