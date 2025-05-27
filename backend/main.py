from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import os
import time
import sys
import logging
from datetime import datetime
from typing import Set, Dict, Optional

# Configurar logging más detallado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("../backend_log.txt")
    ]
)
logger = logging.getLogger("dashcam-api")
logger.info("====== INICIANDO SERVIDOR FASTAPI ======")

# Import configuration
from config import config
logger.info(f"Configuración cargada: data_path={config.data_path}")

# Import our modules
try:
    logger.info("Importando módulos...")
    from camera_manager import CameraManager
    from gps_reader import GPSReader
    from landmark_checker import LandmarkChecker
    from audio_notifier import AudioNotifier
    from trip_logger import TripLogger
    from video_maker import VideoMaker
    from shutdown_monitor import ShutdownMonitor
    from disk_manager import DiskManager
    from settings_manager import settings_manager  # Import the settings manager
    from data_persistence import get_persistence_manager  # Import our new persistence manager
    from auto_trip_manager import auto_trip_manager  # Import our new auto trip manager
    from hdd_copy_module import HDDCopyModule  # Import our new HDD copy module
    logger.info("Módulos importados correctamente")
except Exception as e:
    logger.error(f"Error importando módulos: {e}", exc_info=True)
    raise

# Import routes
try:
    logger.info("Importando rutas...")
    from routes import router as api_router
    
    # Import new routes for offline maps, landmark images and geocoding
    from routes import landmark_images
    from routes import offline_maps
    from routes import geocode
    logger.info("Rutas importadas correctamente")
except Exception as e:
    logger.error(f"Error importando rutas: {e}", exc_info=True)
    raise

try:
    logger.info("Creando aplicación FastAPI...")
    app = FastAPI(title="Smart Dashcam API")
    
    # Add CORS middleware to allow the frontend to access the API
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allows all origins
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
    )
    logger.info("Middleware CORS configurado")

    # Inicializa los componentes con manejo de excepciones
    logger.info("Inicializando componentes...")
    
    # Initialize our components with proper configuration
    camera_manager = CameraManager()
    logger.info("CameraManager inicializado")
    
    gps_reader = GPSReader()
    logger.info("GPSReader inicializado")
    
    trip_logger = TripLogger(db_path=config.db_path)
    logger.info("TripLogger inicializado")
    
    # Configurar el trip_logger en el camera_manager
    camera_manager.set_trip_logger(trip_logger)
    logger.info("TripLogger configurado en CameraManager")
    
    landmark_checker = LandmarkChecker(landmarks_file=config.landmarks_path)
    logger.info("LandmarkChecker inicializado")
    
    audio_notifier = AudioNotifier()
    logger.info("AudioNotifier inicializado")
    
    video_maker = VideoMaker(data_path=config.data_path)
    logger.info("VideoMaker inicializado")
    
    shutdown_monitor = ShutdownMonitor()
    logger.info("ShutdownMonitor inicializado")
    
    disk_manager = DiskManager(
        data_path=config.data_path,
        db_path=config.db_path,
        settings_path=config.storage_settings_path
    )
    logger.info("DiskManager inicializado")
    
    # Inicializar el módulo de copia a HDD
    hdd_copy_module = HDDCopyModule(disk_manager, camera_manager, audio_notifier)
    logger.info("HDDCopyModule inicializado")
except Exception as e:
    logger.error(f"Error inicializando componentes: {e}", exc_info=True)
    raise

# Global state
is_recording = False
current_location = {"lat": 0.0, "lon": 0.0, "speed": 0.0}
active_landmark = None
connected_clients: Set[WebSocket] = set()

# Track landmark announcements to avoid repetitive announcements
landmark_announcements: Dict[str, int] = {}  # {landmark_id: announcement_count}
last_announcement_time: Dict[str, float] = {}  # {landmark_id: timestamp}

# Define a function to update the global recording state (used by auto_trip_manager)
def set_global_recording_state(state: bool):
    global is_recording
    is_recording = state
    logger.info(f"Global recording state set to: {state}")

# Initialize route modules with the necessary components
try:
    logger.info("Configurando módulos de rutas...")
    import routes.recording as recording_routes
    import routes.landmarks as landmarks_routes
    import routes.trips as trips_routes
    import routes.storage as storage_routes
    import routes.system as system_routes
    import routes.videos as videos_routes
    import routes.trip_planner as trip_planner_routes
    import routes.settings as settings_routes
    import routes.cameras as cameras_routes  # Importar el nuevo módulo de rutas de cámaras
    import routes.camera_reset as camera_reset_routes  # Importar el módulo de reinicio de cámaras
    import routes.kml_parser as kml_parser_routes  # Importar el nuevo módulo de rutas de KML
    
    # Set up shared components in the route modules
    recording_routes.camera_manager = camera_manager
    recording_routes.trip_logger = trip_logger
    recording_routes.is_recording = is_recording  # Esto es solo una asignación inicial, no un enlace
    
    landmarks_routes.landmark_checker = landmark_checker
    
    trips_routes.trip_logger = trip_logger
    trips_routes.auto_trip_manager = auto_trip_manager
    
    storage_routes.disk_manager = disk_manager
    
    system_routes.camera_manager = camera_manager
    system_routes.gps_reader = gps_reader
    
    videos_routes.trip_logger = trip_logger
    videos_routes.video_maker = video_maker
    videos_routes.config = config
    
    # Configurar el módulo de rutas de cámaras
    cameras_routes.camera_manager = camera_manager
    
    # Configurar el módulo de reinicio de cámaras
    camera_reset_routes.camera_manager = camera_manager
    
    # Configurar el módulo de WebRTC
    import routes.webrtc as webrtc_routes
    webrtc_routes.camera_manager = camera_manager
    
    # Configurar el módulo de streaming MJPEG
    import routes.mjpeg_stream as mjpeg_stream_routes
    mjpeg_stream_routes.camera_manager = camera_manager
    
    # Configurar el módulo de rutas de audio
    import routes.audio as audio_routes
    audio_routes.audio_notifier = audio_notifier
    
    # Configurar módulo de almacenamiento con el componente de copia HDD
    storage_routes.hdd_copy_module = hdd_copy_module
    
    # Initialize trip planner routes
    trip_planner_routes.landmark_checker = landmark_checker
    trip_planner_routes.trip_logger = trip_logger
    trip_planner_routes.config = config
    trip_planner_routes.audio_notifier = audio_notifier
    trip_planner_routes.initialize() # Call the new initialize function to load saved trips
    
    # Proporcionar la lista de clientes WebSocket al audio_notifier
    audio_notifier.connected_clients = connected_clients
    
    # Initialize KML parser routes
    kml_parser_routes.landmark_checker = landmark_checker
    kml_parser_routes.planned_trips = trip_planner_routes.planned_trips
    kml_parser_routes.config = config
    
    # Initialize settings routes
    settings_routes.config = config
    
    # Initialize the new routes for offline maps, landmark images and geocoding
    landmark_images.config = config
    offline_maps.config = config
    
    # No need to configure geocode module as it doesn't require specific configuration
    
    # Initialize the auto trip manager
    auto_trip_manager.initialize(
        trip_logger=trip_logger,
        landmark_checker=landmark_checker,
        camera_manager=camera_manager,
        gps_reader=gps_reader,
        audio_notifier=audio_notifier,
        set_recording_state_callback=set_global_recording_state
    )
    
    logger.info("Rutas configuradas correctamente")
except Exception as e:
    logger.error(f"Error configurando módulos de rutas: {e}", exc_info=True)
    raise

# Include the API router
try:
    logger.info("Incluyendo router API...")
    app.include_router(api_router)
    
    # Initialize configuration for modules that need it
    import routes.offline_maps as offline_maps
    offline_maps.config = config
    
    import routes.organic_maps as organic_maps
    organic_maps.init_modules(config)
    
    logger.info("Router API incluido correctamente")
except Exception as e:
    logger.error(f"Error incluyendo router API: {e}", exc_info=True)
    raise

# Register modules with the settings manager to receive updates
def initialize_settings_subscriptions():
    """Register all modules with the settings manager to receive updates"""
    logger.info("Inicializando suscripciones de configuración...")
    
    # Audio settings for the audio notifier
    settings_manager.register_module(
        "audio_notifier", 
        "audio", 
        audio_notifier.apply_settings
    )
    
    # Video settings for the camera manager
    settings_manager.register_module(
        "camera_manager", 
        "video", 
        camera_manager.apply_settings
    )
    
    # Storage settings for the disk manager
    settings_manager.register_module(
        "disk_manager", 
        "storage", 
        disk_manager.apply_settings
    )
    logger.info("Suscripciones de configuración inicializadas")

# WebSocket connections for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    logger.info(f"Nueva conexión WebSocket. Total de clientes: {len(connected_clients)}")
    
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except Exception as e:
        logger.info(f"Cliente WebSocket desconectado: {str(e)}")
        # Client disconnected
        try:
            if websocket in connected_clients:
                connected_clients.remove(websocket)
        except Exception as ex:
            logger.warning(f"Error al eliminar WebSocket de connected_clients: {str(ex)}")

# Background task to update location and check landmarks
@app.on_event("startup")
async def startup_event():
    logger.info("Evento de inicio ejecutándose...")
    # Initialize settings subscriptions
    initialize_settings_subscriptions()
    
    # Start background tasks
    logger.info("Iniciando tarea de actualización de ubicación...")
    asyncio.create_task(update_location_task())
    
    # Start the shutdown monitor in a separate thread
    logger.info("Iniciando monitor de apagado...")
    shutdown_monitor.start_monitoring()
    
    # Check for planned trips that should start automatically
    logger.info("Verificando viajes programados para hoy...")
    asyncio.create_task(check_scheduled_trips())
    
    # Initialize WebRTC module
    logger.info("Inicializando módulo WebRTC...")
    try:
        from routes.webrtc import initialize_webrtc
        await initialize_webrtc()
        logger.info("✅ Módulo WebRTC inicializado correctamente")
    except Exception as e:
        logger.error(f"❌ Error inicializando WebRTC: {e}", exc_info=True)
    
    logger.info("Evento de inicio completado")

async def check_scheduled_trips():
    """Check if there are any trips scheduled to start today and start them automatically"""
    # Wait a bit for all components to be properly initialized
    await asyncio.sleep(5)
    
    try:
        # Get the list of planned trips from trip_planner_routes
        trip_to_start = auto_trip_manager.check_for_trips_to_start(trip_planner_routes.planned_trips)
        
        if trip_to_start:
            logger.info(f"Viaje programado para hoy encontrado: {trip_to_start.name} (ID: {trip_to_start.id})")
            # Ask user for confirmation via notification
            audio_notifier.announce(f"Viaje programado encontrado: {trip_to_start.name}. Iniciando en 10 segundos. Pulse el botón de apagado para cancelar.")
            
            # Wait 10 seconds to allow user to cancel if needed
            await asyncio.sleep(10)
            
            # Start the trip
            success = await auto_trip_manager.start_scheduled_trip(trip_to_start)
            if success:
                logger.info(f"Viaje programado iniciado automáticamente: {trip_to_start.name}")
                audio_notifier.announce(f"Viaje {trip_to_start.name} iniciado automáticamente")
            else:
                logger.error("Error al iniciar el viaje programado automáticamente")
                audio_notifier.announce("Error al iniciar el viaje programado")
        else:
            logger.info("No hay viajes programados para hoy")
    except Exception as e:
        logger.error(f"Error al verificar viajes programados: {str(e)}")
        audio_notifier.announce("Error al verificar viajes programados")

async def update_location_task():
    global current_location, active_landmark, is_recording, landmark_announcements, last_announcement_time
    logger.info("Tarea de actualización de ubicación iniciada")
    
    while True:
        try:
            # Update GPS location
            location = gps_reader.get_location()
            if location:
                current_location = location
                
                # Check for nearby landmarks - usar latitude/longitude en lugar de lat/lon
                if location.get("latitude") is not None and location.get("longitude") is not None:
                    nearby = landmark_checker.check_nearby(location["latitude"], location["longitude"])
                    if nearby:
                        active_landmark = nearby
                        landmark_id = str(nearby.get("id", nearby.get("name", "")))
                        
                        # Log the landmark encounter (this still happens every time)
                        trip_logger.add_landmark_encounter(nearby)
                        
                        # Check if we need to announce this landmark
                        current_time = time.time()
                        announcement_count = landmark_announcements.get(landmark_id, 0)
                        last_time = last_announcement_time.get(landmark_id, 0)
                        
                        # Only announce if we haven't announced twice yet
                        # and at least 10 seconds have passed since the last announcement
                        if announcement_count < 2 and (current_time - last_time) > 10:
                            audio_notifier.announce(f"Approaching {nearby['name']}")
                            landmark_announcements[landmark_id] = announcement_count + 1
                            last_announcement_time[landmark_id] = current_time
                    else:
                        # No nearby landmark - reset active landmark
                        if active_landmark:
                            active_landmark = None
                
                # Include camera status in message
                camera_status = {
                    "road_camera": camera_manager.road_camera is not None,
                    "interior_camera": camera_manager.interior_camera is not None,
                    "errors": getattr(camera_manager, "camera_errors", [])
                }
                
                # Get system statistics
                from routes.system import get_system_stats
                system_stats = get_system_stats()
                    
                # Broadcast updates to all connected clients
                message = {
                    "type": "status_update",
                    "location": current_location,
                    "landmark": active_landmark,
                    "recording": is_recording,
                    "camera_status": camera_status,
                    "system_stats": system_stats
                }
                
                for client in list(connected_clients):
                    try:
                        await client.send_json(message)
                    except Exception as e:
                        logger.warning(f"Error enviando actualización a cliente WebSocket: {str(e)}")
                        connected_clients.remove(client)
        except Exception as e:
            logger.error(f"Error en tarea de actualización de ubicación: {str(e)}", exc_info=True)
            
        await asyncio.sleep(1)  # Update every second

try:
    # Mount the static frontend files
    logger.info("Montando archivos estáticos del frontend...")
    frontend_path = "../frontend/dist"
    if os.path.exists(frontend_path):
        app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
        logger.info(f"Frontend montado desde: {frontend_path}")
    else:
        logger.warning(f"Directorio del frontend no encontrado: {frontend_path}")
        
    # Mount videos directory for direct access
    logger.info("Montando directorio de videos...")
    videos_path = os.path.join(config.data_path, "videos")
    app.mount("/videos", StaticFiles(directory=videos_path), name="videos")
    logger.info(f"Directorio de videos montado desde: {videos_path}")
    
    # Mount thumbnails directory
    logger.info("Montando directorio de miniaturas...")
    thumbnails_dir = os.path.join(config.data_path, "thumbnails")
    os.makedirs(thumbnails_dir, exist_ok=True)
    app.mount("/thumbnails", StaticFiles(directory=thumbnails_dir), name="thumbnails")
    logger.info(f"Directorio de miniaturas montado desde: {thumbnails_dir}")
except Exception as e:
    logger.error(f"Error montando archivos estáticos: {e}", exc_info=True)

# Cleanup on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Evento de apagado ejecutándose...")
    
    # Cerrar los clientes WebSocket de forma ordenada
    for websocket in list(connected_clients):
        try:
            await websocket.close()
            logger.info("Conexión WebSocket cerrada correctamente")
        except Exception as e:
            logger.warning(f"Error al cerrar conexión WebSocket: {e}")
    connected_clients.clear()
    
    # Stop the settings manager's watcher thread
    logger.info("Deteniendo el administrador de configuración...")
    settings_manager.stop()
    
    # Limpiar cada componente individual con manejo de excepciones
    try:
        if camera_manager:
            logger.info("Limpiando recursos de CameraManager...")
            camera_manager.cleanup()
    except Exception as e:
        logger.error(f"Error al limpiar CameraManager: {e}")
    
    try:
        if gps_reader:
            logger.info("Limpiando recursos de GPSReader...")
            gps_reader.cleanup()
    except Exception as e:
        logger.error(f"Error al limpiar GPSReader: {e}")
        
    try:
        if trip_logger:
            logger.info("Limpiando recursos de TripLogger...")
            trip_logger.cleanup()
    except Exception as e:
        logger.error(f"Error al limpiar TripLogger: {e}")
        
    try:
        if audio_notifier:
            logger.info("Limpiando recursos de AudioNotifier...")
            audio_notifier.cleanup()
    except Exception as e:
        logger.error(f"Error al limpiar AudioNotifier: {e}")
        
    try:
        if video_maker:
            logger.info("Limpiando recursos de VideoMaker...")
            video_maker.cleanup()
    except Exception as e:
        logger.error(f"Error al limpiar VideoMaker: {e}")
        
    try:
        if shutdown_monitor:
            logger.info("Deteniendo ShutdownMonitor...")
            shutdown_monitor.stop()
    except Exception as e:
        logger.error(f"Error al detener ShutdownMonitor: {e}")
        
    try:
        if disk_manager:
            logger.info("Limpiando recursos de DiskManager...")
            disk_manager.cleanup()
    except Exception as e:
        logger.error(f"Error al limpiar DiskManager: {e}")
    
    try:
        if hdd_copy_module:
            logger.info("Limpiando recursos de HDDCopyModule...")
            if hasattr(hdd_copy_module, 'cleanup') and callable(hdd_copy_module.cleanup):
                hdd_copy_module.cleanup()
    except Exception as e:
        logger.error(f"Error al limpiar HDDCopyModule: {e}")
    
    logger.info("Evento de apagado completado")

async def close_all_streaming_connections():
    """Cierra todas las conexiones de streaming (WebRTC y MJPEG) al iniciar el servidor"""
    try:
        # Cerrar conexiones WebRTC
        logger.info("Cerrando todas las conexiones WebRTC existentes...")
        import routes.webrtc as webrtc_routes
        response = await webrtc_routes.close_webrtc_connections()
        logger.info(f"Resultado de limpieza WebRTC: {response}")
        
        # Cerrar también las conexiones MJPEG explícitamente
        logger.info("Reiniciando el sistema de streaming MJPEG...")
        import routes.mjpeg_stream as mjpeg_stream_routes
        
        # Limpiar todas las conexiones MJPEG activas
        clients_to_clean = 0
        
        try:
            logger.info(f"Limpiando {len(mjpeg_stream_routes.client_streams)} clientes MJPEG activos...")
            
            # Crear una lista de clientes para limpiar
            clients_to_remove = list(mjpeg_stream_routes.client_streams.keys())
            
            for client_id in clients_to_remove:
                try:
                    await mjpeg_stream_routes.cleanup_client(client_id, "reinicio del servidor")
                    clients_to_clean += 1
                except Exception as e:
                    logger.error(f"Error limpiando cliente MJPEG {client_id}: {e}")
            
            logger.info(f"Limpiados {clients_to_clean} clientes MJPEG")
        except Exception as e:
            logger.error(f"Error durante limpieza de clientes MJPEG: {e}")
        
        # Resetear las estructuras de datos para eliminar clientes MJPEG antiguos
        mjpeg_stream_routes.active_clients = {"road": 0, "interior": 0}
        mjpeg_stream_routes.client_streams = {}
        mjpeg_stream_routes.stats["clients_connected"] = 0
        mjpeg_stream_routes.stats["start_time"] = time.time()
        
        # Reiniciar el worker de captura de frames 
        logger.info("Iniciando un nuevo worker de captura MJPEG...")
        # Cancelar cualquier worker anterior si existe
        try:
            for task in asyncio.all_tasks():
                if "mjpeg" in task.get_name().lower():
                    task.cancel()
        except Exception as e:
            logger.warning(f"Error al intentar cancelar tareas MJPEG existentes: {e}")
        
        # Iniciar un nuevo worker limpio
        asyncio.create_task(mjpeg_stream_routes.initialize_mjpeg())
        
        logger.info("Limpieza completa de los sistemas de streaming")
        logger.info("Conexiones MJPEG reiniciadas correctamente")
    except Exception as e:
        logger.error(f"Error cerrando conexiones de streaming: {e}", exc_info=True)
        
# Crear tarea para limpiar conexiones al inicio
if __name__ != "__main__":  # Solo cuando se ejecuta mediante uvicorn
    asyncio.create_task(close_all_streaming_connections())

if __name__ == "__main__":
    try:
        logger.info("Iniciando servidor Uvicorn en puerto 8000...")
        print("Iniciando servidor Uvicorn en puerto 8000...")
        uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="info")
    except Exception as e:
        logger.critical(f"Error fatal al iniciar Uvicorn: {e}", exc_info=True)
        print(f"Error fatal al iniciar Uvicorn: {e}")
        sys.exit(1)