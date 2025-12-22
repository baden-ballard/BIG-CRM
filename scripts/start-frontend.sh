#!/bin/bash

echo "🛑 Stopping any running servers on port 3003..."
lsof -ti:3003 | xargs kill -9 2>/dev/null
pkill -f "tsx.*server.ts" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
sleep 2

echo "📦 Checking dependencies..."
if [ ! -d "node_modules/next" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "📝 Checking .env.local..."
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local..."
    node scripts/create-env-local.js
fi

echo "🚀 Starting Next.js dev server on port 3003..."
npm run dev


