#!/bin/bash

# Simple start script for the Telegram bot

echo "🤖 Starting Telegram Bot for Academi.cx..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    echo "Please create .env file:"
    echo "  cp .env.example .env"
    echo ""
    echo "Then add your bot token to .env"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check token
echo "🔍 Checking bot token..."
npm test
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Token check failed. Please verify your token in .env"
    exit 1
fi

echo ""
echo "✅ Token is valid!"
echo ""
echo "🚀 Starting bot..."
echo ""

# Start the bot
npm start
