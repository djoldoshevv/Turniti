# 💳 Платежная система и Админ-панель

## ✅ Что добавлено:

### 1. База данных (SQLite)
- **Пользователи**: хранение информации о подписках
- **Транзакции**: история платежей
- **История проверок**: логирование всех проверок
- **Админы**: управление доступом к админ-панели

### 2. Админ-панель (http://localhost:3000)
- **Dashboard**: статистика пользователей и проверок
- **Users**: список всех пользователей с возможностью добавления проверок
- **Transactions**: история платежей
- **Безопасный вход**: JWT авторизация

### 3. Система подписок
- **Бесплатно**: 3 проверки при регистрации
- **1 месяц**: $9.99 - безлимит
- **3 месяца**: $24.99 - безлимит (скидка 17%)
- **1 год**: $79.99 - безлимит (скидка 33%)

## 🚀 Как использовать:

### Для пользователей:

**Команды бота:**
- `/start` - Начать работу
- `/help` - Помощь
- `/profile` - Посмотреть свой профиль и подписку
- `/buy` - Купить подписку

**Процесс покупки:**
1. Отправьте `/buy` боту
2. Выберите план подписки
3. Свяжитесь с администратором для оплаты
4. После оплаты администратор активирует подписку

### Для администратора:

**Доступ к админ-панели:**
1. Откройте http://localhost:3000/admin/login
2. Войдите:
   - Username: `admin`
   - Password: `admin123`
3. **⚠️ Смените пароль после первого входа!**

**Функции админ-панели:**
- Просмотр всех пользователей
- Добавление бесплатных проверок пользователям
- Просмотр статистики
- Просмотр истории проверок

**Как добавить подписку пользователю:**

Через Node.js консоль:
```javascript
const { userDB } = require('./database');

// Добавить подписку на 30 дней
userDB.addSubscription(USER_ID, 'premium', 30);

// Добавить 10 бесплатных проверок
userDB.addFreeChecks(USER_ID, 10);
```

Или через админ-панель:
1. Перейдите в раздел "Users"
2. Найдите пользователя
3. Нажмите "Add Checks"
4. Введите количество проверок

## 📊 Структура базы данных:

### Таблица `users`:
- `user_id` - ID пользователя Telegram
- `username` - Username
- `subscription_type` - Тип подписки (free/premium)
- `subscription_expires` - Дата окончания подписки
- `checks_remaining` - Оставшиеся проверки
- `total_checks` - Всего проверок сделано

### Таблица `transactions`:
- `user_id` - ID пользователя
- `amount` - Сумма
- `subscription_type` - Тип подписки
- `status` - Статус (pending/completed/failed)

### Таблица `checks_history`:
- `user_id` - ID пользователя
- `file_name` - Имя файла
- `file_size` - Размер файла
- `status` - Статус (success/failed)

## 🔧 Интеграция реальной платежной системы:

### Вариант 1: Telegram Stars (встроенная система)
```javascript
// В bot.js добавить:
bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', (msg) => {
    const userId = msg.from.id;
    const payload = msg.successful_payment.invoice_payload;
    
    // Активировать подписку
    if (payload === '1month') {
        userDB.addSubscription(userId, 'premium', 30);
    }
});
```

### Вариант 2: Stripe
```bash
npm install stripe
```

```javascript
const stripe = require('stripe')('your_stripe_secret_key');

// Создать платеж
const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
        price_data: {
            currency: 'usd',
            product_data: { name: '1 Month Subscription' },
            unit_amount: 999, // $9.99
        },
        quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://yourbot.com/success',
    cancel_url: 'https://yourbot.com/cancel',
});
```

### Вариант 3: Криптовалюта
```bash
npm install @coinbase/coinbase-sdk
```

## 🔐 Безопасность:

1. **Смените пароль админа** после первого входа
2. **Добавьте JWT_SECRET** в .env:
   ```
   JWT_SECRET=your-very-long-random-secret-key-here
   ```
3. **Используйте HTTPS** для админ-панели в продакшн
4. **Регулярно делайте бэкапы** базы данных `bot.db`

## 📈 Мониторинг:

Админ-панель показывает:
- Общее количество пользователей
- Активные подписки
- Новые пользователи за сегодня
- Общее количество проверок

## 🛠 Дополнительные функции (TODO):

- [ ] Автоматическая оплата через Stripe/PayPal
- [ ] Email уведомления об окончании подписки
- [ ] Реферальная программа
- [ ] Промокоды и скидки
- [ ] Экспорт статистики в Excel
- [ ] Webhook для автоматической активации подписок

## 📞 Поддержка:

Для вопросов по интеграции платежей свяжитесь с разработчиком.
