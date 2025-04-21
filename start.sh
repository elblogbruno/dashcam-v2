#!/bin/bash

# Smart Dashcam Startup Script
# This script starts both the backend Python API and the frontend React app

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Create data directory if it doesn't exist
mkdir -p data

# Set environment variables for path configuration
export DASHCAM_BASE_PATH="$SCRIPT_DIR"
export DASHCAM_DATA_PATH="$SCRIPT_DIR/data"
export DASHCAM_DB_PATH="$SCRIPT_DIR/data/recordings.db"

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

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend
  npm install
  cd ..
fi

# Build frontend for production
echo "Building frontend..."
cd frontend
npm run build
cd ..

# Function to clean up on exit
cleanup() {
  echo "Shutting down services..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  exit 0
}

# Set trap for clean exit
trap cleanup SIGINT SIGTERM

# Check for port conflicts
if netstat -tuln | grep LISTEN | grep -q ":8000 "; then
  echo "Error: Puerto 8000 ya está en uso. Otro proceso podría estar bloqueándolo."
  echo "Intenta: sudo lsof -i :8000 para identificar el proceso."
  echo "O: sudo kill -9 \$(sudo lsof -t -i:8000) para forzar su cierre."
  exit 1
fi

# Verificar permisos de cámara
if [ -c /dev/vchiq ]; then
  echo "Verificando permisos de cámara..."
  if ! groups | grep -q "video"; then
    echo "Advertencia: El usuario actual podría no tener acceso a la cámara."
    echo "Considera ejecutar con: sudo -u pi ./start.sh o agregar tu usuario al grupo video."
  else
    echo "El usuario tiene permisos del grupo video ✓"
  fi
fi

# Start backend server with better error handling
echo "Iniciando servidor backend..."
# Eliminar logs anteriores
> backend_log.txt
cd backend
# Lanzar el servidor
python3 main.py > ../backend_log.txt 2>&1 &
BACKEND_PID=$!
cd ..

# Poll until backend is ready or failed
echo "Esperando a que el servidor backend inicie..."
MAX_WAIT=30 # 30 segundos
START_TIME=$(date +%s)
BACKEND_READY=false

while [ $(($(date +%s) - START_TIME)) -lt $MAX_WAIT ]; do
  # Check if backend process is still running
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Error: El proceso del backend terminó inesperadamente."
    echo "Revisa los logs para más detalles:"
    echo "--- Últimas 20 líneas de backend_log.txt ---"
    tail -n 20 backend_log.txt
    exit 1
  fi
  
  # Check if backend is responding on port 8000
  if curl -s http://localhost:8000/api/system/status -m 1 > /dev/null; then
    BACKEND_READY=true
    break
  else
    # Check logs for useful information
    if grep -q "Iniciando servidor Uvicorn en puerto 8000" backend_log.txt; then
      echo "El servidor Uvicorn ha iniciado, esperando a que esté listo..."
    elif grep -q "Error fatal al iniciar Uvicorn" backend_log.txt; then
      echo "Error: Falló el inicio de Uvicorn."
      echo "--- Últimas 20 líneas de backend_log.txt ---"
      tail -n 20 backend_log.txt
      kill $BACKEND_PID 2>/dev/null
      exit 1
    fi
  fi
  
  echo -n "."
  sleep 1
done

if [ "$BACKEND_READY" = false ]; then
  echo "Error: El backend no respondió después de $MAX_WAIT segundos."
  echo "--- Últimas 20 líneas de backend_log.txt ---"
  tail -n 20 backend_log.txt
  echo "--- Verificando si el puerto 8000 está en uso ---"
  netstat -tuln | grep LISTEN | grep ":8000 "
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo "✓ Servidor backend ejecutándose (PID: $BACKEND_PID)"

# Start frontend development server
echo "Iniciando servidor frontend..."
cd frontend
npm run preview &
FRONTEND_PID=$!
cd ..

# Check if frontend started successfully
sleep 3
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo "Error: El servidor frontend falló al iniciar."
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo "✓ Servidor frontend ejecutándose (PID: $FRONTEND_PID)"

# Create info file in case of need
cat > running_info.txt << EOF
Fecha de inicio: $(date)
Backend PID: $BACKEND_PID
Frontend PID: $FRONTEND_PID
EOF

echo ""
echo "==================================================="
echo "Smart Dashcam está ejecutándose!"
echo "Accede al panel en: http://localhost:4173"
echo "API en: http://localhost:8000"
echo "Presiona Ctrl+C para detener todos los servicios"
echo "==================================================="
echo ""

# Wait for processes to finish
wait $BACKEND_PID $FRONTEND_PID