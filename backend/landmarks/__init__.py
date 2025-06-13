"""
Landmark Module for Smart Dashcam System

This module contains all functionality related to landmarks including:
- Core database and checking functionality
- Optimization services for route planning
- REST API endpoints
- Settings and configuration management
"""

from .core.landmarks_db import LandmarksDB
from .core.landmark_checker import LandmarkChecker
from .services.radius_optimizer import RadiusOptimizer
from .services.landmark_optimization_service import LandmarkOptimizationService
from .services.landmark_download_service import LandmarkDownloadService
from .routes.landmarks import router as landmarks_router
from .routes.landmark_images import router as landmark_images_router
from .routes.landmark_downloads import router as landmark_downloads_router

__all__ = [
    'LandmarksDB',
    'LandmarkChecker', 
    'RadiusOptimizer',
    'LandmarkOptimizationService',
    'LandmarkDownloadService',
    'landmarks_router',
    'landmark_images_router',
    'landmark_downloads_router'
]
