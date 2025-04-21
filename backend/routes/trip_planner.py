from fastapi import APIRouter, HTTPException, BackgroundTasks
import json
import os
import requests
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel

# Import our new data persistence module
from data_persistence import get_persistence_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Will be initialized from main.py
landmark_checker = None
trip_logger = None
config = None

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
    """Initialize trips storage and load existing trips from file"""
    global planned_trips
    
    # Get persistence manager instance
    persistence = get_persistence_manager()
    
    # Load trips from file
    try:
        trips_data = persistence.load_json('planned_trips.json', default=[])
        
        # Convert dictionaries to PlannedTrip objects
        planned_trips = [PlannedTrip(**trip) for trip in trips_data]
        logger.info(f"Loaded {len(planned_trips)} planned trips from disk")
    except Exception as e:
        logger.error(f"Error loading trips from file: {str(e)}")
        # Initialize with empty list if loading fails
        planned_trips = []

def save_trips_to_disk():
    """Save trips to disk for persistence"""
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
            logger.info(f"Saved {len(planned_trips)} trips to disk")
        return result
    except Exception as e:
        logger.error(f"Error saving trips to disk: {str(e)}")
        return False

@router.get("")
async def get_planned_trips():
    """Get all planned trips"""
    today = datetime.now().strftime("%Y-%m-%d")
    
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
    for trip in planned_trips:
        if trip.id == trip_id:
            return trip
    raise HTTPException(status_code=404, detail="Planned trip not found")

@router.post("")
async def create_planned_trip(trip: PlannedTrip):
    """Create a new planned trip"""
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
    
    planned_trips.append(trip)
    save_trips_to_disk()
    return trip

@router.put("/{trip_id}")
async def update_planned_trip(trip_id: str, updated_trip: PlannedTrip):
    """Update an existing planned trip"""
    for i, trip in enumerate(planned_trips):
        if trip.id == trip_id:
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
                
            planned_trips[i] = updated_trip
            save_trips_to_disk()
            return updated_trip
    raise HTTPException(status_code=404, detail="Planned trip not found")

@router.delete("/{trip_id}")
async def delete_planned_trip(trip_id: str):
    """Delete a planned trip"""
    global planned_trips
    original_length = len(planned_trips)
    planned_trips = [trip for trip in planned_trips if trip.id != trip_id]
    
    if len(planned_trips) < original_length:
        save_trips_to_disk()
        return {"status": "success", "message": "Planned trip deleted"}
    raise HTTPException(status_code=404, detail="Planned trip not found")

@router.post("/{trip_id}/download-landmarks")
async def download_landmarks_for_trip(trip_id: str, background_tasks: BackgroundTasks, radius_km: int = 10):
    """Download landmarks for a planned trip route"""
    # Find the planned trip
    trip = None
    for t in planned_trips:
        if t.id == trip_id:
            trip = t
            break
    
    if not trip:
        raise HTTPException(status_code=404, detail="Planned trip not found")
    
    try:
        # Run landmark download in the background to avoid blocking the request
        background_tasks.add_task(
            download_trip_landmarks, 
            trip, 
            radius_km
        )
        
        # Update trip status immediately for better UX
        for i, t in enumerate(planned_trips):
            if t.id == trip_id:
                updated_trip = t.dict()
                updated_trip["landmarks_downloaded"] = True
                planned_trips[i] = PlannedTrip(**updated_trip)
                save_trips_to_disk()
                break
        
        return {
            "status": "success", 
            "message": f"Downloading landmarks for trip (processing in background)",
        }
    
    except Exception as e:
        logger.error(f"Error downloading landmarks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download landmarks: {str(e)}")

@router.post("/{trip_id}/mark-completed")
async def mark_trip_completed(trip_id: str, completed: bool = True):
    """Mark a trip as completed or not completed"""
    for i, trip in enumerate(planned_trips):
        if trip.id == trip_id:
            updated_trip = trip.dict()
            updated_trip["completed"] = completed
            planned_trips[i] = PlannedTrip(**updated_trip)
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