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
else
  source venv/bin/activate
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

# Check for port conflicts before starting servers
if netstat -tuln | grep LISTEN | grep -q ":8000 "; then
  echo "Error: Port 8000 is already in use. Another process might be blocking it."
  echo "Try: sudo lsof -i :8000 to identify the process."
  echo "Or: sudo kill -9 \$(sudo lsof -t -i:8000) to forcibly close it."
  exit 1
fi

if netstat -tuln | grep LISTEN | grep -q ":5173 "; then
  echo "Error: Port 5173 is already in use. This port is needed for Vite dev server."
  echo "Try: sudo lsof -i :5173 to identify the process."
  echo "Or: sudo kill -9 \$(sudo lsof -t -i:5173) to forcibly close it."
  exit 1
fi

# Function to check if cameras are in use
check_camera_usage() {
  echo "Verificando si las cámaras están ocupadas..."
  CAMERAS_IN_USE=false
  
  # Solo verificar video0 (cámara interior USB)
  if [ -e "/dev/video0" ]; then
    # Intentar abrir el dispositivo sin bloqueo
    if ! timeout 1 cat "/dev/video0" > /dev/null 2>&1; then
      echo "⚠️ /dev/video0 parece estar en uso"
      USING_PROCESSES=$(sudo fuser -v "/dev/video0" 2>/dev/null)
      if [ -n "$USING_PROCESSES" ]; then
        echo "  Procesos usando /dev/video0:"
        sudo fuser -v "/dev/video0" 2>/dev/null | awk '{print $2}' | while read PID; do
          if [ -n "$PID" ] && [ "$PID" -eq "$PID" ] 2>/dev/null; then  # Verificar que es un número
            CMD=$(ps -p "$PID" -o comm= 2>/dev/null)
            echo "  - PID $PID ($CMD)"
          fi
        done
      fi
      CAMERAS_IN_USE=true
    else
      echo "✓ /dev/video0 está disponible"
    fi
  else
    echo "⚠️ /dev/video0 no existe - cámara USB no detectada"
  fi
  
  # Verificar si PiCamera (CSI) está en uso
  if [ -e /dev/vchiq ]; then
    if ! timeout 1 cat /dev/vchiq > /dev/null 2>&1; then
      echo "⚠️ La cámara CSI (PiCamera) parece estar en uso"
      CAMERAS_IN_USE=true
    else
      echo "✓ La cámara CSI (PiCamera) está disponible"
    fi
  else
    echo "⚠️ /dev/vchiq no existe - PiCamera no detectada"
  fi
  
  # Si hay cámaras ocupadas, ofrecer opciones
  if [ "$CAMERAS_IN_USE" = true ]; then
    echo ""
    echo "⚠️ Algunas cámaras parecen estar siendo utilizadas por otros procesos."
    echo "Esto podría causar problemas al iniciar la aplicación."
    echo ""
    echo "Opciones:"
    echo "1) Intentar liberar las cámaras automáticamente"
    echo "2) Continuar de todos modos"
    echo "3) Salir"
    echo ""
    read -p "¿Qué deseas hacer? (1/2/3): " CAM_OPTION
    
    case "$CAM_OPTION" in
      1)
        echo "Intentando liberar cámaras..."
        # Terminar procesos que usan dispositivos de video específicos
        sudo fuser -k /dev/video0 2>/dev/null
        # Reiniciar módulo USB para la cámara USB
        sudo rmmod uvcvideo 2>/dev/null || true
        sleep 1
        sudo modprobe uvcvideo 2>/dev/null || true
        sleep 2
        echo "Reinicio de cámaras completado."
        ;;
      2)
        echo "Continuando con cámaras ocupadas..."
        ;;
      3|*)
        echo "Saliendo..."
        exit 1
        ;;
    esac
  fi
}

# Function to clean up on exit
cleanup() {
  echo "Shutting down development services..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  exit 0
}

# Set trap for clean exit
trap cleanup SIGINT SIGTERM

# Verificar permisos de cámara
if [ -c /dev/vchiq ]; then
  echo "Verificando permisos de cámara..."
  if ! groups | grep -q "video"; then
    echo "Advertencia: El usuario actual podría no tener acceso a la cámara."
    echo "Considera ejecutar con: sudo -u pi ./dev.sh o agregar tu usuario al grupo video."
  else
    echo "El usuario tiene permisos del grupo video ✓"
  fi
fi

# Verificar uso de cámaras antes de iniciar
check_camera_usage

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