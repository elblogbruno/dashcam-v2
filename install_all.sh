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
if ! command -v node &> /dev/null; then
    echo "Node.js no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y nodejs npm
fi
if ! command -v npm &> /dev/null; then
    echo "npm no está instalado. Instalando..."
    sudo apt-get update && sudo apt-get install -y npm
fi

# 2. Crear entorno virtual de Python
cd "$(dirname "$0")"
echo "[2/4] Creando entorno virtual de Python..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# 3. Instalar dependencias de Python
if [ -f requirements.txt ]; then
    echo "[3/4] Instalando dependencias de Python..."
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "No se encontró requirements.txt. Skipping Python dependencies."
fi

deactivate

# 4. Instalar dependencias de Node.js para el frontend
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    echo "[4/4] Instalando dependencias de Node.js en frontend..."
    cd frontend
    npm install
    cd ..
else
    echo "No se encontró la carpeta frontend o package.json. Skipping frontend dependencies."
fi

echo "\n¡Instalación completa! Usa 'source venv/bin/activate' para activar el entorno Python."
