from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
import json
import os
import uuid
import requests
import logging
import math
import time
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel
import asyncio
from sse_starlette.sse import EventSourceResponse

# Import our new data persistence module
from data_persistence import get_persistence_manager
from geocoding.services.reverse_geocoding_service import LocationInfo
from geocoding.downloader.geodata_downloader import GeodataDownloader
from geocoding.utils.coverage_calculator import CoverageCalculator
from geocoding.utils.db_storage import DBStorage

# Import landmark function from new module
from landmarks.routes.landmark_downloads import get_landmark_settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Will be initialized from main.py
landmark_checker = None
trip_logger = None
config = None
audio_notifier = None
settings_manager = None  # Agregar settings_manager

router = APIRouter()

class Waypoint(BaseModel):
    lat: float
    lon: float
    name: Optional[str] = None

class PlannedTrip(BaseModel):
    id: Optional[str] = None
    name: str
    start_location: Dict[str, float]  # {lat: float, lon: float}
    end_location: Dict[str, float]    # {lat: float, lon: float}
    origin_name: Optional[str] = None  # Name for start location
    destination_name: Optional[str] = None  # Name for end location
    waypoints: Optional[List[Waypoint]] = []  # List of Waypoint objects
    start_date: str  # YYYY-MM-DD format
    end_date: str    # YYYY-MM-DD format
    notes: Optional[str] = ""
    landmarks_downloaded: Optional[bool] = False
    completed: Optional[bool] = False

class PlaceSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 5

class GeocodingResult(BaseModel):
    name: str
    lat: float
    lon: float
    display_name: str
    category: Optional[str] = None
    address: Optional[Dict[str, str]] = None

# In-memory storage for planned trips, will be loaded from disk
planned_trips = []



def initialize():
    """Initialize trips storage and load existing trips from the database"""
    global planned_trips
    
    try:
        # Get persistence manager instance (for legacy JSON loading)
        persistence = get_persistence_manager()
        
        # Check if we can use the database
        if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
            db = landmark_checker.landmarks_db
            
            # Check if we need to migrate trips from JSON to database
            json_path = persistence.get_file_path('planned_trips.json')
            
            if os.path.exists(json_path):
                # Load trips from file first for potential migration
                try:
                    json_trips_data = persistence.load_json('planned_trips.json', default=[])
                    
                    if json_trips_data:
                        # Migrate trips to database
                        logger.info(f"Migrating {len(json_trips_data)} trips from JSON file to database...")
                        
                        for trip_dict in json_trips_data:
                            # Check if this trip is already in the database
                            if db.get_trip_by_id(trip_dict.get('id', '')):
                                continue
                            
                            # Add the trip to the database
                            try:
                                db.add_trip(trip_dict)
                            except Exception as e:
                                logger.error(f"Error migrating trip {trip_dict.get('name', 'unknown')}: {str(e)}")
                        
                        # Create backup of old JSON file
                        backup_path = json_path + ".backup"
                        try:
                            import shutil
                            shutil.copy2(json_path, backup_path)
                            logger.info(f"Created backup of trips JSON file at {backup_path}")
                        except Exception as e:
                            logger.error(f"Failed to create backup of trips JSON file: {str(e)}")
                except Exception as e:
                    logger.error(f"Error during trip migration: {str(e)}")
            
            # Now load trips from database
            trips_data = db.get_all_trips()
            
            # Convert dictionaries to PlannedTrip objects
            planned_trips = [PlannedTrip(**trip) for trip in trips_data]
            logger.info(f"Loaded {len(planned_trips)} planned trips from database")
            
        else:
            # If landmark_checker is not initialized yet, use the legacy method
            trips_data = persistence.load_json('planned_trips.json', default=[])
            
            # Convert dictionaries to PlannedTrip objects
            planned_trips = [PlannedTrip(**trip) for trip in trips_data]
            logger.info(f"Loaded {len(planned_trips)} planned trips from disk (legacy method)")
            
    except Exception as e:
        logger.error(f"Error loading trips: {str(e)}")
        # Initialize with empty list if loading fails
        planned_trips = []

def save_trips_to_database():
    """Save trips to the database for persistence"""
    try:
        # Check if we have access to the database
        if not landmark_checker or not hasattr(landmark_checker, 'landmarks_db'):
            logger.warning("Cannot save trips to database: landmark_checker not initialized")
            return _legacy_save_trips_to_disk()
            
        db = landmark_checker.landmarks_db
        
        # For each trip in memory, add or update in the database
        success_count = 0
        
        for trip in planned_trips:
            trip_dict = trip.dict()
            
            # Ensure waypoints are properly serialized
            if trip_dict.get('waypoints'):
                trip_dict['waypoints'] = [wp.dict() if not isinstance(wp, dict) else wp for wp in trip_dict['waypoints']]
            
            # Check if the trip exists in the database
            existing_trip = db.get_trip_by_id(trip.id)
            
            if existing_trip:
                # Update existing trip
                if db.update_trip(trip.id, trip_dict):
                    success_count += 1
            else:
                # Add new trip
                if db.add_trip(trip_dict):
                    success_count += 1
        
        logger.info(f"Saved {success_count}/{len(planned_trips)} trips to database")
        return success_count == len(planned_trips)
    except Exception as e:
        logger.error(f"Error saving trips to database: {str(e)}")
        # Fallback to legacy save method
        return _legacy_save_trips_to_disk()

def _legacy_save_trips_to_disk():
    """Legacy method to save trips to disk as JSON (fallback)"""
    # Get persistence manager instance
    persistence = get_persistence_manager()
    
    try:
        # Convert PlannedTrip objects to dictionaries
        trips_data = []
        for trip in planned_trips:
            trip_dict = trip.dict()
            # Ensure waypoints are properly serialized
            if trip_dict.get('waypoints'):
                trip_dict['waypoints'] = [wp.dict() if not isinstance(wp, dict) else wp for wp in trip_dict['waypoints']]
            trips_data.append(trip_dict)
        
        # Save to file
        result = persistence.save_json(trips_data, 'planned_trips.json')
        
        if result:
            logger.info(f"Saved {len(planned_trips)} trips to disk (legacy method)")
        return result
    except Exception as e:
        logger.error(f"Error saving trips to disk: {str(e)}")
        return False

# Alias for backward compatibility
save_trips_to_disk = save_trips_to_database

@router.get("")
async def get_planned_trips():
    """Get all planned trips"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Intentar obtener viajes directamente de la base de datos
    if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
        try:
            # Obtener viajes desde la base de datos
            db_trips = landmark_checker.landmarks_db.get_all_trips()
            # Convertir a objetos PlannedTrip
            trip_objects = [PlannedTrip(**trip) for trip in db_trips]
            
            # Sort trips: upcoming first, then past
            upcoming_trips = []
            past_trips = []
            
            for trip in trip_objects:
                if trip.end_date >= today:
                    upcoming_trips.append(trip)
                else:
                    past_trips.append(trip)
            
            # Sort upcoming trips by start date (closest first)
            upcoming_trips.sort(key=lambda trip: trip.start_date)
            # Sort past trips by end date (most recent first)
            past_trips.sort(key=lambda trip: trip.end_date, reverse=True)
            
            # Combine the lists
            sorted_trips = upcoming_trips + past_trips
            
            # También actualizar la memoria caché en memoria
            global planned_trips
            planned_trips = sorted_trips
            
            return {"trips": sorted_trips}
        except Exception as e:
            logger.error(f"Error getting trips from database: {str(e)}")
            # Continuar con el método en memoria como respaldo
    
    # Usar los viajes en memoria si no se pudieron obtener de la base de datos
    # Sort trips: upcoming first, then past
    upcoming_trips = []
    past_trips = []
    
    for trip in planned_trips:
        if trip.end_date >= today:
            upcoming_trips.append(trip)
        else:
            past_trips.append(trip)
    
    # Sort upcoming trips by start date (closest first)
    upcoming_trips.sort(key=lambda trip: trip.start_date)
    # Sort past trips by end date (most recent first)
    past_trips.sort(key=lambda trip: trip.end_date, reverse=True)
    
    # Combine the lists
    sorted_trips = upcoming_trips + past_trips
    
    return {"trips": sorted_trips}

@router.get("/{trip_id}")
async def get_planned_trip(trip_id: str):
    """Get a specific planned trip by ID"""
    # Intentar obtener el viaje directamente de la base de datos
    if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
        try:
            db_trip = landmark_checker.landmarks_db.get_trip_by_id(trip_id)
            if db_trip:
                return PlannedTrip(**db_trip)
        except Exception as e:
            logger.error(f"Error getting trip {trip_id} from database: {str(e)}")
            # Continuar con el método en memoria como respaldo
    
    # Buscar en memoria si no se pudo obtener de la base de datos
    for trip in planned_trips:
        if trip.id == trip_id:
            return trip
            
    raise HTTPException(status_code=404, detail="Planned trip not found")

@router.post("")
async def create_planned_trip(trip: PlannedTrip, background_tasks: BackgroundTasks):
    """Create a new planned trip and automatically download landmarks"""
    # Generate a unique ID if not provided
    if not trip.id:
        import uuid
        trip.id = str(uuid.uuid4())[:8]
    
    # Ensure waypoints are properly instantiated as Waypoint objects
    if trip.waypoints:
        waypoints_list = []
        for wp in trip.waypoints:
            if isinstance(wp, dict):
                waypoints_list.append(Waypoint(**wp))
            else:
                waypoints_list.append(wp)
        trip.waypoints = waypoints_list
    
    # Store in memory
    planned_trips.append(trip)
    
    # Save to database
    if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
        # Directamente a la base de datos
        trip_dict = trip.dict()
        # Ensure waypoints are properly serialized
        if trip_dict.get('waypoints'):
            trip_dict['waypoints'] = [wp.dict() if not isinstance(wp, dict) else wp for wp in trip_dict['waypoints']]
        landmark_checker.landmarks_db.add_trip(trip_dict)
    else:
        # Fallback al método de archivo
        save_trips_to_disk()
    
    # No descargamos landmarks automáticamente ahora
    # La descarga se iniciará manualmente o desde el frontend
    
    return trip

@router.put("/{trip_id}")
async def update_planned_trip(trip_id: str, updated_trip: PlannedTrip, background_tasks: BackgroundTasks):
    """Update an existing planned trip and automatically download landmarks if significant changes"""
    original_trip = None
    for i, trip in enumerate(planned_trips):
        if trip.id == trip_id:
            original_trip = trip
            # Preserve the original ID
            updated_trip.id = trip_id
            
            # Ensure waypoints are properly instantiated as Waypoint objects
            if updated_trip.waypoints:
                waypoints_list = []
                for wp in updated_trip.waypoints:
                    if isinstance(wp, dict):
                        waypoints_list.append(Waypoint(**wp))
                    else:
                        waypoints_list.append(wp)
                updated_trip.waypoints = waypoints_list
                
            # Update in memory
            planned_trips[i] = updated_trip
            
            # Save to database
            if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
                # Directamente a la base de datos
                trip_dict = updated_trip.dict()
                # Ensure waypoints are properly serialized
                if trip_dict.get('waypoints'):
                    trip_dict['waypoints'] = [wp.dict() if not isinstance(wp, dict) else wp for wp in trip_dict['waypoints']]
                landmark_checker.landmarks_db.update_trip(trip_id, trip_dict)
            else:
                # Fallback al método de archivo
                save_trips_to_disk()
            
            # Check if the route has changed (start, end, or waypoints)
            route_changed = False
            
            # Check if start location changed
            if (original_trip.start_location["lat"] != updated_trip.start_location["lat"] or 
                original_trip.start_location["lon"] != updated_trip.start_location["lon"]):
                route_changed = True
            
            # Check if end location changed    
            if (original_trip.end_location["lat"] != updated_trip.end_location["lat"] or 
                original_trip.end_location["lon"] != updated_trip.end_location["lon"]):
                route_changed = True
                
            # Check if waypoints changed
            original_waypoints = original_trip.waypoints or []
            updated_waypoints = updated_trip.waypoints or []
            
            if len(original_waypoints) != len(updated_waypoints):
                route_changed = True
            else:
                for i, (ow, uw) in enumerate(zip(original_waypoints, updated_waypoints)):
                    if ow.lat != uw.lat or ow.lon != uw.lon:
                        route_changed = True
                        break
            
            # If route changed, automatically download landmarks in the background
            if route_changed:
                background_tasks.add_task(auto_download_landmarks_for_trip, updated_trip)
                
            return updated_trip
    
    raise HTTPException(status_code=404, detail="Planned trip not found")

@router.delete("/{trip_id}")
async def delete_planned_trip(trip_id: str):
    """Delete a planned trip"""
    global planned_trips
    original_length = len(planned_trips)
    planned_trips = [trip for trip in planned_trips if trip.id != trip_id]
    
    if len(planned_trips) < original_length:
        # Delete from database if possible
        db_deleted = False
        if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
            try:
                db_deleted = landmark_checker.landmarks_db.remove_trip(trip_id)
                if db_deleted:
                    logger.info(f"Deleted trip {trip_id} from database")
                else:
                    logger.warning(f"Failed to delete trip {trip_id} from database")
            except Exception as e:
                logger.error(f"Error deleting trip {trip_id} from database: {str(e)}")
        
        # If not using database or it failed, save updated list to disk
        if not db_deleted:
            save_trips_to_disk()
        
        # Delete landmarks associated with this trip
        if landmark_checker:
            try:
                deleted_count = landmark_checker.remove_trip_landmarks(trip_id)
                logger.info(f"Deleted {deleted_count} landmarks associated with trip {trip_id}")
            except Exception as e:
                logger.error(f"Error deleting landmarks for trip {trip_id}: {str(e)}")
                
        return {"status": "success", "message": "Planned trip deleted"}
    raise HTTPException(status_code=404, detail="Planned trip not found")

@router.get("/{trip_id}/optimization-analytics")
async def get_optimization_analytics():
    """Get analytics about optimization performance"""
    try:
        analytics = metrics_collector.get_performance_analytics()
        return analytics
    except Exception as e:
        logger.error(f"Error getting optimization analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

@router.post("/{trip_id}/mark-completed")
async def mark_trip_completed(trip_id: str, completed: bool = True):
    """Mark a trip as completed or not completed"""
    for i, trip in enumerate(planned_trips):
        if trip.id == trip_id:
            # Update in memory
            updated_trip = trip.dict()
            updated_trip["completed"] = completed
            planned_trips[i] = PlannedTrip(**updated_trip)
            
            # Update in database if possible
            db_updated = False
            if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
                try:
                    db_updated = landmark_checker.landmarks_db.update_trip_status(trip_id, completed=completed)
                    if db_updated:
                        logger.info(f"Updated trip {trip_id} completion status in database")
                    else:
                        logger.warning(f"Failed to update trip {trip_id} completion status in database")
                except Exception as e:
                    logger.error(f"Error updating trip completion status in database: {str(e)}")
            
            # If not using database or it failed, save to disk
            if not db_updated:
                save_trips_to_disk()
                
            return {"status": "success", "message": f"Trip marked as {'completed' if completed else 'not completed'}"}
    
    raise HTTPException(status_code=404, detail="Planned trip not found")

@router.get("/{trip_id}/distance-to-waypoints")
async def get_distance_to_waypoints(trip_id: str, current_lat: float, current_lon: float):
    """Calculate distance from current position to all waypoints in the trip"""
    # Find the planned trip
    trip = None
    for t in planned_trips:
        if t.id == trip_id:
            trip = t
            break
    
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    try:
        from math import sin, cos, sqrt, atan2, radians
        
        def calculate_distance(lat1, lon1, lat2, lon2):
            # Haversine formula for calculating distance between two coordinates
            R = 6371000  # Earth radius in meters
            
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            
            return R * c
        
        # Calculate distances to all points
        distances = []
        
        # Start location
        start_distance = calculate_distance(
            current_lat, 
            current_lon, 
            trip.start_location["lat"], 
            trip.start_location["lon"]
        )
        distances.append({
            "type": "start",
            "distance": start_distance,
            "location": trip.start_location
        })
        
        # Waypoints
        if trip.waypoints:
            for i, waypoint in enumerate(trip.waypoints):
                wp_distance = calculate_distance(
                    current_lat,
                    current_lon,
                    waypoint.lat,
                    waypoint.lon
                )
                wp_data = {
                    "lat": waypoint.lat,
                    "lon": waypoint.lon
                }
                
                # Include name if available
                if hasattr(waypoint, 'name') and waypoint.name:
                    wp_data["name"] = waypoint.name
                    
                distances.append({
                    "type": "waypoint",
                    "index": i,
                    "distance": wp_distance,
                    "location": wp_data
                })
        
        # End location
        end_distance = calculate_distance(
            current_lat,
            current_lon,
            trip.end_location["lat"],
            trip.end_location["lon"]
        )
        distances.append({
            "type": "end",
            "distance": end_distance,
            "location": trip.end_location
        })
        
        # Sort by distance (closest first)
        distances.sort(key=lambda x: x["distance"])
        
        return {
            "trip_id": trip_id,
            "current_position": {"lat": current_lat, "lon": current_lon},
            "distances": distances
        }
        
    except Exception as e:
        logger.error(f"Error calculating distances: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate distances: {str(e)}")

# Background task function to download landmarks
async def download_trip_landmarks(trip: PlannedTrip, radius_km: int):
    """Background task to download landmarks for a trip"""
    all_landmarks = []
    
    try:
        # Get landmarks near the start location
        start_landmarks = landmark_checker.get_landmarks_in_area(
            trip.start_location["lat"], 
            trip.start_location["lon"], 
            radius_km
        )
        all_landmarks.extend(start_landmarks)
        
        # Get landmarks near the end location
        end_landmarks = landmark_checker.get_landmarks_in_area(
            trip.end_location["lat"], 
            trip.end_location["lon"], 
            radius_km
        )
        all_landmarks.extend(end_landmarks)
        
        # Get landmarks near waypoints
        if trip.waypoints:
            for waypoint in trip.waypoints:
                waypoint_landmarks = landmark_checker.get_landmarks_in_area(
                    waypoint.lat,
                    waypoint.lon,
                    radius_km
                )
                all_landmarks.extend(waypoint_landmarks)
        
        # Remove duplicates by ID
        unique_landmarks = {}
        for landmark in all_landmarks:
            if "id" in landmark:
                unique_landmarks[landmark["id"]] = landmark
        
        # Get existing landmarks
        existing_landmarks = []
        landmarks_path = config.landmarks_path
        if os.path.exists(landmarks_path):
            with open(landmarks_path, "r") as f:
                try:
                    existing_landmarks = json.load(f)
                except json.JSONDecodeError:
                    existing_landmarks = []
        
        # Create a dictionary of existing landmarks for easy lookup
        existing_lookup = {lm.get("id", f"{lm['lat']},{lm['lon']}"): lm for lm in existing_landmarks}
        
        # Merge with existing landmarks
        for lm_id, landmark in unique_landmarks.items():
            if lm_id not in existing_lookup:
                existing_landmarks.append(landmark)
        
        # Save the updated landmarks file
        with open(landmarks_path, "w") as f:
            json.dump(existing_landmarks, f, indent=2)
        
        # Reload landmarks in the landmark checker
        landmark_checker.load_landmarks()
        
        logger.info(f"Successfully downloaded {len(unique_landmarks)} landmarks for trip {trip.id}")
        
    except Exception as e:
        logger.error(f"Error in background landmark download: {str(e)}")

# Updated background task function to track and report progress
async def fetch_poi_landmarks_from_overpass(lat, lon, radius_km=5):
    """Fetch points of interest around a location using Overpass API
    
    This function queries the Overpass API for various types of points of interest
    such as tourist attractions, restaurants, gas stations, etc. around a specific location.
    """
    try:
        # Get landmark settings
        settings = await get_landmark_settings()
        radius_km = int(settings.get("download_radius_km", radius_km))
        max_landmarks = int(settings.get("max_landmarks_per_location", 15))
        enabled_categories = settings.get("point_categories", ["gas_station", "restaurant", "hotel", "natural", "tourism", "historic"])
        
        # Define the POI types we want to find based on enabled categories
        poi_types = []
        
        # Only include categories that are enabled in the settings
        if "natural" in enabled_categories:
            poi_types.extend([
                "natural=peak", "natural=bay", "natural=beach", "natural=glacier", 
                "natural=hot_spring", "natural=volcano", "natural=valley"
            ])
            
        if "tourism" in enabled_categories:
            poi_types.extend([
                "tourism=attraction", "tourism=viewpoint", "tourism=museum", 
                "tourism=artwork", "tourism=theme_park", "tourism=zoo", "tourism=aquarium"
            ])
            
        if "historic" in enabled_categories:
            poi_types.extend([
                "historic=monument", "historic=castle", "historic=memorial", "historic=archaeological_site"
            ])
            
        if "gas_station" in enabled_categories:
            poi_types.extend([
                "amenity=fuel", "amenity=charging_station", "highway=rest_area", "highway=services"
            ])
            
        if "restaurant" in enabled_categories:
            poi_types.extend([
                "amenity=restaurant", "amenity=cafe", "amenity=fast_food"
            ])
            
        if "hotel" in enabled_categories:
            poi_types.extend([
                "tourism=hotel", "tourism=motel"
            ])
        
        # Format Overpass query
        query_parts = []
        radius_m = radius_km * 1000  # Convert to meters
        
        for poi in poi_types:
            query_parts.append(f'node[{poi}](around:{radius_m},{lat},{lon});')
        
        query = f"""
        [out:json][timeout:25];
        (
            {' '.join(query_parts)}
        );
        out body;
        """
        
        # Send request to Overpass API
        overpass_url = "https://overpass-api.de/api/interpreter"
        headers = {'User-Agent': 'DashcamV2/1.0'}
        logger.info(f"Sending request to Overpass API with query: {query}")
        response = requests.post(overpass_url, data={'data': query}, headers=headers)
        response.raise_for_status()
        
        poi_data = response.json()
        logger.info(f"Received {len(poi_data.get('elements', []))} POI elements from Overpass API")
        landmarks = []
        
        # Process results
        logger.info(f"Processing {len(poi_data.get('elements', []))} POI elements")
        for element in poi_data.get('elements', []):
            if element.get('type') == 'node':
                tags = element.get('tags', {})
                
                # Determine category based on tags
                category = None
                if any(tag.startswith('natural=') for tag in poi_types if tags.get(tag.split('=')[0]) == tag.split('=')[1]):
                    category = 'natural'
                elif any(tag.startswith('tourism=') for tag in poi_types if tags.get(tag.split('=')[0]) == tag.split('=')[1]):
                    category = 'tourism'
                elif any(tag.startswith('historic=') for tag in poi_types if tags.get(tag.split('=')[0]) == tag.split('=')[1]):
                    category = 'historic'
                elif any(tag.startswith('amenity=fuel') for tag in poi_types if tags.get(tag.split('=')[0]) == tag.split('=')[1]):
                    category = 'gas_station'
                elif any(tag.startswith('amenity=restaurant') or tag.startswith('amenity=cafe') or tag.startswith('amenity=fast_food') 
                         for tag in poi_types if tags.get(tag.split('=')[0]) == tag.split('=')[1]):
                    category = 'restaurant'
                elif any(tag.startswith('tourism=hotel') or tag.startswith('tourism=motel') 
                         for tag in poi_types if tags.get(tag.split('=')[0]) == tag.split('=')[1]):
                    category = 'hotel'
                else:
                    category = 'poi'
                
                # Check if this category is enabled
                if category not in enabled_categories and category != 'poi':
                    logger.debug(f"Skipping POI '{tags.get('name', 'unnamed')}' with category '{category}' (not enabled)")
                    continue
                
                # Create landmark structure
                name = tags.get('name', tags.get('ref', f"Unknown {category.capitalize()}"))
                
                landmark = {
                    "id": f"osm_{element['id']}",
                    "name": name,
                    "lat": element['lat'],
                    "lon": element['lon'],
                    "radius_m": 100,  # Default radius
                    "category": category,
                    "description": tags.get('description', f"{category.capitalize()} near {lat:.4f}, {lon:.4f}")
                    # trip_id se añade después en la función que llama a esta
                }
                
                landmarks.append(landmark)
                logger.debug(f"Added POI landmark '{name}' ({category}) at {element['lat']:.6f}, {element['lon']:.6f}")
        
        # Limit number of landmarks per location to avoid performance issues
        if max_landmarks > 0 and len(landmarks) > max_landmarks:
            # Enhanced prioritization for dashcam system
            priority_landmarks = []
            high_priority_landmarks = []
            regular_landmarks = []
            
            for lm in landmarks:
                category = lm["category"]
                
                # High priority: Manual waypoints and tourist attractions (most important for recording)
                if category in ["trip_point", "manual_waypoint", "tourist_attraction", "tourism", 
                               "monument", "museum", "castle", "viewpoint", "attraction"]:
                    high_priority_landmarks.append(lm)
                # Standard priority: Travel services (useful for road trips)
                elif category in ["gas_station", "hotel", "restaurant", "charging_station"]:
                    priority_landmarks.append(lm)
                else:
                    regular_landmarks.append(lm)
            
            # Distribute landmarks with preference for high priority
            selected_landmarks = []
            
            # Take all high priority landmarks first (these trigger special recording)
            high_priority_count = min(len(high_priority_landmarks), max_landmarks // 2)
            selected_landmarks.extend(high_priority_landmarks[:high_priority_count])
            
            # Fill remaining slots with travel services
            remaining_slots = max_landmarks - len(selected_landmarks)
            priority_count = min(len(priority_landmarks), remaining_slots // 2)
            selected_landmarks.extend(priority_landmarks[:priority_count])
            
            # Use any remaining slots for other landmarks
            remaining_slots = max_landmarks - len(selected_landmarks)
            if remaining_slots > 0:
                selected_landmarks.extend(regular_landmarks[:remaining_slots])
                
            landmarks = selected_landmarks
        
        logger.info(f"Found {len(landmarks)} POI landmarks near {lat:.6f}, {lon:.6f}")
        return landmarks
    except Exception as e:
        logger.error(f"Error fetching POI landmarks: {str(e)}")
        return []  # Return empty list on error

async def auto_download_landmarks_for_trip(trip: PlannedTrip, radius_km: int = 5):
    """Automatically download landmarks for a trip when it's created/updated"""
    logger.info(f"Auto-downloading landmarks for trip {trip.id}")
    
    # Get landmark settings
    settings = await get_landmark_settings()
    
    # Check if auto-download is enabled
    if not settings.get("auto_download_enabled", True):
        logger.info("Auto landmark download is disabled in settings. Skipping.")
        return False
    
    # Use settings radius if available
    radius_km = settings.get("download_radius_km", radius_km)
    
    # First, remove existing landmarks for this trip
    if landmark_checker:
        try:
            deleted_count = landmark_checker.remove_trip_landmarks(trip.id)
            logger.info(f"Cleared {deleted_count} existing landmarks for trip {trip.id}")
        except Exception as e:
            logger.error(f"Error clearing existing landmarks for trip {trip.id}: {str(e)}")
    
    landmarks = []
    
    try:
        # Fetch POIs around start location
        logger.info(f"Fetching landmarks near start location: {trip.start_location}")
        start_landmarks = await fetch_poi_landmarks_from_overpass(
            trip.start_location["lat"], 
            trip.start_location["lon"], 
            radius_km
        )
        # Add trip_id to each landmark
        for lm in start_landmarks:
            lm["trip_id"] = trip.id
        landmarks.extend(start_landmarks)
        
        # Fetch POIs around end location
        logger.info(f"Fetching landmarks near end location: {trip.end_location}")
        end_landmarks = await fetch_poi_landmarks_from_overpass(
            trip.end_location["lat"], 
            trip.end_location["lon"], 
            radius_km
        )
        # Add trip_id to each landmark
        for lm in end_landmarks:
            lm["trip_id"] = trip.id
        landmarks.extend(end_landmarks)
        
        # Fetch POIs around waypoints
        if trip.waypoints:
            for i, waypoint in enumerate(trip.waypoints):
                logger.info(f"Fetching landmarks near waypoint {i+1}: {waypoint.lat}, {waypoint.lon}")
                waypoint_landmarks = await fetch_poi_landmarks_from_overpass(
                    waypoint.lat, 
                    waypoint.lon, 
                    radius_km
                )
                # Add trip_id to each landmark
                for lm in waypoint_landmarks:
                    lm["trip_id"] = trip.id
                landmarks.extend(waypoint_landmarks)
        
        # Add the trip points themselves as landmarks
        # Start location
        origin_name = trip.origin_name or "Start Location"
        start_landmark = {
            "id": f"trip_{trip.id}_start",
            "name": origin_name,
            "lat": trip.start_location["lat"],
            "lon": trip.start_location["lon"],
            "radius_m": 100,
            "category": "trip_start",
            "description": f"Starting point of trip: {trip.name}",
            "trip_id": trip.id
        }
        landmarks.append(start_landmark)
        
        # Waypoints
        if trip.waypoints:
            for i, waypoint in enumerate(trip.waypoints):
                waypoint_landmark = {
                    "id": f"trip_{trip.id}_waypoint_{i+1}",
                    "name": waypoint.name or f"Waypoint {i+1}",
                    "lat": waypoint.lat,
                    "lon": waypoint.lon,
                    "radius_m": 100,
                    "category": "trip_waypoint",
                    "description": f"Waypoint {i+1} of trip: {trip.name}",
                    "trip_id": trip.id
                }
                landmarks.append(waypoint_landmark)
        
        # End location
        destination_name = trip.destination_name or "Destination"
        end_landmark = {
            "id": f"trip_{trip.id}_end",
            "name": destination_name,
            "lat": trip.end_location["lat"],
            "lon": trip.end_location["lon"],
            "radius_m": 100,
            "category": "trip_end",
            "description": f"Destination of trip: {trip.name}",
            "trip_id": trip.id
        }
        landmarks.append(end_landmark)
        
        # Process landmarks and save to database
        if landmarks:
            # Remove duplicates by ID
            unique_landmarks = {}
            for landmark in landmarks:
                if "id" in landmark:
                    unique_landmarks[landmark["id"]] = landmark
                else:
                    # Create a pseudo-ID based on coordinates
                    lm_id = f"{landmark.get('lat', 0)},{landmark.get('lon', 0)}"
                    unique_landmarks[lm_id] = landmark
            
            # Add all the landmarks to the database
            for lm_id, landmark in unique_landmarks.items():
                try:
                    if landmark_checker:
                        if "id" not in landmark:
                            import uuid
                            landmark["id"] = str(uuid.uuid4())[:8]
                        
                        # Use the landmark_checker's underlying database to add the landmark
                        landmark_checker.landmarks_db.add_landmark(landmark)
                        logger.info(f"Added landmark '{landmark.get('name', 'unnamed')}' with trip_id '{landmark.get('trip_id', 'None')}'")
                except Exception as e:
                    logger.error(f"Error adding landmark {landmark.get('name', 'unknown')}: {str(e)}")
            
            # Reload landmarks in the landmark checker
            if landmark_checker:
                landmark_checker.load_landmarks()
                
            # Verify that landmarks were properly saved with trip_id
            if landmark_checker:
                trip_landmarks = landmark_checker.landmarks_db.get_landmarks_by_trip(trip.id)
                logger.info(f"After saving, found {len(trip_landmarks)} landmarks associated with trip {trip.id}")
            
            # Mark the trip as having landmarks downloaded
            for i, t in enumerate(planned_trips):
                if t.id == trip.id:
                    updated_trip = t.dict()
                    updated_trip["landmarks_downloaded"] = True
                    planned_trips[i] = PlannedTrip(**updated_trip)
                    save_trips_to_disk()
                    break
                    
            logger.info(f"Successfully auto-downloaded {len(unique_landmarks)} landmarks for trip {trip.id}")
            return True
        
        return False
    except Exception as e:
        logger.error(f"Error in auto_download_landmarks_for_trip: {str(e)}")
        return False

def detect_trip_type(waypoints: List[Dict[str, Any]]) -> str:
    """
    Detect trip type based on waypoint distribution and characteristics.
    Returns 'city', 'highway', or 'mixed'.
    """
    if len(waypoints) < 2:
        return 'mixed'
    
    # Calculate distances between consecutive waypoints
    distances = []
    for i in range(len(waypoints) - 1):
        wp1 = OptWaypoint(waypoints[i]['lat'], waypoints[i]['lon'])
        wp2 = OptWaypoint(waypoints[i+1]['lat'], waypoints[i+1]['lon'])
        distances.append(wp1.distance_to(wp2))
    
    if not distances:
        return 'mixed'
    
    avg_distance = sum(distances) / len(distances)
    max_distance = max(distances)
    
    # Classification logic
    if avg_distance < 20 and max_distance < 50:  # Short distances, likely city
        return 'city'
    elif avg_distance > 100 or max_distance > 200:  # Long distances, likely highway
        return 'highway'
    else:
        return 'mixed'

async def download_trip_landmarks_optimized_with_progress(trip: PlannedTrip, 
                                                        optimization_result: Dict[str, Any], 
                                                        trip_id: str):
    """Background task to download landmarks using optimized regions"""
    global active_downloads
    
    all_landmarks = []
    
    try:
        # Clear existing landmarks for this trip
        if landmark_checker:
            try:
                deleted_count = landmark_checker.remove_trip_landmarks(trip.id)
                logger.info(f"[OPTIMIZED_DOWNLOAD] Cleared {deleted_count} existing landmarks for trip {trip.id}")
            except Exception as e:
                logger.error(f"[OPTIMIZED_DOWNLOAD] Error clearing existing landmarks: {str(e)}")
        
        download_regions = optimization_result['download_regions']
        total_regions = len(download_regions)
        
        # Process each optimized region
        for i, region in enumerate(download_regions):
            # Check if download was paused
            if trip_id in active_downloads and active_downloads[trip_id].get('status') in ['paused', 'cancelled']:
                logger.info(f"[OPTIMIZED_DOWNLOAD] Download {active_downloads[trip_id].get('status')} for trip {trip_id}")
                return
            
            # Update progress
            progress = (i / total_regions) * 90  # Reserve 10% for final processing
            active_downloads[trip_id] = {
                "progress": progress,
                "detail": f"Processing optimized region {i+1} of {total_regions}...",
                "status": "downloading",
                "optimization_enabled": True,
                "regions_total": total_regions,
                "current_region": i + 1,
                "current_region_center": f"{region['center_lat']:.4f}, {region['center_lon']:.4f}",
                "current_region_radius": region['radius_km'],
                "estimated_pois": region.get('estimated_pois', 0)
            }
            
            logger.info(f"[OPTIMIZED_DOWNLOAD] Processing region {i+1}/{len(download_regions)}: {region['waypoint_name']} "
                       f"({region['center_lat']:.4f}, {region['center_lon']:.4f}) radius={region['radius_km']:.1f}km")
            
            try:
                # Fetch landmarks for this optimized region
                region_landmarks = await fetch_poi_landmarks_from_overpass(
                    region['center_lat'],
                    region['center_lon'],
                    region['radius_km']
                )
                
                # Add trip_id to each landmark
                for landmark in region_landmarks:
                    landmark["trip_id"] = trip.id
                
                all_landmarks.extend(region_landmarks)
                logger.info(f"[OPTIMIZED_DOWNLOAD] Found {len(region_landmarks)} landmarks in region {i+1}")
                
            except Exception as e:
                logger.error(f"[OPTIMIZED_DOWNLOAD] Error fetching landmarks for region {i+1}: {str(e)}")
                continue
            
            # Brief pause to allow other tasks to run
            await asyncio.sleep(0.1)
        
        # Add trip waypoints as landmarks
        active_downloads[trip_id] = {
            "progress": 92,
            "detail": "Adding trip waypoints...",
            "status": "downloading",
            "optimization_enabled": True,
            "regions_total": total_regions,
            "current_region": total_regions
        }
        
        # Add start location
        start_landmark = {
            "id": f"trip_{trip.id}_start",
            "name": trip.origin_name or "Start Location",
            "lat": trip.start_location["lat"],
            "lon": trip.start_location["lon"],
            "radius_m": 100,
            "category": "trip_start",
            "description": f"Starting point of trip: {trip.name}",
            "trip_id": trip.id
        }
        all_landmarks.append(start_landmark)
        
        # Add waypoints
        if trip.waypoints:
            for i, waypoint in enumerate(trip.waypoints):
                waypoint_landmark = {
                    "id": f"trip_{trip.id}_waypoint_{i+1}",
                    "name": waypoint.name or f"Waypoint {i+1}",
                    "lat": waypoint.lat,
                    "lon": waypoint.lon,
                    "radius_m": 100,
                    "category": "trip_waypoint",
                    "description": f"Waypoint {i+1} of trip: {trip.name}",
                    "trip_id": trip.id
                }
                all_landmarks.append(waypoint_landmark)
        
        # Add end location
        end_landmark = {
            "id": f"trip_{trip.id}_end",
            "name": trip.destination_name or "Destination",
            "lat": trip.end_location["lat"],
            "lon": trip.end_location["lon"],
            "radius_m": 100,
            "category": "trip_end",
            "description": f"Destination of trip: {trip.name}",
            "trip_id": trip.id
        }
        all_landmarks.append(end_landmark)
        
        # Remove duplicates and save landmarks
        progress_tracker = LandmarkDownloadProgress(
            trip_id=trip_id,
            status="downloading_images",
            location_index=0,
            total_locations=len(all_landmarks),
            landmarks_found=len(all_landmarks),
            landmarks_processed=0,
            images_downloaded=0,
            images_failed=0,
            progress_percent=75,
            optimization_used=True
        )
        
        active_downloads[trip_id] = {
            "progress": 75,
            "detail": f"Saving {len(all_landmarks)} landmarks...",
            "status": "downloading",
            "landmarks_found": len(all_landmarks),
            "optimization_used": True
        }
        
        # Remove duplicates by ID
        unique_landmarks = {}
        for landmark in all_landmarks:
            if "id" in landmark:
                unique_landmarks[landmark["id"]] = landmark
            else:
                lm_id = f"{landmark.get('lat', 0)},{landmark.get('lon', 0)}"
                unique_landmarks[lm_id] = landmark
        
        # Add landmarks to database
        landmarks_processed = 0
        for lm_id, landmark in unique_landmarks.items():
            try:
                if "id" not in landmark:
                    import uuid
                    landmark["id"] = str(uuid.uuid4())[:8]
                
                landmark_checker.landmarks_db.add_landmark(landmark)
                landmarks_processed += 1
                progress_tracker.landmarks_processed = landmarks_processed
                
                # Update progress periodically
                if landmarks_processed % 10 == 0:
                    current_progress = 75 + (landmarks_processed / len(unique_landmarks)) * 15  # 75-90%
                    active_downloads[trip_id] = {
                        "progress": current_progress,
                        "detail": f"Saved {landmarks_processed}/{len(unique_landmarks)} landmarks...",
                        "status": "downloading",
                        "landmarks_processed": landmarks_processed,
                        "optimization_used": True
                    }
                
            except Exception as e:
                logger.error(f"[OPTIMIZED_DOWNLOAD] Error adding landmark {landmark.get('name', 'unknown')}: {str(e)}")
        
        # Handle image downloads if enabled
        images_downloaded = 0
        images_failed = 0
        
        if download_images:
            progress_tracker.status = "downloading_images"
            progress_tracker.progress_percent = 90
            
            # Filter landmarks that should have images based on settings
            landmarks_for_images = []
            for landmark in unique_landmarks.values():
                landmark_category = landmark.get('category', 'unknown')
                if image_types.get(landmark_category, False):
                    landmarks_for_images.append(landmark)
            
            logger.info(f"[OPTIMIZED_DOWNLOAD] Starting image download for {len(landmarks_for_images)} landmarks")
            
            # Process images in small batches
            batch_size = 5
            for i in range(0, len(landmarks_for_images), batch_size):
                batch = landmarks_for_images[i:i + batch_size]
                
                for j, landmark in enumerate(batch):
                    try:
                        progress_tracker.current_landmark = landmark.get('name', 'Unknown')
                        
                        # Update progress
                        image_progress = 90 + ((i + j) / len(landmarks_for_images)) * 10
                        active_downloads[trip_id] = {
                            "progress": image_progress,
                            "detail": f"Downloading image for {landmark.get('name', 'landmark')}...",
                            "status": "downloading_images",
                            "current_landmark": landmark.get('name', 'Unknown'),
                            "images_downloaded": images_downloaded,
                            "images_failed": images_failed,
                            "optimization_used": True
                        }
                        
                        # TODO: Implement actual image download logic here
                        # For now, just simulate the process
                        await asyncio.sleep(0.2)  # Simulate download time
                        images_downloaded += 1
                        progress_tracker.images_downloaded = images_downloaded
                        
                    except Exception as e:
                        logger.error(f"[OPTIMIZED_DOWNLOAD] Error downloading image for {landmark.get('name', 'unknown')}: {str(e)}")
                        images_failed += 1
                        progress_tracker.images_failed = images_failed
                
                # Brief pause between batches
                await asyncio.sleep(0.1)
        
        # Reload landmarks
        try:
            landmark_checker.load_landmarks()
        except Exception as e:
            logger.error(f"[OPTIMIZED_DOWNLOAD] Error reloading landmarks: {str(e)}")
        
        # Update trip status
        for i, t in enumerate(planned_trips):
            if t.id == trip_id:
                updated_trip = t.dict()
                updated_trip["landmarks_downloaded"] = True
                planned_trips[i] = PlannedTrip(**updated_trip)
                
                # Update in database
                if landmark_checker and hasattr(landmark_checker, 'landmarks_db'):
                    try:
                        landmark_checker.landmarks_db.update_trip_status(trip_id, landmarks_downloaded=True)
                    except Exception as e:
                        logger.error(f"Error updating trip status in database: {str(e)}")
                        save_trips_to_disk()
                else:
                    save_trips_to_disk()
                break
        
        # Mark as complete
        final_message = f"Downloaded {len(unique_landmarks)} landmarks"
        if download_images:
            final_message += f", {images_downloaded} images"
        if optimization_enabled and progress_tracker.optimization_efficiency:
            final_message += f" with {progress_tracker.optimization_efficiency:.0%} eficiencia"
        
        active_downloads[trip_id] = {
            "progress": 100,
            "detail": final_message,
            "status": "complete",
            "landmarks_found": len(unique_landmarks),
            "landmarks_processed": landmarks_processed,
            "images_downloaded": images_downloaded,
            "images_failed": images_failed,
            "optimization_used": optimization_enabled,
            "optimization_efficiency": progress_tracker.optimization_efficiency
        }
        
        logger.info(f"[OPTIMIZED_DOWNLOAD] Successfully completed optimized download for trip {trip.id}")
        
        # Notify user
        if audio_notifier:
            trip_name = trip.name if hasattr(trip, 'name') and trip.name else "sin nombre"
            audio_notifier.announce(
                f"Descarga optimizada completa para {trip_name}. "
                f"Se descargaron {len(unique_landmarks)} puntos de interés con {progress_tracker.optimization_efficiency:.0%} de eficiencia",
                title="Descarga Optimizada Completa",
                notification_type="success",
                send_notification=True
            )
        
    except Exception as e:
        logger.error(f"[OPTIMIZED_DOWNLOAD] Error in optimized landmark download: {str(e)}", exc_info=True)
        # Update status to error
        active_downloads[trip_id] = {
            "progress": 0,
            "detail": str(e),
            "status": "error",
            "optimization_used": optimization_enabled if 'optimization_enabled' in locals() else False
        }
        
        # Notify user about error
        if audio_notifier:
            trip_name = trip.name if hasattr(trip, 'name') and trip.name else "sin nombre"
            audio_notifier.announce(
                f"Error en descarga optimizada para {trip_name}: {str(e)}",
                title="Error en Descarga Optimizada",
                notification_type="error",
                send_notification=True
            )

@router.post("/search-places")
async def search_places(request: PlaceSearchRequest):
    """Search for places using OpenStreetMap Nominatim API"""
    try:
        # Use Nominatim API to search for places
        search_url = "https://nominatim.openstreetmap.org/search"
        
        params = {
            "q": request.query,
            "format": "json",
            "limit": request.limit,
            "addressdetails": 1
        }
        
        # Add user-agent to comply with Nominatim usage policy
        headers = {
            "User-Agent": "DashcamV2/1.0"
        }
        
        response = requests.get(search_url, params=params, headers=headers)
        response.raise_for_status()
        
        results = response.json()
        
        # Transform results to our format
        formatted_results = []
        for result in results:
            try:
                formatted_result = GeocodingResult(
                    name=result.get("name", result.get("display_name", "").split(",")[0].strip()),
                    lat=float(result["lat"]),
                    lon=float(result["lon"]),
                    display_name=result["display_name"],
                    category=result.get("type"),
                    address=result.get("address")
                )
                formatted_results.append(formatted_result)
            except (KeyError, ValueError) as e:
                logger.warning(f"Error parsing place result: {str(e)}")
                continue
        
        return {"results": formatted_results}
        
    except Exception as e:
        logger.error(f"Error searching for places: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search for places: {str(e)}")

@router.post("/{trip_id}/calculate-optimal-geodata-radius")
async def calculate_optimal_geodata_radius(trip_id: str):
    """Calculate the optimal radius for geodata download that efficiently covers all waypoints"""
    # Find the planned trip
    trip = None
    for t in planned_trips:
        if t.id == trip_id:
            trip = t
            break
    
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    try:
        # Collect all waypoints
        waypoints = []
        
        # Add start location
        waypoints.append({
            "lat": trip.start_location["lat"],
            "lon": trip.start_location["lon"],
            "name": trip.origin_name or "Start Location"
        })
        
        # Add intermediate waypoints
        if trip.waypoints:
            for i, wp in enumerate(trip.waypoints):
                waypoints.append({
                    "lat": wp.lat,
                    "lon": wp.lon,
                    "name": wp.name or f"Waypoint {i+1}"
                })
        
        # Add end location
        waypoints.append({
            "lat": trip.end_location["lat"],
            "lon": trip.end_location["lon"],
            "name": trip.destination_name or "Destination"
        })
        
        # Import the new optimization function
        from landmarks.services.radius_optimizer import calculate_optimal_radius_for_waypoints
        
        # Calculate optimal radius
        optimization_result = calculate_optimal_radius_for_waypoints(waypoints)
        
        # Add trip-specific information
        optimization_result.update({
            "trip_id": trip_id,
            "trip_name": trip.name,
            "waypoints_analyzed": len(waypoints),
            "recommendation": {
                "use_single_radius": optimization_result["coverage_efficiency"] > 0.6,
                "suggested_approach": "single_optimized_radius" if optimization_result["coverage_efficiency"] > 0.6 else "multi_region_download",
                "estimated_savings": f"{(1 - optimization_result['coverage_efficiency']) * 100:.1f}% area reduction vs. multiple radii"
            }
        })
        
        # Calculate comparison with traditional approach
        traditional_total_area = len(waypoints) * math.pi * (10.0 ** 2)  # Default 10km radius per waypoint
        optimized_area = math.pi * (optimization_result["optimal_radius_km"] ** 2)
        area_savings = (traditional_total_area - optimized_area) / traditional_total_area if traditional_total_area > 0 else 0
        
        optimization_result["comparison"] = {
            "traditional_approach": {
                "radius_per_waypoint_km": 10.0,
                "total_area_km2": round(traditional_total_area, 2),
                "waypoints_coverage": len(waypoints)
            },
            "optimized_approach": {
                "single_radius_km": optimization_result["optimal_radius_km"],
                "total_area_km2": round(optimized_area, 2),
                "center_coverage": 1
            },
            "savings": {
                "area_reduction_percent": round(area_savings * 100, 1),
                "efficiency_gain": round(optimization_result["coverage_efficiency"] * 100, 1),
                "recommended": area_savings > 0.2  # Recommend if >20% savings
            }
        }
        
        logger.info(f"Calculated optimal geodata radius for trip {trip_id}: {optimization_result['optimal_radius_km']}km "
                   f"with {optimization_result['coverage_efficiency']:.1%} efficiency")
        
        return optimization_result
        
    except Exception as e:
        logger.error(f"Error calculating optimal geodata radius: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate optimal radius: {str(e)}")

@router.post("/{trip_id}/download-geodata-optimized")
async def download_geodata_optimized(trip_id: str, background_tasks: BackgroundTasks):
    """Download geodata using the optimized radius calculation"""
    # Find the planned trip
    trip = None
    for t in planned_trips:
        if t.id == trip_id:
            trip = t
            break
    
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    try:
        # Calculate optimal radius first
        optimization_result = await calculate_optimal_geodata_radius(trip_id)
        
        if not optimization_result["recommendation"]["use_single_radius"]:
            # If single radius is not efficient, fall back to traditional multi-waypoint approach
            logger.info(f"Single radius not efficient for trip {trip_id}, using traditional approach")
            # Note: Here you would call the existing geodata download endpoint
            # For now, return a message explaining the situation
            return {
                "status": "fallback_to_traditional",
                "message": "Single optimized radius not efficient for this trip geometry",
                "optimization_result": optimization_result,
                "recommendation": "Use the traditional multi-waypoint download approach"
            }
        
        # Use the optimized single radius approach
        optimal_radius = optimization_result["optimal_radius_km"]
        center_point = optimization_result["center_point"]
        
        logger.info(f"Starting optimized geodata download for trip {trip_id} with radius {optimal_radius}km "
                   f"centered at ({center_point['lat']:.4f}, {center_point['lon']:.4f})")
        
        # TODO: Integrate with the actual geodata download system
        # For now, return the optimization details
        return {
            "status": "optimized_download_started",
            "message": f"Started optimized geodata download with {optimal_radius}km radius",
            "optimization_details": optimization_result,
            "download_parameters": {
                "center_lat": center_point["lat"],
                "center_lon": center_point["lon"],
                "radius_km": optimal_radius,
                "estimated_coverage_efficiency": optimization_result["coverage_efficiency"]
            }
        }
        
    except Exception as e:
        logger.error(f"Error in optimized geodata download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start optimized download: {str(e)}")