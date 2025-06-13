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

# Function to kill existing processes
kill_existing_processes() {
  echo "Verificando y terminando procesos existentes..."
  
  # Kill existing backend processes
  echo "Terminando procesos backend existentes..."
  pkill -f "python3.*start_server.py" 2>/dev/null || true
  pkill -f "python3.*main.py" 2>/dev/null || true
  pkill -f "uvicorn" 2>/dev/null || true
  
  # Kill existing frontend processes
  echo "Terminando procesos frontend existentes..."
  pkill -f "npm.*preview" 2>/dev/null || true
  pkill -f "vite.*preview" 2>/dev/null || true
  pkill -f "node.*vite" 2>/dev/null || true
  
  # Kill processes using ports 8000 and 4173
  echo "Liberando puertos 8000 y 4173..."
  sudo lsof -ti:8000 | xargs sudo kill -9 2>/dev/null || true
  sudo lsof -ti:4173 | xargs sudo kill -9 2>/dev/null || true
  
  # Kill camera processes
  echo "Liberando cámaras..."
  sudo fuser -k /dev/video0 2>/dev/null || true
  sudo fuser -k /dev/video1 2>/dev/null || true
  sudo fuser -k /dev/vchiq 2>/dev/null || true
  
  # Kill ffmpeg and other video processes
  pkill -f "ffmpeg" 2>/dev/null || true
  pkill -f "v4l2" 2>/dev/null || true
  pkill -f "gstreamer" 2>/dev/null || true
  
  # Restart USB camera modules
  sudo rmmod uvcvideo 2>/dev/null || true
  sleep 1
  sudo modprobe uvcvideo 2>/dev/null || true
  
  echo "Esperando 3 segundos para que los procesos terminen completamente..."
  sleep 3
}

# Check for required dependencies
echo "Checking dependencies..."

# Kill existing processes first
kill_existing_processes

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

# Check for port conflicts before building frontend
if netstat -tuln | grep LISTEN | grep -q ":8000 "; then
  echo "Error: Puerto 8000 ya está en uso. Otro proceso podría estar bloqueándolo."
  echo "Intenta: sudo lsof -i :8000 para identificar el proceso."
  echo "O: sudo kill -9 \$(sudo lsof -t -i:8000) para forzar su cierre."
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
  
  # Si hay cámaras ocupadas, liberarlas automáticamente
  if [ "$CAMERAS_IN_USE" = true ]; then
    echo ""
    echo "⚠️ Algunas cámaras están siendo utilizadas por otros procesos."
    echo "Liberando cámaras automáticamente..."
    
    # Terminar procesos que usan dispositivos de video específicos
    sudo fuser -k /dev/video0 2>/dev/null || true
    sudo fuser -k /dev/vchiq 2>/dev/null || true
    
    # Reiniciar módulo USB para la cámara USB
    echo "Reiniciando módulo de cámara USB..."
    sudo rmmod uvcvideo 2>/dev/null || true
    sleep 1
    sudo modprobe uvcvideo 2>/dev/null || true
    sleep 2
    
    echo "✓ Liberación de cámaras completada."
  else
    echo "✓ Todas las cámaras están disponibles."
  fi
}

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
  kill $TAIL_PID 2>/dev/null
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

# Verificar uso de cámaras antes de iniciar
check_camera_usage

# Add Python path to ensure modules are found
export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Start backend server with better error handling
echo "Iniciando servidor backend..."
# Eliminar logs anteriores
> backend_log.txt
cd backend
# Lanzar el servidor - CAMBIADO PARA USAR start_server.py
python3 start_server.py > ../backend_log.txt 2>&1 &
BACKEND_PID=$!
cd ..

# Show backend logs in real time in background
echo "Mostrando logs del backend en tiempo real..."
tail -f backend_log.txt &
TAIL_PID=$!

# Poll until backend is ready or failed
echo "Esperando a que el servidor backend inicie..."
MAX_WAIT=120  # Increased from 60 to 120 seconds
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
    # Check for server startup progress in logs
    if grep -q "Started server process" backend_log.txt; then
      echo "El servidor ha iniciado el proceso, esperando a que esté listo..."
    elif grep -q "Waiting for application startup" backend_log.txt; then
      echo "Aplicación iniciando, casi lista..."
    elif grep -q "Application startup complete" backend_log.txt; then
      echo "Aplicación iniciada, esperando respuesta de API..."
    elif grep -q "INICIANDO SERVIDOR FASTAPI" backend_log.txt; then
      echo "FastAPI iniciándose..."
    elif grep -q "Error fatal al iniciar Uvicorn" backend_log.txt; then
      echo "Error: Falló el inicio de Uvicorn."
      echo "--- Últimas 20 líneas de backend_log.txt ---"
      tail -n 20 backend_log.txt
      kill $BACKEND_PID 2>/dev/null
      exit 1
    fi
  fi
  
  # Show progress more frequently
  echo -n "."
  sleep 0.5
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

# Start frontend production server
echo "Iniciando servidor frontend en modo producción..."
cd frontend
npm run preview -- --host 0.0.0.0 --port 4173 &
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
echo "Smart Dashcam está ejecutándose en modo PRODUCCIÓN!"
echo "Accede al panel en: http://localhost:4173"
echo "API en: http://localhost:8000"
echo "Los logs del servidor se muestran arriba en tiempo real"
echo "Presiona Ctrl+C para detener todos los servicios"
echo "==================================================="
echo ""

# Wait for processes to finish
wait $BACKEND_PID $FRONTEND_PID