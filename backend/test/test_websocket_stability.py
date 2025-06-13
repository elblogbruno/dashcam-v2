#!/usr/bin/env python3
"""
Script para probar la estabilidad de la conexión WebSocket durante operaciones largas.
Este script simula una descarga larga de geodata y monitorea las conexiones WebSocket.
"""

import asyncio
import websockets
import json
import time
import logging
import sys
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WebSocketTester:
    def __init__(self, uri="ws://localhost:8000/ws"):
        self.uri = uri
        self.websocket = None
        self.received_messages = []
        self.ping_count = 0
        self.pong_count = 0
        self.is_running = False
        
    async def connect(self):
        """Conectar al WebSocket"""
        try:
            self.websocket = await websockets.connect(self.uri)
            logger.info(f"✓ Conectado a {self.uri}")
            return True
        except Exception as e:
            logger.error(f"❌ Error conectando a {self.uri}: {e}")
            return False
    
    async def send_ping(self):
        """Enviar ping al servidor"""
        if self.websocket:
            try:
                await self.websocket.send("ping")
                self.ping_count += 1
                logger.info(f"📤 Ping enviado #{self.ping_count}")
            except Exception as e:
                logger.error(f"❌ Error enviando ping: {e}")
    
    async def listen_for_messages(self):
        """Escuchar mensajes del servidor"""
        try:
            while self.is_running and self.websocket:
                try:
                    message = await asyncio.wait_for(self.websocket.recv(), timeout=5.0)
                    await self.handle_message(message)
                except asyncio.TimeoutError:
                    # Timeout normal, continuar
                    continue
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("🔌 Conexión WebSocket cerrada por el servidor")
                    break
        except Exception as e:
            logger.error(f"❌ Error escuchando mensajes: {e}")
    
    async def handle_message(self, message):
        """Manejar mensajes recibidos"""
        if message == "pong":
            self.pong_count += 1
            logger.info(f"📥 Pong recibido #{self.pong_count}")
        elif message == "ping":
            # Responder con pong
            await self.websocket.send("pong")
            logger.info(f"📤 Respondiendo pong a ping del servidor")
        else:
            try:
                data = json.loads(message)
                logger.info(f"📨 Mensaje JSON recibido: {data.get('type', 'unknown')}")
                self.received_messages.append(data)
            except json.JSONDecodeError:
                logger.info(f"📨 Mensaje de texto recibido: {message[:100]}...")
    
    async def periodic_ping(self, interval=15):
        """Enviar pings periódicos"""
        while self.is_running:
            await self.send_ping()
            await asyncio.sleep(interval)
    
    async def simulate_long_operation(self, duration=300):
        """Simular una operación larga (como descarga de geodata)"""
        logger.info(f"🔄 Iniciando operación larga de {duration} segundos...")
        start_time = time.time()
        
        while self.is_running and (time.time() - start_time) < duration:
            # Simular trabajo
            await asyncio.sleep(10)
            elapsed = time.time() - start_time
            logger.info(f"⏱️  Operación en progreso: {elapsed:.1f}s / {duration}s")
        
        logger.info("✅ Operación larga completada")
    
    async def run_test(self, test_duration=300):
        """Ejecutar prueba completa"""
        logger.info("🚀 Iniciando prueba de estabilidad WebSocket")
        
        if not await self.connect():
            return False
        
        self.is_running = True
        
        try:
            # Crear tareas concurrentes
            tasks = [
                asyncio.create_task(self.listen_for_messages()),
                asyncio.create_task(self.periodic_ping(15)),  # Ping cada 15 segundos
                asyncio.create_task(self.simulate_long_operation(test_duration))
            ]
            
            # Ejecutar todas las tareas
            await asyncio.gather(*tasks, return_exceptions=True)
            
        except KeyboardInterrupt:
            logger.info("🛑 Prueba interrumpida por usuario")
        finally:
            self.is_running = False
            if self.websocket:
                await self.websocket.close()
            
            # Mostrar estadísticas
            self.show_stats()
    
    def show_stats(self):
        """Mostrar estadísticas de la prueba"""
        logger.info("📊 ESTADÍSTICAS DE LA PRUEBA:")
        logger.info(f"   Pings enviados: {self.ping_count}")
        logger.info(f"   Pongs recibidos: {self.pong_count}")
        logger.info(f"   Mensajes JSON recibidos: {len(self.received_messages)}")
        
        if self.ping_count > 0:
            success_rate = (self.pong_count / self.ping_count) * 100
            logger.info(f"   Tasa de éxito ping/pong: {success_rate:.1f}%")
        
        if self.pong_count == self.ping_count and self.ping_count > 0:
            logger.info("✅ PRUEBA EXITOSA: Conexión WebSocket estable")
        else:
            logger.warning("⚠️  PRUEBA CON PROBLEMAS: Algunas desconexiones detectadas")

async def main():
    """Función principal"""
    print("🧪 PROBADOR DE ESTABILIDAD WEBSOCKET")
    print("=====================================")
    print("Este script probará la estabilidad de la conexión WebSocket")
    print("durante una operación larga simulada.")
    print()
    
    # Configuración
    duration = 180  # 3 minutos por defecto
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            print("❌ Duración debe ser un número en segundos")
            return
    
    print(f"⏱️  Duración de la prueba: {duration} segundos")
    print("🔧 Configuración:")
    print("   - Pings del cliente cada 15 segundos")
    print("   - Timeout de pong: 10 segundos")
    print("   - El servidor debería enviar pings cada 20 segundos")
    print()
    
    tester = WebSocketTester()
    await tester.run_test(duration)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Prueba interrumpida")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        sys.exit(1)
