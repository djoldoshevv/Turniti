# 🔐 Настройка учетных данных

## Создайте файл .env

Создайте файл `.env` в директории `telegram-academi-bot` со следующим содержимым:

```env
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=8265586566:AAE-ahDFKSxIeND8yR-730MGCk4gLmXnaQ0

# Academi.cx Configuration
ACADEMI_URL=https://academi.cx
ACADEMI_EMAIL=ваш_email@example.com
ACADEMI_PASSWORD=ваш_пароль
```

## Команды для создания

### Вариант 1: Через терминал
```bash
cd /Users/zoldos/Downloads/telegram/telegram-academi-bot

cat > .env << 'EOF'
TELEGRAM_BOT_TOKEN=8265586566:AAE-ahDFKSxIeND8yR-730MGCk4gLmXnaQ0
ACADEMI_URL=https://academi.cx
ACADEMI_EMAIL=ваш_email@example.com
ACADEMI_PASSWORD=ваш_пароль
EOF
```

### Вариант 2: Через редактор
```bash
cd /Users/zoldos/Downloads/telegram/telegram-academi-bot
nano .env
```

Затем вставьте содержимое выше и сохраните (Ctrl+X, Y, Enter).

## ⚠️ Важно

1. **Замените** `ваш_email@example.com` на ваш реальный email от academi.cx
2. **Замените** `ваш_пароль` на ваш реальный пароль от academi.cx
3. **Не коммитьте** файл .env в git (он уже в .gitignore)

## 🧪 Проверка

После создания файла проверьте токен:
```bash
npm test
```

## 🚀 Запуск

```bash
npm start
```

## 📝 Что изменилось в коде

Бот теперь:
1. ✅ Автоматически входит в ваш аккаунт на academi.cx
2. ✅ Загружает файл
3. ✅ Ищет и нажимает кнопку "Download AI Summary"
4. ✅ Скачивает обработанный файл
5. ✅ Отправляет его вам в Telegram

## 🔍 Отладка

Если нужно увидеть что происходит в браузере, откройте `bot.js` и измените:

```javascript
const browser = await puppeteer.launch({
    headless: false,  // Изменить на false
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

Тогда браузер будет видимым и вы сможете наблюдать за процессом.
