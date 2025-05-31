from fastapi import APIRouter
from .recording import router as recording_router
from .trips import router as trips_router
from .landmarks import router as landmarks_router
from .storage import router as storage_router
from .system import router as system_router
from .videos import router as videos_router
from .trip_planner import router as trip_planner_router
from .settings import router as settings_router
from .cameras import router as cameras_router  # Importar el nuevo router de cámaras
from .camera_reset import router as camera_reset_router  # Importar el router de reinicio de cámaras
# from .webrtc import router as webrtc_router  # Importar el nuevo router de WebRTC - DISABLED
from .audio import router as audio_router  # Importar el nuevo router de audio
from .kml_parser import router as kml_parser_router  # Importar el nuevo router de KML
from .mjpeg_stream import router as mjpeg_router  # Importar el router de streaming MJPEG
from .offline_maps import router as offline_maps_router  # Importar el router de mapas offline
from .landmark_images import router as landmark_images_router  # Importar el router de imágenes de landmarks
from .geocode import router as geocode_router  # Importar el router de geocodificación
from .organic_maps import router as organic_maps_router  # Importar el router de Organic Maps
from .mic_leds import router as mic_leds_router  # Importar el router de LEDs del micrófono
from .file_explorer import router as file_explorer_router  # Importar el router del explorador de archivos

router = APIRouter()

router.include_router(recording_router, prefix="/api/recording", tags=["recording"])
router.include_router(trips_router, prefix="/api/trips", tags=["trips"])
router.include_router(landmarks_router, prefix="/api/landmarks", tags=["landmarks"])
router.include_router(storage_router, prefix="/api/storage", tags=["storage"])
router.include_router(system_router, prefix="/api/system", tags=["system"])
router.include_router(videos_router, prefix="/api/videos", tags=["videos"])
router.include_router(trip_planner_router, prefix="/api/trip-planner", tags=["trip-planner"])
router.include_router(settings_router, prefix="/api/settings", tags=["settings"])
router.include_router(cameras_router, prefix="/api/cameras", tags=["cameras"])  # Incluir el router de cámaras
router.include_router(camera_reset_router, tags=["camera-reset"])  # Incluir el router de reinicio de cámaras
# router.include_router(webrtc_router, prefix="/api/webrtc", tags=["webrtc"])  # Incluir el router de WebRTC - DISABLED
router.include_router(audio_router, prefix="/api/audio", tags=["audio"])  # Incluir el router de audio
router.include_router(kml_parser_router, prefix="/api/trip-planner", tags=["kml-parser"])  # Incluir el router de KML
router.include_router(offline_maps_router, prefix="/api/offline-maps", tags=["offline-maps"])  # Incluir el router de mapas offline
router.include_router(landmark_images_router, prefix="/api/landmark-images", tags=["landmark-images"])  # Incluir el router de imágenes de landmarks
router.include_router(geocode_router, prefix="/api/geocode", tags=["geocode"])  # Incluir el router de geocodificación
router.include_router(mjpeg_router, prefix="/api/mjpeg", tags=["mjpeg"])  # Incluir el router de streaming MJPEG
router.include_router(organic_maps_router, prefix="/api/organic-maps", tags=["organic-maps"])  # Incluir el router de Organic Maps
router.include_router(mic_leds_router, prefix="/api/mic-leds", tags=["mic-leds"])  # Incluir el router de LEDs del micrófono
router.include_router(file_explorer_router, prefix="/api/file-explorer", tags=["file-explorer"])  # Incluir el router del explorador de archivos