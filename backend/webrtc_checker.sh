#!/bin/bash

# Script para verificar y reiniciar servicios WebRTC si es necesario
# Ejecutar con: bash webrtc_checker.sh

echo "Verificando servicios WebRTC..."

# Comprobar si hay procesos Python ejecutando aiortc
AIORTC_PROCESSES=$(ps aux | grep "[a]iortc" | wc -l)
echo "Procesos aiortc encontrados: $AIORTC_PROCESSES"

# Comprobar si el puerto 8000 está escuchando (API)
PORT_8000_ACTIVE=$(netstat -tuln | grep -c ":8000 ")
echo "Puerto 8000 activo: $PORT_8000_ACTIVE"

# Comprobar si hay puertos WebRTC activos (rangos típicos)
WEBRTC_PORTS=$(netstat -tuln | grep -c ":5[0-9][0-9][0-9][0-9]")
echo "Puertos WebRTC activos: $WEBRTC_PORTS"

# Verificar si hay problemas de recursos
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
echo "Uso de CPU: $CPU_USAGE%"

MEMORY_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')
echo "Uso de memoria: ${MEMORY_USAGE}%"

# Verificar errores en los logs relacionados con WebRTC
WEBRTC_ERRORS=$(grep -c "WebSocket.*error\|WebRTC.*error\|aiortc.*error" ../backend_dev_log.txt)
echo "Errores de WebRTC en logs: $WEBRTC_ERRORS"

echo ""
echo "Estado de las cámaras:"
# Verificar dispositivos de cámara
if [ -e "/dev/video0" ]; then
  # Intentar ver si la cámara está libre
  if timeout 1 cat /dev/video0 > /dev/null 2>&1; then
    echo "- /dev/video0: Disponible"
  else
    echo "- /dev/video0: En uso"
    echo "  Por procesos: $(fuser /dev/video0 2>/dev/null)"
  fi
else
  echo "- /dev/video0: No detectado"
fi

# Verificar PiCamera
if [ -e "/dev/vchiq" ]; then
  if timeout 1 cat /dev/vchiq > /dev/null 2>&1; then
    echo "- PiCamera: Disponible"
  else
    echo "- PiCamera: En uso"
  fi
else
  echo "- PiCamera: No detectado"
fi

echo ""
echo "¿Desea reiniciar los servicios WebRTC? (s/n)"
read -r REINICIAR

if [ "$REINICIAR" = "s" ]; then
  echo "Reiniciando servicios WebRTC..."
  
  # Matar procesos usando puertos relevantes
  sudo kill -9 $(sudo lsof -t -i:8000) 2>/dev/null || true
  
  # Matar cualquier proceso Python relacionado con aiortc
  for pid in $(ps aux | grep "[a]iortc" | awk '{print $2}'); do
    echo "Matando proceso aiortc: $pid"
    sudo kill -9 $pid 2>/dev/null || true
  done
  
  # Liberar recursos de cámara
  echo "Liberando recursos de cámara USB..."
  sudo fuser -k /dev/video0 2>/dev/null || true
  
  # Liberar PiCamera si existe
  if [ -e /dev/vchiq ]; then
    echo "Liberando recursos de PiCamera..."
    sudo fuser -k /dev/vchiq 2>/dev/null || true
  fi
  
  echo "Reiniciando el servidor..."
  cd ..
  ./dev.sh
fi

echo "Terminado."
