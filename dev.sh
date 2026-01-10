#!/bin/bash
#
# Universal Development Script for RiverHub
#
# This script works on both Raspberry Pi and development machines:
# - Auto-detects platform (Pi vs dev machine)
# - Sets RFID_MODE=real on Pi, RFID_MODE=mock on dev machines
# - Hot reloads Python backend changes (uvicorn --reload)
# - Starts frontend dev server
#
# Usage:
#   ./dev.sh
#

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

# Detect platform
detect_platform() {
    if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
        echo "pi"
    else
        echo "dev"
    fi
}

# Cleanup function
cleanup() {
    log "Shutting down..."

    # Get all background job PIDs
    local pids=$(jobs -p)

    if [ -n "$pids" ]; then
        # Send SIGTERM to all processes
        echo "$pids" | xargs kill 2>/dev/null || true

        # Wait up to 3 seconds for graceful shutdown
        local count=0
        while [ $count -lt 3 ] && jobs %% >/dev/null 2>&1; do
            sleep 1
            count=$((count + 1))
        done

        # Force kill any remaining processes
        echo "$pids" | xargs kill -9 2>/dev/null || true
    fi

    log_success "Cleanup complete"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Check prerequisites
check_prerequisites() {
    local missing=0

    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 not found. Please install Python 3"
        missing=1
    fi

    if ! command -v node &> /dev/null; then
        log_error "Node.js not found (required for frontend). Please install Node.js"
        missing=1
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm not found (required for frontend). Please install npm"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        exit 1
    fi
}

# Install backend dependencies
install_backend_deps() {
    log "Checking backend dependencies..."
    cd "$BACKEND_DIR"

    # Create Python virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        log "Creating Python virtual environment..."
        python3 -m venv venv
        log_success "✓ Virtual environment created"
    fi

    # Install main backend dependencies (FastAPI, SoCo, etc.)
    if [ ! -f "venv/.deps_installed" ] || [ "requirements.txt" -nt "venv/.deps_installed" ]; then
        log "Installing Python backend dependencies..."
        if venv/bin/pip install -r requirements.txt; then
            touch venv/.deps_installed
            log_success "✓ Backend Python dependencies installed"
        else
            log_error "Failed to install backend Python dependencies"
            exit 1
        fi
    else
        log "Backend Python dependencies up to date"
    fi

    # Install Pi-specific RFID hardware dependencies (only on Raspberry Pi)
    if [ "$PLATFORM" = "pi" ]; then
        if [ ! -f "venv/.deps_pi_installed" ] || [ "lib/rfid/requirements-pi.txt" -nt "venv/.deps_pi_installed" ]; then
            log "Installing Python dependencies (Raspberry Pi RFID hardware)..."
            if venv/bin/pip install -r lib/rfid/requirements-pi.txt; then
                touch venv/.deps_pi_installed
                log_success "✓ Raspberry Pi RFID hardware dependencies installed"
            else
                log_error "Failed to install Raspberry Pi RFID hardware dependencies"
                exit 1
            fi
        else
            log "Raspberry Pi RFID hardware dependencies up to date"
        fi
    fi
}

# Install frontend dependencies
install_frontend_deps() {
    log "Checking frontend dependencies..."
    cd "$FRONTEND_DIR"

    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        log "Installing frontend dependencies..."
        npm install
        log_success "✓ Frontend dependencies installed"
    else
        log "Frontend dependencies up to date"
    fi
}

# Main execution
main() {
    # Detect platform
    PLATFORM=$(detect_platform)

    if [ "$PLATFORM" = "pi" ]; then
        export RFID_MODE=real
        echo -e "${CYAN}"
        echo "╔════════════════════════════════════════════════════════╗"
        echo "║  🥧 Running on Raspberry Pi - Using real RFID hardware ║"
        echo "╚════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
    else
        export RFID_MODE=mock
        echo -e "${CYAN}"
        echo "╔════════════════════════════════════════════════════════╗"
        echo "║  💻 Running on dev machine - Using mock RFID           ║"
        echo "╚════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
    fi

    log "=== RiverHub Development Server ==="
    log ""

    # Check prerequisites
    check_prerequisites

    # Check directories
    if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Error: backend/ or frontend/ directory not found"
        log_error "Make sure you're running this from the project root"
        exit 1
    fi

    # Install dependencies
    install_backend_deps
    install_frontend_deps

    # Setup backend .env if it doesn't exist
    cd "$BACKEND_DIR"
    if [ ! -f .env ]; then
        log_warning ".env not found, creating from .env.example"
        cp .env.example .env
        log_success "✓ Created .env from .env.example"
        log_warning "⚠️  Review backend/.env and update SONOS_SPEAKER_NAME if needed"
    fi

    log ""
    log_success "=== Starting development servers ==="
    log ""

    # Start Python backend with uvicorn (hot reload enabled)
    cd "$BACKEND_DIR"
    log "Starting Python backend (FastAPI + uvicorn)..."
    log "  - Hot reload: Python files (*.py)"
    log "  - Port: 8765"
    venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8765 &
    BACKEND_PID=$!

    # Give backend a moment to start
    sleep 2

    # Start frontend dev server
    cd "$FRONTEND_DIR"
    log ""
    log "Starting frontend dev server (Vite)..."
    npm run dev &
    FRONTEND_PID=$!

    log ""
    log_success "=== Development servers running ==="
    log ""
    log "  Backend:  http://localhost:8765"
    log "  Frontend: http://localhost:5173 (or check Vite output above)"
    log "  Health:   http://localhost:8765/health"
    log "  WebSocket: ws://localhost:8765/ws"
    log ""
    log "  RFID Mode: ${RFID_MODE}"
    log ""
    log_warning "Press Ctrl+C to stop all servers"
    log ""

    # Wait for both processes
    wait $BACKEND_PID $FRONTEND_PID
}

main
