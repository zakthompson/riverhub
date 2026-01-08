#!/bin/bash
#
# Development watch script for Raspberry Pi
#
# This script runs on the Pi and:
# - Serves the production backend with static files
# - Rebuilds the frontend on any source changes
# - Restarts the backend on any backend changes
#
# Prerequisites:
#   sudo apt-get install inotify-tools
#
# Usage:
#   ./dev-pi.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOG_FILE="/tmp/riverhub-dev.log"
BACKEND_PID_FILE="/tmp/riverhub-backend.pid"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} $1"
}

# Check prerequisites
if ! command -v inotifywait &> /dev/null; then
    log_error "inotifywait not found. Please install: sudo apt-get install inotify-tools"
    exit 1
fi

# Cleanup function
cleanup() {
    log "Shutting down..."
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            log "Stopping backend server (PID: $BACKEND_PID)"
            kill "$BACKEND_PID"
            wait "$BACKEND_PID" 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    log_success "Cleanup complete"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Setup Python virtual environment
setup_python_venv() {
    log "Setting up Python virtual environment..."
    cd "$BACKEND_DIR"

    if [ ! -d "venv" ]; then
        log "Creating virtual environment..."
        if python3 -m venv venv >> "$LOG_FILE" 2>&1; then
            log_success "✓ Virtual environment created"
        else
            log_error "✗ Failed to create venv (see $LOG_FILE)"
            return 1
        fi
    else
        log "Virtual environment exists"
    fi

    # Check if dependencies need to be installed
    if [ ! -f "venv/.deps_installed" ] || [ "requirements.txt" -nt "venv/.deps_installed" ]; then
        log "Installing Python dependencies..."
        if venv/bin/pip install -q -r requirements.txt >> "$LOG_FILE" 2>&1; then
            touch venv/.deps_installed
            log_success "✓ Python dependencies installed"
            return 0
        else
            log_error "✗ pip install failed (see $LOG_FILE)"
            return 1
        fi
    else
        log "Python dependencies up to date"
        return 0
    fi
}

# Install frontend dependencies
install_frontend_deps() {
    log "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"

    # Check if node_modules exists and is up to date
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
        log "Running npm install..."
        if npm install >> "$LOG_FILE" 2>&1; then
            log_success "✓ Dependencies installed"
            return 0
        else
            log_error "✗ npm install failed (see $LOG_FILE)"
            return 1
        fi
    else
        log "Dependencies up to date"
        return 0
    fi
}

# Build frontend
build_frontend() {
    log "Building frontend..."
    cd "$FRONTEND_DIR"
    if npm run build >> "$LOG_FILE" 2>&1; then
        log_success "✓ Frontend build complete"
        return 0
    else
        log_error "✗ Frontend build failed (see $LOG_FILE)"
        return 1
    fi
}

# Start backend server
start_backend() {
    log "Starting backend server..."

    # Kill existing backend if running
    if [ -f "$BACKEND_PID_FILE" ]; then
        OLD_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            log "Stopping old backend (PID: $OLD_PID)"
            kill "$OLD_PID"
            wait "$OLD_PID" 2>/dev/null || true
        fi
    fi

    cd "$BACKEND_DIR"

    # Ensure .env exists
    if [ ! -f .env ]; then
        log_warning ".env not found, creating from .env.example"
        cp .env.example .env
        # Set production defaults for Pi
        sed -i 's/SERVE_STATIC=false/SERVE_STATIC=true/' .env
        sed -i 's/RFID_MODE=mock/RFID_MODE=real/' .env
    fi

    # Start server using venv python directly
    venv/bin/python main.py >> "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

    # Wait a moment and check if it started successfully
    sleep 2
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        log_success "✓ Backend server started (PID: $BACKEND_PID)"
        log_success "➜ Access the app at http://$(hostname -I | awk '{print $1}'):8765"
        return 0
    else
        log_error "✗ Backend server failed to start (see $LOG_FILE)"
        rm -f "$BACKEND_PID_FILE"
        return 1
    fi
}

# Restart backend
restart_backend() {
    log "Restarting backend due to code changes..."
    start_backend
}

# Watch for changes
watch_changes() {
    log "Watching for file changes..."
    log "  - Backend: $BACKEND_DIR"
    log "  - Backend deps: $BACKEND_DIR/requirements.txt"
    log "  - Frontend: $FRONTEND_DIR/src"
    log "  - Frontend deps: $FRONTEND_DIR/package.json"
    log ""

    # Use inotifywait to watch for changes
    while true; do
        # Watch backend directory for Python file changes
        inotifywait -q -r -e modify,create,delete \
            --exclude '(__pycache__|\.pyc$|venv|\.env)' \
            "$BACKEND_DIR" &
        BACKEND_WATCH_PID=$!

        # Watch backend requirements.txt for dependency changes
        inotifywait -q -e modify \
            "$BACKEND_DIR/requirements.txt" &
        BACKEND_DEPS_WATCH_PID=$!

        # Watch frontend src directory for changes
        inotifywait -q -r -e modify,create,delete \
            --exclude '(node_modules|dist|\.vite|package-lock\.json)' \
            "$FRONTEND_DIR/src" \
            "$FRONTEND_DIR/index.html" \
            "$FRONTEND_DIR/vite.config.ts" \
            "$FRONTEND_DIR/tailwind.config.js" &
        FRONTEND_WATCH_PID=$!

        # Watch frontend package.json for dependency changes
        inotifywait -q -e modify \
            "$FRONTEND_DIR/package.json" &
        FRONTEND_DEPS_WATCH_PID=$!

        # Wait for any watcher to detect changes
        wait -n $BACKEND_WATCH_PID $BACKEND_DEPS_WATCH_PID $FRONTEND_WATCH_PID $FRONTEND_DEPS_WATCH_PID

        # Kill the other watchers
        kill $BACKEND_WATCH_PID 2>/dev/null || true
        kill $BACKEND_DEPS_WATCH_PID 2>/dev/null || true
        kill $FRONTEND_WATCH_PID 2>/dev/null || true
        kill $FRONTEND_DEPS_WATCH_PID 2>/dev/null || true
        wait 2>/dev/null || true

        # Determine what changed based on which process finished first
        if ! ps -p $BACKEND_WATCH_PID > /dev/null 2>&1; then
            log_warning "Backend files changed"
            restart_backend
        elif ! ps -p $BACKEND_DEPS_WATCH_PID > /dev/null 2>&1; then
            log_warning "requirements.txt changed - reinstalling Python dependencies"
            if setup_python_venv; then
                restart_backend
            fi
        elif ! ps -p $FRONTEND_DEPS_WATCH_PID > /dev/null 2>&1; then
            log_warning "package.json changed - reinstalling npm dependencies"
            if install_frontend_deps && build_frontend; then
                restart_backend
            fi
        else
            log_warning "Frontend files changed"
            if build_frontend; then
                restart_backend
            fi
        fi

        # Small delay to avoid rapid restarts
        sleep 1
    done
}

# Main execution
main() {
    log "=== RiverHub Development Server (Raspberry Pi) ==="
    log ""

    # Check that we're in the right directory
    if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Error: backend/ or frontend/ directory not found"
        log_error "Make sure you're running this from the project root"
        exit 1
    fi

    # Clear log file
    : > "$LOG_FILE"

    # Initial build and start
    log "Performing initial setup..."

    # Setup Python virtual environment and dependencies
    if ! setup_python_venv; then
        log_error "Failed to setup Python environment. Exiting."
        exit 1
    fi

    # Install frontend dependencies if needed
    if ! install_frontend_deps; then
        log_error "Failed to install frontend dependencies. Exiting."
        exit 1
    fi

    if ! build_frontend; then
        log_error "Initial frontend build failed. Exiting."
        exit 1
    fi

    if ! start_backend; then
        log_error "Failed to start backend. Exiting."
        exit 1
    fi

    log ""
    log_success "=== Development server is running ==="
    log "Server logs: tail -f $LOG_FILE"
    log "Press Ctrl+C to stop"
    log ""

    # Start watching for changes
    watch_changes
}

main
