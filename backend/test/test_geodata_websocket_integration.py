#!/usr/bin/env python3
"""
Script para probar específicamente la descarga de geodata con WebSocket estable.
Simula una descarga real de geodata y monitorea la estabilidad de la conexión.
"""

import asyncio
import aiohttp
import websockets
import json
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_geodata_download_with_websocket():
    """Probar descarga de geodata con monitoreo de WebSocket"""
    
    # Configuración de prueba
    websocket_uri = "ws://localhost:8000/ws"
    api_base = "http://localhost:8000/api"
    test_waypoints = [
        {"lat": 40.7128, "lon": -74.0060, "name": "New York"},
        {"lat": 34.0522, "lon": -118.2437, "name": "Los Angeles"},
        {"lat": 41.8781, "lon": -87.6298, "name": "Chicago"}
    ]
    
    websocket_messages = []
    websocket_connected = False
    
    async def websocket_monitor():
        """Monitor WebSocket durante la descarga"""
        nonlocal websocket_connected, websocket_messages
        
        try:
            async with websockets.connect(websocket_uri) as ws:
                websocket_connected = True
                logger.info("🔌 WebSocket conectado - iniciando monitoreo")
                
                ping_count = 0
                pong_count = 0
                
                while websocket_connected:
                    try:
                        # Enviar ping cada 15 segundos
                        await asyncio.sleep(15)
                        if websocket_connected:
                            await ws.send("ping")
                            ping_count += 1
                            logger.info(f"📤 Ping #{ping_count} enviado durante descarga")
                        
                        # Escuchar respuesta
                        try:
                            message = await asyncio.wait_for(ws.recv(), timeout=10.0)
                            if message == "pong":
                                pong_count += 1
                                logger.info(f"📥 Pong #{pong_count} recibido - conexión activa")
                            elif message == "ping":
                                await ws.send("pong")
                                logger.info("📤 Respondiendo pong a ping del servidor")
                            else:
                                try:
                                    data = json.loads(message)
                                    websocket_messages.append(data)
                                    if data.get('type') == 'download_progress':
                                        logger.info(f"📊 Progreso de descarga: {data.get('progress', 'N/A')}")
                                except json.JSONDecodeError:
                                    pass
                        except asyncio.TimeoutError:
                            continue
                            
                    except Exception as e:
                        logger.warning(f"⚠️ Error en WebSocket monitor: {e}")
                        break
                        
                logger.info(f"📊 WebSocket stats - Pings: {ping_count}, Pongs: {pong_count}")
                
        except Exception as e:
            logger.error(f"❌ Error conectando WebSocket: {e}")
        finally:
            websocket_connected = False
    
    async def trigger_geodata_download():
        """Disparar descarga de geodata via API"""
        
        try:
            async with aiohttp.ClientSession() as session:
                # Preparar datos de waypoints
                download_data = {
                    "waypoints": test_waypoints,
                    "radius_km": 1.0  # Radio pequeño para prueba rápida
                }
                
                logger.info("🚀 Iniciando descarga de geodata...")
                
                # Iniciar descarga
                async with session.post(
                    f"{api_base}/trip-planner/download-waypoint-geodata", 
                    json=download_data,
                    timeout=aiohttp.ClientTimeout(total=300)  # 5 minutos
                ) as response:
                    
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Descarga completada: {result}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Error en descarga: {response.status} - {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"❌ Error en descarga de geodata: {e}")
            return False
    
    # Ejecutar prueba
    logger.info("🧪 INICIANDO PRUEBA DE GEODATA CON WEBSOCKET")
    logger.info("=" * 50)
    
    # Iniciar monitor WebSocket en paralelo
    websocket_task = asyncio.create_task(websocket_monitor())
    
    # Esperar a que WebSocket se conecte
    await asyncio.sleep(2)
    
    if not websocket_connected:
        logger.error("❌ No se pudo conectar WebSocket")
        return False
    
    # Iniciar descarga de geodata
    download_success = await trigger_geodata_download()
    
    # Mantener WebSocket activo por un poco más para verificar estabilidad
    await asyncio.sleep(10)
    
    # Cerrar WebSocket monitor
    websocket_connected = False
    await asyncio.sleep(1)
    
    # Cancelar tarea WebSocket
    websocket_task.cancel()
    try:
        await websocket_task
    except asyncio.CancelledError:
        pass
    
    # Reporte final
    logger.info("\n📊 REPORTE FINAL:")
    logger.info(f"   Descarga de geodata: {'✅ EXITOSA' if download_success else '❌ FALLÓ'}")
    logger.info(f"   Mensajes WebSocket recibidos: {len(websocket_messages)}")
    logger.info(f"   Conexión WebSocket estable: {'✅ SÍ' if len(websocket_messages) > 0 else '❌ NO'}")
    
    return download_success

if __name__ == "__main__":
    try:
        result = asyncio.run(test_geodata_download_with_websocket())
        if result:
            print("\n🎉 PRUEBA EXITOSA: Geodata descargada con WebSocket estable")
        else:
            print("\n⚠️ PRUEBA CON PROBLEMAS: Revisar logs para detalles")
    except Exception as e:
        print(f"\n❌ ERROR EN PRUEBA: {e}")
