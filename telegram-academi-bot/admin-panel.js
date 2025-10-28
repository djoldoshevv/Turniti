const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const Stripe = require('stripe');
const { userDB, transactionDB, checksDB, adminDB } = require('./database');

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Middleware
// IMPORTANT: Stripe webhook needs raw body, define it BEFORE json/urlencoded
if (stripe) {
    app.post('/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('Stripe webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const metadata = session.metadata || {};
            const userId = parseInt(metadata.user_id, 10);
            const checks = parseInt(metadata.checks, 10) || 0;

            if (userId && checks > 0) {
                try {
                    userDB.addFreeChecks(userId, checks);
                    // log transaction
                    const txnId = transactionDB.create(userId, (session.amount_total || 0) / 100, session.currency || 'usd', `${checks}_checks`, 'stripe');
                    transactionDB.updateStatus(txnId, 'completed');
                    console.log(`✔️ Added ${checks} checks to user ${userId} via Stripe`);
                } catch (e) {
                    console.error('Failed to credit checks from webhook:', e.message);
                }
            }
        }

        res.json({ received: true });
    });
}

// Standard middleware comes AFTER webhook raw body route
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Create Stripe Checkout Session
if (stripe) {
    app.post('/stripe/create-session', async (req, res) => {
        try {
            const { user_id, pkg } = req.body;
            if (!user_id || !pkg) return res.status(400).json({ error: 'user_id and pkg required' });

            const packages = {
                buy_1check: { checks: 1, amount: 600, name: '1 check' },
                buy_5checks: { checks: 5, amount: 2400, name: '5 checks' },
                buy_10checks: { checks: 10, amount: 4200, name: '10 checks' },
                buy_20checks: { checks: 20, amount: 7200, name: '20 checks' }
            };

            const cfg = packages[pkg];
            if (!cfg) return res.status(400).json({ error: 'invalid package' });

            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: { name: `Turnitin Bot – ${cfg.name}` },
                            unit_amount: cfg.amount, // in cents
                        },
                        quantity: 1,
                    },
                ],
                success_url: `${PUBLIC_BASE_URL}/success`,
                cancel_url: `${PUBLIC_BASE_URL}/cancel`,
                metadata: {
                    user_id: String(user_id),
                    checks: String(cfg.checks),
                    pkg,
                },
            });

            res.json({ url: session.url });
        } catch (e) {
            console.error('create-session error:', e);
            res.status(500).json({ error: 'failed_to_create_session' });
        }
    });
}

// Simple success/cancel pages
app.get('/success', (req, res) => {
    res.send('<h2>✅ Payment successful</h2><p>You can return to Telegram bot.</p>');
});
app.get('/cancel', (req, res) => {
    res.send('<h2>❌ Payment canceled</h2><p>You can try again from Telegram bot.</p>');
});

// Middleware для проверки авторизации
function authMiddleware(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.redirect('/admin/login');
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        res.redirect('/admin/login');
    }
}

// Cookie parser (простой)
app.use((req, res, next) => {
    req.cookies = {};
    const cookies = req.headers.cookie;
    if (cookies) {
        cookies.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            req.cookies[name] = value;
        });
    }
    next();
});

// Страница логина
app.get('/admin/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Login - Turnitin Bot</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .login-container {
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    width: 100%;
                    max-width: 400px;
                }
                h1 { color: #333; margin-bottom: 30px; text-align: center; }
                .form-group { margin-bottom: 20px; }
                label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; }
                input {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 5px;
                    font-size: 14px;
                    transition: border-color 0.3s;
                }
                input:focus {
                    outline: none;
                    border-color: #667eea;
                }
                button {
                    width: 100%;
                    padding: 12px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                button:hover { transform: translateY(-2px); }
                .error { color: #e74c3c; margin-top: 10px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h1>🔐 Admin Panel</h1>
                <form method="POST" action="/admin/login">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" name="username" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" required>
                    </div>
                    <button type="submit">Login</button>
                    ${req.query.error ? '<p class="error">Invalid credentials</p>' : ''}
                </form>
            </div>
        </body>
        </html>
    `);
});

// Обработка логина
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    const admin = adminDB.getByUsername(username);
    
    if (!admin || !await bcrypt.compare(password, admin.password_hash)) {
        return res.redirect('/admin/login?error=1');
    }
    
    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Max-Age=604800; Path=/`);
    res.redirect('/admin/dashboard');
});

// Dashboard
app.get('/admin/dashboard', authMiddleware, (req, res) => {
    const stats = userDB.getStats();
    const users = userDB.getAll().slice(0, 10);
    const transactions = transactionDB.getAll().slice(0, 10);
    const checks = checksDB.getRecent().slice(0, 10);
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Dashboard - Turnitin Bot Admin</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: #f5f5f5;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header h1 { font-size: 24px; }
                .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
                .stat-card .number { font-size: 32px; font-weight: bold; color: #667eea; }
                .section {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                .section h2 { margin-bottom: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
                th { background: #f8f8f8; font-weight: 600; color: #555; }
                .badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .badge-free { background: #e0e0e0; color: #666; }
                .badge-premium { background: #ffd700; color: #333; }
                .badge-success { background: #4caf50; color: white; }
                .badge-pending { background: #ff9800; color: white; }
                .nav { display: flex; gap: 20px; margin-top: 20px; }
                .nav a {
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 5px;
                }
                .nav a:hover { background: rgba(255,255,255,0.3); }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="container">
                    <h1>📊 Turnitin Bot - Admin Dashboard</h1>
                    <div class="nav">
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/users">Users</a>
                        <a href="/admin/transactions">Transactions</a>
                        <a href="/admin/logout">Logout</a>
                    </div>
                </div>
            </div>
            
            <div class="container">
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>Total Users</h3>
                        <div class="number">${stats.total}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Active Subscriptions</h3>
                        <div class="number">${stats.active}</div>
                    </div>
                    <div class="stat-card">
                        <h3>New Today</h3>
                        <div class="number">${stats.today}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Checks</h3>
                        <div class="number">${stats.totalChecks}</div>
                    </div>
                </div>
                
                <div class="section">
                    <h2>Recent Users</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Username</th>
                                <th>Subscription</th>
                                <th>Checks</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td>${u.user_id}</td>
                                    <td>${u.username || 'N/A'}</td>
                                    <td><span class="badge badge-${u.subscription_type}">${u.subscription_type}</span></td>
                                    <td>${u.checks_remaining}</td>
                                    <td>${new Date(u.created_at * 1000).toLocaleDateString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="section">
                    <h2>Recent Checks</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>File Name</th>
                                <th>Size</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${checks.map(c => `
                                <tr>
                                    <td>${c.user_id}</td>
                                    <td>${c.file_name}</td>
                                    <td>${(c.file_size / 1024).toFixed(2)} KB</td>
                                    <td><span class="badge badge-${c.status}">${c.status}</span></td>
                                    <td>${new Date(c.created_at * 1000).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Страница пользователей
app.get('/admin/users', authMiddleware, (req, res) => {
    const users = userDB.getAll();
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Users - Turnitin Bot Admin</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: #f5f5f5;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header h1 { font-size: 24px; }
                .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                .section {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 14px; }
                th { background: #f8f8f8; font-weight: 600; color: #555; position: sticky; top: 0; }
                .badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .badge-free { background: #e0e0e0; color: #666; }
                .badge-premium { background: #ffd700; color: #333; }
                .nav { display: flex; gap: 20px; margin-top: 20px; }
                .nav a {
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 5px;
                }
                .nav a:hover { background: rgba(255,255,255,0.3); }
                .btn {
                    padding: 6px 12px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .btn:hover { background: #5568d3; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="container">
                    <h1>👥 All Users</h1>
                    <div class="nav">
                        <a href="/admin/dashboard">Dashboard</a>
                        <a href="/admin/users">Users</a>
                        <a href="/admin/transactions">Transactions</a>
                        <a href="/admin/logout">Logout</a>
                    </div>
                </div>
            </div>
            
            <div class="container">
                <div class="section">
                    <table>
                        <thead>
                            <tr>
                                <th>User ID</th>
                                <th>Username</th>
                                <th>Name</th>
                                <th>Subscription</th>
                                <th>Expires</th>
                                <th>Checks Left</th>
                                <th>Total Checks</th>
                                <th>Joined</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td>${u.user_id}</td>
                                    <td>${u.username || 'N/A'}</td>
                                    <td>${u.first_name || ''} ${u.last_name || ''}</td>
                                    <td><span class="badge badge-${u.subscription_type}">${u.subscription_type}</span></td>
                                    <td>${u.subscription_expires ? new Date(u.subscription_expires * 1000).toLocaleDateString() : 'N/A'}</td>
                                    <td>${u.checks_remaining}</td>
                                    <td>${u.total_checks}</td>
                                    <td>${new Date(u.created_at * 1000).toLocaleDateString()}</td>
                                    <td>${new Date(u.last_active * 1000).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn" onclick="addChecks(${u.user_id})">Add Checks</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <script>
                function addChecks(userId) {
                    const count = prompt('How many checks to add?');
                    if (count) {
                        fetch('/admin/api/add-checks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, count: parseInt(count) })
                        }).then(() => location.reload());
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// API для добавления проверок
app.post('/admin/api/add-checks', authMiddleware, (req, res) => {
    const { userId, count } = req.body;
    userDB.addFreeChecks(userId, count);
    res.json({ success: true });
});

// Logout
app.get('/admin/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'token=; HttpOnly; Max-Age=0; Path=/');
    res.redirect('/admin/login');
});

// Создать первого админа (запустить один раз)
async function createDefaultAdmin() {
    try {
        const existingAdmin = adminDB.getByUsername('admin');
        if (!existingAdmin) {
            const passwordHash = await bcrypt.hash('admin123', 10);
            adminDB.create('admin', passwordHash);
            console.log('✅ Default admin created: username=admin, password=admin123');
            console.log('⚠️  Please change the password after first login!');
        }
    } catch (error) {
        console.log('Admin already exists or error:', error.message);
    }
}

// Запуск сервера
function startAdminPanel() {
    createDefaultAdmin();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🌐 Admin panel running at http://localhost:${PORT}/admin/login`);
        console.log(`   Username: admin`);
        console.log(`   Password: admin123\n`);
    });
}

module.exports = { startAdminPanel, app };
