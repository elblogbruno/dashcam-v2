from fastapi import APIRouter
from .recording import router as recording_router
from .trips import router as trips_router
from .landmarks import router as landmarks_router
from .storage import router as storage_router
from .system import router as system_router
from .videos import router as videos_router
from .trip_planner import router as trip_planner_router
from .settings import router as settings_router

router = APIRouter()

router.include_router(recording_router, prefix="/api/recording", tags=["recording"])
router.include_router(trips_router, prefix="/api/trips", tags=["trips"])
router.include_router(landmarks_router, prefix="/api/landmarks", tags=["landmarks"])
router.include_router(storage_router, prefix="/api/storage", tags=["storage"])
router.include_router(system_router, prefix="/api/system", tags=["system"])
router.include_router(videos_router, prefix="/api/videos", tags=["videos"])
router.include_router(trip_planner_router, prefix="/api/trip-planner", tags=["trip-planner"])
router.include_router(settings_router, prefix="/api/settings", tags=["settings"])