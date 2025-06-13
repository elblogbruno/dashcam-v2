#!/bin/bash
# Script para instalar todas las dependencias necesarias para el proyecto dashcam-v2
# Uso: bash install_all.sh

set -e

# 1. Instalar dependencias del sistema (si es necesario)
echo "[1/4] Verificando dependencias del sistema..."
if ! command -v python3 &> /dev/null; then
    echo "Python3 no está instalado. Por favor, instálalo manualmente."
    exit 1
fi
if ! command -v pip3 &> /dev/null; then
    echo "pip3 no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y python3-pip
fi

# Verificar e instalar python3-venv
if ! python3 -m venv --help &> /dev/null; then
    echo "python3-venv no está disponible. Instalando..."
    sudo apt-get update && sudo apt-get install -y python3.11-venv
fi

if ! command -v node &> /dev/null; then
    echo "Node.js no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y nodejs npm
fi
if ! command -v npm &> /dev/null; then
    echo "npm no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y npm
fi

sudo apt-get install libhdf5-dev -y
sudo apt install gcc g++ python3-dev build-essential -y
sudo apt install python3-gpiozero -y

# we need to install ffmpeg using dietpi's package manager
if ! command -v ffmpeg &> /dev/null; then
    echo "ffmpeg no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y ffmpeg
fi

#install espeak if it is not installed
if ! command -v espeak &> /dev/null; then
    echo "espeak no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y espeak
fi

if ! command -v espeak-ng &> /dev/null; then
    echo "espeak-ng no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y espeak-ng
fi

# 2. Instalar picamera si es necesario (antes de crear el entorno virtual)
echo "[2/5] Verificando e instalando picamera..."
if python3 -c "import picamera" &> /dev/null; then
    echo "picamera ya está instalado."
else
    echo "Instalando picamera..."
    sudo apt install python3-picamera2 --no-install-recommends 
fi

# 3. Crear entorno virtual de Python
cd "$(dirname "$0")"
echo "[3/5] Creando entorno virtual de Python..."
if [ ! -d "venv" ]; then
    python3 -m venv --system-site-packages venv 
fi
source venv/bin/activate

# 4. Instalar dependencias de Python
if [ -f requirements.txt ]; then
    echo "[4/5] Instalando dependencias de Python..."
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "No se encontró requirements.txt. Skipping Python dependencies."
fi

deactivate

# 5. Instalar dependencias de Node.js para el frontend
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    echo "[5/5] Instalando dependencias de Node.js en frontend..."
    cd frontend
    npm install
    cd ..
else
    echo "No se encontró la carpeta frontend o package.json. Skipping frontend dependencies."
fi

# 6. Ejecutar script de instalación de drivers ReSpeaker
if [ -f "scripts/install-respeaker-drivers.sh" ]; then
    echo "[6/6] Ejecutando instalación de drivers ReSpeaker..."
    chmod +x scripts/install-respeaker-drivers.sh
    ./scripts/install-respeaker-drivers.sh
else
    echo "No se encontró scripts/install-respeaker-drivers.sh. Skipping ReSpeaker drivers."
fi

echo "\n¡Instalación completa! Usa 'source venv/bin/activate' para activar el entorno Python."