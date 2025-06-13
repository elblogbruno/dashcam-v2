"""
Landmark API routes and endpoints
"""

from .landmarks import router as landmarks_router
from .landmark_images import router as landmark_images_router
from .landmark_downloads import router as landmark_downloads_router

__all__ = ['landmarks_router', 'landmark_images_router', 'landmark_downloads_router']
