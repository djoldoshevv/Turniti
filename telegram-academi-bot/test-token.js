require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

/**
 * Simple script to test if your Telegram bot token is valid
 * Run: node test-token.js
 */

// Get token from environment or prompt
const token = process.env.TELEGRAM_BOT_TOKEN || process.argv[2];

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    console.error('❌ Error: No bot token provided!');
    console.log('\nUsage:');
    console.log('  TELEGRAM_BOT_TOKEN=your_token node test-token.js');
    console.log('  OR');
    console.log('  node test-token.js your_token');
    console.log('\nMake sure you have created a .env file with your token.');
    process.exit(1);
}

console.log('🔍 Testing bot token...\n');

// Create bot instance (no polling)
const bot = new TelegramBot(token);

// Test the token by getting bot info
bot.getMe()
    .then(botInfo => {
        console.log('✅ Bot token is valid!\n');
        console.log('Bot Information:');
        console.log('─'.repeat(40));
        console.log(`  ID: ${botInfo.id}`);
        console.log(`  Name: ${botInfo.first_name}`);
        console.log(`  Username: @${botInfo.username}`);
        console.log(`  Can join groups: ${botInfo.can_join_groups}`);
        console.log(`  Can read messages: ${botInfo.can_read_all_group_messages}`);
        console.log('─'.repeat(40));
        console.log('\n🎉 Your bot is ready to use!');
        console.log(`\nFind your bot in Telegram: https://t.me/${botInfo.username}`);
        console.log('\nNext steps:');
        console.log('  1. Start your bot: npm start');
        console.log('  2. Open Telegram and search for @' + botInfo.username);
        console.log('  3. Send /start to begin\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error: Invalid bot token or network issue\n');
        console.error('Details:', error.message);
        console.log('\nPlease check:');
        console.log('  1. Token is correct (get it from @BotFather)');
        console.log('  2. Internet connection is working');
        console.log('  3. No firewall blocking Telegram API\n');
        process.exit(1);
    });
