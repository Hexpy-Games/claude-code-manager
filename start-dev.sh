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
echo "Starting services in current terminal..."
echo "- Backend server: http://localhost:3000"
echo "- Desktop app: Will launch automatically"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID $DESKTOP_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend server in background
echo "📦 Starting backend server..."
pnpm --filter @claude-code-manager/server dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start desktop app in background
echo "🖥️  Starting desktop app..."
cd apps/desktop && pnpm dev &
DESKTOP_PID=$!
cd ../..

echo ""
echo "✅ Services running!"
echo "   Backend PID: $BACKEND_PID"
echo "   Desktop PID: $DESKTOP_PID"
echo ""

# Wait for both processes
wait $BACKEND_PID $DESKTOP_PID
