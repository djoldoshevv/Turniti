const Database = require('better-sqlite3');
const path = require('path');

// Создаем базу данных
const db = new Database(path.join(__dirname, 'bot.db'));

// Создаем таблицы
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        subscription_type TEXT DEFAULT 'free',
        subscription_expires INTEGER,
        checks_remaining INTEGER DEFAULT 0,
        total_checks INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_active INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL,
        currency TEXT,
        subscription_type TEXT,
        payment_method TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS checks_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        file_name TEXT,
        file_size INTEGER,
        status TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
`);

// Функции для работы с пользователями
const userDB = {
    // Получить или создать пользователя
    getOrCreate(userId, userData = {}) {
        let user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
        
        if (!user) {
            const stmt = db.prepare(`
                INSERT INTO users (user_id, username, first_name, last_name, checks_remaining)
                VALUES (?, ?, ?, ?, 1)
            `);
            stmt.run(
                userId,
                userData.username || null,
                userData.first_name || null,
                userData.last_name || null
            );
            user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
        }
        
        return user;
    },

    // Обновить последнюю активность
    updateLastActive(userId) {
        const stmt = db.prepare("UPDATE users SET last_active = strftime('%s', 'now') WHERE user_id = ?");
        stmt.run(userId);
    },

    // Проверить может ли пользователь использовать бота
    canUseBot(userId) {
        const user = this.getOrCreate(userId);
        const now = Math.floor(Date.now() / 1000);
        
        // Если есть активная подписка
        if (user.subscription_type !== 'free' && user.subscription_expires > now) {
            return { allowed: true, reason: 'subscription' };
        }
        
        // Если есть оставшиеся проверки
        if (user.checks_remaining > 0) {
            return { allowed: true, reason: 'free_checks' };
        }
        
        return { allowed: false, reason: 'no_access' };
    },

    // Использовать одну проверку
    useCheck(userId) {
        const stmt = db.prepare(`
            UPDATE users 
            SET checks_remaining = checks_remaining - 1,
                total_checks = total_checks + 1
            WHERE user_id = ?
        `);
        stmt.run(userId);
    },

    // Добавить подписку
    addSubscription(userId, type, days) {
        const now = Math.floor(Date.now() / 1000);
        const expires = now + (days * 24 * 60 * 60);
        
        const stmt = db.prepare(`
            UPDATE users 
            SET subscription_type = ?,
                subscription_expires = ?,
                checks_remaining = 999999
            WHERE user_id = ?
        `);
        stmt.run(type, expires, userId);
    },

    // Добавить бесплатные проверки
    addFreeChecks(userId, count) {
        const stmt = db.prepare(`
            UPDATE users 
            SET checks_remaining = checks_remaining + ?
            WHERE user_id = ?
        `);
        stmt.run(count, userId);
    },

    // Получить всех пользователей
    getAll() {
        return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    },

    // Получить статистику
    getStats() {
        const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const active = db.prepare("SELECT COUNT(*) as count FROM users WHERE subscription_type != 'free'").get().count;
        const today = db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at > strftime('%s', 'now', '-1 day')").get().count;
        const totalChecks = db.prepare('SELECT SUM(total_checks) as sum FROM users').get().sum || 0;
        
        return { total, active, today, totalChecks };
    }
};

// Функции для работы с транзакциями
const transactionDB = {
    create(userId, amount, currency, subscriptionType, paymentMethod) {
        const stmt = db.prepare(`
            INSERT INTO transactions (user_id, amount, currency, subscription_type, payment_method)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(userId, amount, currency, subscriptionType, paymentMethod);
        return result.lastInsertRowid;
    },

    updateStatus(id, status) {
        const stmt = db.prepare('UPDATE transactions SET status = ? WHERE id = ?');
        stmt.run(status, id);
    },

    getAll() {
        return db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100').all();
    },

    getByUser(userId) {
        return db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    }
};

// Функции для истории проверок
const checksDB = {
    add(userId, fileName, fileSize, status) {
        const stmt = db.prepare(`
            INSERT INTO checks_history (user_id, file_name, file_size, status)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(userId, fileName, fileSize, status);
    },

    getByUser(userId) {
        return db.prepare('SELECT * FROM checks_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId);
    },

    getRecent() {
        return db.prepare('SELECT * FROM checks_history ORDER BY created_at DESC LIMIT 100').all();
    }
};

// Функции для админов
const adminDB = {
    create(username, passwordHash) {
        const stmt = db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)');
        stmt.run(username, passwordHash);
    },

    getByUsername(username) {
        return db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    }
};

module.exports = {
    db,
    userDB,
    transactionDB,
    checksDB,
    adminDB
};
