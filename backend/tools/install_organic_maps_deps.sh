#!/bin/bash

# Script para instalar dependencias necesarias para el procesamiento de archivos MWM de Organic Maps

echo "Instalando dependencias para el procesamiento de archivos MWM..."

# Verificar si se ejecuta como root (sudo)
if [ "$EUID" -ne 0 ]; then
  echo "Este script debe ejecutarse con permisos de superusuario (sudo)."
  echo "Por favor, ejecute: sudo $0"
  exit 1
fi

# Actualizar repositorios
echo "Actualizando repositorios..."
apt-get update

# Instalar dependencias críticas básicas
echo "Instalando dependencias básicas..."
apt-get install -y python3-pip python3-dev build-essential

# Instalar Pillow y sus dependencias para el procesamiento de imágenes
echo "Instalando dependencias para procesamiento de imágenes..."
apt-get install -y python3-pil libjpeg-dev zlib1g-dev

# Instalar dependencias para procesamiento de mapas
echo "Instalando dependencias para procesamiento de mapas..."
apt-get install -y python3-gdal gdal-bin

# Instalar dependencias para aiohttp y otras librerías
echo "Instalando dependencias para networking y procesamiento asíncrono..."
apt-get install -y python3-aiohttp python3-asyncio python3-bs4

# Instalar dependencias para scripts Python
echo "Instalando librerías Python adicionales..."
pip3 install --upgrade pip
pip3 install pillow geojson shapely pyproj aiohttp[speedups] bs4

# Crear estructura de directorios para mapas offline
echo "Creando estructura de directorios para mapas offline..."
mkdir -p data/organic_maps
mkdir -p data/organic_maps/cache

# Crear un archivo de prueba para verificar permisos
echo "Verificando permisos de escritura..."
touch data/organic_maps/test_file.txt
if [ $? -ne 0 ]; then
  echo "ADVERTENCIA: No se pudo escribir en el directorio de datos. Ajustando permisos..."
  chown -R $(whoami) data/
  chmod -R 755 data/
fi

# Crear un archivo de regiones por defecto para fallback
echo "Creando archivo de regiones por defecto..."
cat > data/organic_maps/default_regions.json << EOL
{
  "timestamp": "$(date -Iseconds)",
  "regions": [
    {
      "id": "USA",
      "name": "United States",
      "size_mb": 1024,
      "mwm_url": "https://omaps.wfr.software/maps/250511/USA.mwm",
      "map_version": "250511"
    },
    {
      "id": "US_California",
      "name": "US California",
      "size_mb": 450,
      "mwm_url": "https://omaps.wfr.software/maps/250511/US_California.mwm",
      "map_version": "250511"
    },
    {
      "id": "US_Arizona",
      "name": "US Arizona",
      "size_mb": 250,
      "mwm_url": "https://omaps.wfr.software/maps/250511/US_Arizona.mwm",
      "map_version": "250511"
    },
    {
      "id": "US_Nevada",
      "name": "US Nevada",
      "size_mb": 200,
      "mwm_url": "https://omaps.wfr.software/maps/250511/US_Nevada.mwm",
      "map_version": "250511"
    },
    {
      "id": "World",
      "name": "World",
      "size_mb": 2048,
      "mwm_url": "https://omaps.wfr.software/maps/250511/World.mwm",
      "map_version": "250511"
    }
  ]
}
EOL

echo "Verificando conectividad con el servidor de mapas..."
curl -s --head https://omaps.wfr.software/maps/250511/ > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Conexión exitosa con el servidor de mapas."
else
  echo "⚠ No se pudo conectar con el servidor de mapas. Verificar configuración de red."
fi

echo "Instalación completada."
echo "Puede usar ahora la funcionalidad de Organic Maps en la aplicación."

exit 0
