#!/bin/bash

# Smart Dashcam Development Script
# This script starts both the backend Python API and the frontend React app in development mode with hot reloading

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Create data directory if it doesn't exist
mkdir -p data

# Set environment variables for path configuration
export DASHCAM_BASE_PATH="$SCRIPT_DIR"
export DASHCAM_DATA_PATH="$SCRIPT_DIR/data"
export DASHCAM_DB_PATH="$SCRIPT_DIR/data/recordings.db"

# Add environment variable to indicate development mode
export DASHCAM_DEV_MODE="true"

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}


# Function to kill processes using specific ports
kill_port_processes() {
  local port=$1
  echo "Checking for processes using port $port..."
  
  # Try using lsof first (most reliable)
  if command_exists lsof; then
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
      echo "Found processes using port $port: $pids"
      echo "Terminating processes on port $port..."
      for pid in $pids; do
        echo "Killing process $pid"
        kill -15 $pid 2>/dev/null || kill -9 $pid 2>/dev/null
      done
      sleep 2
    fi
  # Fallback to fuser if lsof is not available
  elif command_exists fuser; then
    if fuser $port/tcp >/dev/null 2>&1; then
      echo "Found process using port $port, terminating..."
      fuser -k $port/tcp 2>/dev/null
      sleep 2
    fi
  # Last resort: try netstat with pkill
  else
    local pid=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1)
    if [ -n "$pid" ] && [ "$pid" != "-" ]; then
      echo "Found process $pid using port $port, terminating..."
      kill -15 $pid 2>/dev/null || kill -9 $pid 2>/dev/null
      sleep 2
    fi
  fi
}

# Check for required dependencies
echo "Checking dependencies..."

if ! command_exists python3; then
  echo "Error: Python 3 is required but not installed."
  exit 1
fi

if ! command_exists npm; then
  echo "Error: npm is required but not installed."
  exit 1
fi

# Install Python dependencies if needed
if [ ! -d "venv" ]; then
  echo "Setting up Python virtual environment..."
  python3 -m venv --system-site-packages venv 
  source venv/bin/activate
  pip install -r requirements.txt
  # Save requirements hash for future checks
  md5sum requirements.txt > .requirements_hash 2>/dev/null || shasum requirements.txt > .requirements_hash
else
  source venv/bin/activate
  
  # Check if requirements.txt has changed
  REQUIREMENTS_CHANGED=false
  if [ -f ".requirements_hash" ]; then
    if ! (md5sum -c .requirements_hash 2>/dev/null || shasum -c .requirements_hash 2>/dev/null) >/dev/null 2>&1; then
      REQUIREMENTS_CHANGED=true
    fi
  else
    REQUIREMENTS_CHANGED=true
  fi
  
  # Check for missing or outdated dependencies
  if [ "$REQUIREMENTS_CHANGED" = true ]; then
    echo "Requirements.txt has changed. Installing/updating dependencies..."
    pip install -r requirements.txt
    # Update requirements hash
    md5sum requirements.txt > .requirements_hash 2>/dev/null || shasum requirements.txt > .requirements_hash
  else
    # Quick check for missing dependencies
    echo "Checking for missing dependencies..."
    if ! pip check >/dev/null 2>&1; then
      echo "Some dependencies are missing or have conflicts. Reinstalling..."
      pip install -r requirements.txt
    fi
  fi
fi

# Install additional development dependencies if needed
echo "Checking for development dependencies..."
pip install watchdog pytest

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend
  npm install
  cd ..
fi

# Clean up any processes using our ports before starting
echo "Cleaning up any existing processes using development ports..."
kill_port_processes 8000
kill_port_processes 5173

# Check for port conflicts before starting servers
if netstat -tuln | grep LISTEN | grep -q ":8000 "; then
  echo "Error: Port 8000 is still in use after cleanup attempt."
  exit 1
fi

if netstat -tuln | grep LISTEN | grep -q ":5173 "; then
  echo "Error: Port 5173 is still in use after cleanup attempt."
  exit 1
fi

# Function to clean up on exit
cleanup() {
  echo "Shutting down development services..."
  
  # Matar procesos principales con más control
  if [ -n "$BACKEND_PID" ]; then
    echo "Deteniendo servidor backend (PID: $BACKEND_PID)..."
    # Intentar primero un cierre limpio, luego forzado
    kill -15 $BACKEND_PID 2>/dev/null || kill -9 $BACKEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null || true
  fi
  
  if [ -n "$FRONTEND_PID" ]; then
    echo "Deteniendo servidor frontend (PID: $FRONTEND_PID)..."
    kill -15 $FRONTEND_PID 2>/dev/null || kill -9 $FRONTEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null || true
  fi

  echo "Todos los recursos liberados."
  exit 0
}

# Set trap for clean exit
trap cleanup SIGINT SIGTERM

# Add Python path to ensure modules are found
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Start backend server with hot reloading
echo "Starting backend server in development mode with hot reloading..."
# Clear previous logs
> backend_dev_log.txt
cd backend

# Launch server with reload=True for hot reloading
python3 -c "
import sys
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('../backend_dev_log.txt')
    ]
)
logger = logging.getLogger('dashcam-dev')

try:
    logger.info('====== STARTING FASTAPI DEV SERVER WITH HOT RELOAD ======')
    print('Starting Uvicorn server on port 8000 with hot reload...')
    
    uvicorn.run(
        'main:app', 
        host='0.0.0.0', 
        port=8000, 
        log_level='info',
        reload=True,  # Enable hot reloading for development
        reload_dirs=['$SCRIPT_DIR/backend'],  # Watch this directory for changes
        timeout_keep_alive=120,  # Aumentar timeout para conexiones WebSocket persistentes
        # Configuración específica para WebSockets
        ws_max_size=16777216,  # 16MB para permitir transferencia de frames grandes
        ws_ping_interval=30.0,  # Enviar ping cada 30 segundos para mantener conexión
        ws_ping_timeout=60.0,   # Timeout para ping de 60 segundos
    )
except Exception as e:
    logger.critical(f'Fatal error starting Uvicorn: {e}', exc_info=True)
    print(f'Fatal error starting Uvicorn: {e}')
    sys.exit(1)
" &

BACKEND_PID=$!
cd ..

# Wait for backend to start before starting frontend
echo "Waiting for backend to start..."
MAX_WAIT=30
START_TIME=$(date +%s)
BACKEND_READY=false

while [ $(($(date +%s) - START_TIME)) -lt $MAX_WAIT ]; do
  # Check if backend process is still running
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Error: Backend process terminated unexpectedly."
    echo "Check the logs for more details:"
    echo "--- Last 20 lines of backend_dev_log.txt ---"
    tail -n 20 backend_dev_log.txt
    exit 1
  fi
  
  # Check if backend is responding
  if curl -s http://localhost:8000/api/system/status -m 1 > /dev/null; then
    BACKEND_READY=true
    break
  fi
  
  echo -n "."
  sleep 1
done

if [ "$BACKEND_READY" = false ]; then
  echo "Warning: Backend did not respond within $MAX_WAIT seconds, but continuing anyway."
  echo "It might still be starting up with hot reload enabled."
else
  echo "✓ Backend server running in development mode with hot reload (PID: $BACKEND_PID)"
fi

# Start frontend development server with hot module replacement
echo "Starting frontend development server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Check if frontend started successfully
sleep 3
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo "Error: Frontend server failed to start."
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo "✓ Frontend server running in development mode with hot reload (PID: $FRONTEND_PID)"

# Create info file
cat > dev_mode_info.txt << EOF
Development mode started: $(date)
Backend PID: $BACKEND_PID
Frontend PID: $FRONTEND_PID
EOF

echo ""
echo "==================================================="
echo "Smart Dashcam is running in DEVELOPMENT MODE!"
echo "Access the dashboard at: http://localhost:5173"
echo "API running at: http://localhost:8000"
echo ""
echo "Both frontend and backend will automatically reload"
echo "when you make changes to the source files."
echo ""
echo "Press Ctrl+C to stop all development services"
echo "==================================================="
echo ""

# Keep script running until Ctrl+C
while true; do
  # Check if both processes are still running
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Backend process terminated. Shutting down..."
    kill $FRONTEND_PID 2>/dev/null
    exit 1
  fi
  
  if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "Frontend process terminated. Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    exit 1
  fi
  
  sleep 2
done
