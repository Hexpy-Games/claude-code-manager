#!/bin/bash

# Claude Code Manager - Development Startup Script

echo "🚀 Starting Claude Code Manager..."

# Check if Claude Code CLI is installed
if ! command -v claude &> /dev/null; then
    echo "❌ Error: Claude Code CLI not found"
    echo "Please install it first:"
    echo "  npm install -g @anthropic-ai/claude-code"
    echo ""
    echo "Then configure your API key:"
    echo "  claude configure"
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
fi

echo "✅ Environment configured"
echo ""
echo "Starting services..."
echo "- Backend server: http://localhost:3000"
echo "- Desktop app: Will launch automatically"
echo ""
echo "📝 Note: This will open 2 terminal windows"
echo "   - Window 1: Backend server"
echo "   - Window 2: Desktop app"
echo ""

# Start backend server in new terminal
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && pnpm --filter @claude-code-manager/server dev"'

# Wait a bit for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Start desktop app in new terminal
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/apps/desktop && pnpm dev"'

echo "✅ Services starting..."
echo ""
echo "To stop:"
echo "  - Press Ctrl+C in each terminal window"
echo "  - Or run: pkill -f 'pnpm.*dev'"
