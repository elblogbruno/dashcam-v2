"""
Geocoding Module for DashCam-v2

This module contains all reverse geocoding related functionality including:
- Reverse geocoding services and workers
- Geodata download and processing
- Offline geocoding management
- Route coverage calculation
- CSV export and import utilities

Module Structure:
- services/: Core geocoding services
- workers/: Background workers for geocoding tasks
- downloader/: Geodata download functionality
- routes/: FastAPI routes for geocoding endpoints
- utils/: Utility functions for geocoding operations
"""

from .services.reverse_geocoding_service import ReverseGeocodingService
from .workers.reverse_geocoding_worker import ReverseGeocodingWorker
from .downloader.geodata_downloader import GeodataDownloader
from .downloader.nominatim_api import fetch_reverse_geocoding_from_nominatim
from .utils.coverage_calculator import calculate_trip_route_coverage
from .utils.grid_generator import generate_comprehensive_grid_coverage, generate_grid_around_point
from .utils.db_storage import store_geodata_in_db

__all__ = [
    'ReverseGeocodingService',
    'ReverseGeocodingWorker',
    'GeodataDownloader',
    'fetch_reverse_geocoding_from_nominatim',
    'calculate_trip_route_coverage',
    'generate_comprehensive_grid_coverage',
    'generate_grid_around_point',
    'store_geodata_in_db'
]

__version__ = "1.0.0"
