import json
import logging
import math
import time
import requests
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
import uuid

# Import our dependencies
from data_persistence import get_persistence_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LandmarkDownloadService:
    """Service for downloading and managing landmark data"""
    
    def __init__(self, landmark_checker=None, audio_notifier=None, settings_manager=None):
        self.landmark_checker = landmark_checker
        self.audio_notifier = audio_notifier
        self.settings_manager = settings_manager
        self.active_downloads = {}
    
    async def get_landmark_settings(self):
        """Get the current landmark download settings"""
        # Define default settings outside the try block
        default_settings = {
            "auto_download_enabled": True,
            "download_radius_km": 5,
            "max_landmarks_per_location": 15,
            "point_categories": [
                "gas_station", "restaurant", "hotel", 
                "natural", "tourism", "historic"
            ],
            "auto_cleanup": True,
            "cleanup_radius_km": 50,
            "max_landmark_age_days": 60,
            # New image download settings
            "download_images": True,
            "image_download_categories": [
                "restaurant", "hotel", "tourism", "historic"
            ],
            "max_image_size_mb": 5,
            "image_quality": "medium",  # "low", "medium", "high"
            "skip_duplicates": True,
            # Optimization settings
            "enable_optimization": True,
            "optimization_tolerance": 0.3,
            # Progress and feedback settings
            "show_detailed_progress": True,
            "enable_audio_notifications": True
        }
        
        try:
            if self.settings_manager:
                settings = self.settings_manager.get_settings("landmarks")
            else:
                persistence = get_persistence_manager()
                settings = persistence.load_json('landmark_settings.json', subdirectory='settings', default={})
            
            # Fill in any missing settings with defaults
            for key, value in default_settings.items():
                if key not in settings:
                    settings[key] = value
            
            # Ensure numeric values are actually integers
            numeric_keys = ["download_radius_km", "max_landmarks_per_location", "cleanup_radius_km", "max_landmark_age_days"]
            for key in numeric_keys:
                if key in settings:
                    try:
                        settings[key] = int(settings[key])
                    except (ValueError, TypeError):
                        # If conversion fails, use default
                        settings[key] = default_settings.get(key)
                    
            return settings
        except Exception as e:
            logger.error(f"Error loading landmark settings: {str(e)}")
            return default_settings

    async def fetch_poi_landmarks_from_overpass(self, lat, lon, radius_km=5):
        """Fetch points of interest around a location using Overpass API
        
        This function queries the Overpass API for various types of points of interest
        such as tourist attractions, restaurants, gas stations, etc. around a specific location.
        """
        try:
            # Get landmark settings
            settings = await self.get_landmark_settings()
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
            response = requests.post(overpass_url, data={'data': query}, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            landmarks = []
            
            for element in data.get('elements', []):
                if element.get('type') == 'node':
                    tags = element.get('tags', {})
                    
                    # Create landmark object
                    landmark = {
                        "id": str(element.get('id')),
                        "name": tags.get('name', tags.get('brand', 'Unknown')),
                        "lat": float(element.get('lat')),
                        "lon": float(element.get('lon')),
                        "radius_m": 100,  # Default radius
                        "category": self._determine_category(tags),
                        "description": self._create_description(tags),
                        "tags": tags
                    }
                    
                    landmarks.append(landmark)
            
            # Limit results if necessary
            if len(landmarks) > max_landmarks:
                landmarks = landmarks[:max_landmarks]
            
            logger.info(f"Found {len(landmarks)} landmarks from Overpass API")
            return landmarks
            
        except Exception as e:
            logger.error(f"Error fetching landmarks from Overpass API: {str(e)}")
            return []

    def _determine_category(self, tags):
        """Determine landmark category from OSM tags"""
        # Priority order for category determination
        category_mapping = {
            'amenity': {
                'fuel': 'gas_station',
                'charging_station': 'gas_station',
                'restaurant': 'restaurant',
                'cafe': 'restaurant',
                'fast_food': 'restaurant'
            },
            'tourism': {
                'hotel': 'hotel',
                'motel': 'hotel',
                'attraction': 'tourism',
                'viewpoint': 'tourism',
                'museum': 'tourism',
                'artwork': 'tourism',
                'theme_park': 'tourism',
                'zoo': 'tourism',
                'aquarium': 'tourism'
            },
            'historic': {
                'monument': 'historic',
                'castle': 'historic',
                'memorial': 'historic',
                'archaeological_site': 'historic'
            },
            'natural': {
                'peak': 'natural',
                'bay': 'natural',
                'beach': 'natural',
                'glacier': 'natural',
                'hot_spring': 'natural',
                'volcano': 'natural',
                'valley': 'natural'
            },
            'highway': {
                'rest_area': 'gas_station',
                'services': 'gas_station'
            }
        }
        
        for tag_key, value_mapping in category_mapping.items():
            if tag_key in tags:
                tag_value = tags[tag_key]
                if tag_value in value_mapping:
                    return value_mapping[tag_value]
        
        return 'other'

    def _create_description(self, tags):
        """Create a description from OSM tags"""
        description_parts = []
        
        # Add type information
        if 'amenity' in tags:
            description_parts.append(f"Amenity: {tags['amenity'].replace('_', ' ').title()}")
        elif 'tourism' in tags:
            description_parts.append(f"Tourism: {tags['tourism'].replace('_', ' ').title()}")
        elif 'historic' in tags:
            description_parts.append(f"Historic: {tags['historic'].replace('_', ' ').title()}")
        elif 'natural' in tags:
            description_parts.append(f"Natural: {tags['natural'].replace('_', ' ').title()}")
        
        # Add address if available
        if 'addr:street' in tags:
            address_parts = []
            if 'addr:housenumber' in tags:
                address_parts.append(tags['addr:housenumber'])
            address_parts.append(tags['addr:street'])
            if 'addr:city' in tags:
                address_parts.append(tags['addr:city'])
            description_parts.append(f"Address: {' '.join(address_parts)}")
        
        # Add other useful information
        if 'phone' in tags:
            description_parts.append(f"Phone: {tags['phone']}")
        if 'website' in tags:
            description_parts.append(f"Website: {tags['website']}")
        if 'opening_hours' in tags:
            description_parts.append(f"Hours: {tags['opening_hours']}")
        
        return " | ".join(description_parts) if description_parts else "Point of Interest"

    async def download_trip_landmarks_with_progress(self, trip, radius_km: int, trip_id: str, planned_trips=None, save_trips_to_disk=None):
        """Background task to download landmarks for a trip with enhanced granular progress tracking"""
        all_landmarks = []
        start_time = time.time()
        
        try:
            # Get landmark settings to respect user preferences
            landmark_settings = await self.get_landmark_settings()
            download_images = landmark_settings.get("download_images", True)
            image_categories = landmark_settings.get("image_download_categories", ["restaurant", "hotel", "tourism", "historic"])
            max_landmarks_per_location = landmark_settings.get("max_landmarks_per_location", 15)
            
            # First, remove existing landmarks for this trip
            if self.landmark_checker:
                try:
                    deleted_count = self.landmark_checker.remove_trip_landmarks(trip.id)
                    logger.info(f"[LANDMARK_DOWNLOAD] Cleared {deleted_count} existing landmarks for trip {trip.id}")
                except Exception as e:
                    logger.error(f"[LANDMARK_DOWNLOAD] Error clearing existing landmarks for trip {trip.id}: {str(e)}")
            
            # Calculate total steps for granular progress tracking
            locations = []
            
            # Add start location
            locations.append({
                "lat": trip.start_location["lat"],
                "lon": trip.start_location["lon"],
                "name": getattr(trip, 'origin_name', None) or "Start Location",
                "type": "start"
            })
            
            # Add waypoints
            if hasattr(trip, 'waypoints') and trip.waypoints:
                for i, waypoint in enumerate(trip.waypoints):
                    locations.append({
                        "lat": waypoint.lat,
                        "lon": waypoint.lon,
                        "name": getattr(waypoint, 'name', None) or f"Waypoint {i+1}",
                        "type": "waypoint",
                        "index": i
                    })
            
            # Add end location
            locations.append({
                "lat": trip.end_location["lat"],
                "lon": trip.end_location["lon"],
                "name": getattr(trip, 'destination_name', None) or "Destination",
                "type": "end"
            })
            
            total_locations = len(locations)
            total_landmarks_downloaded = 0
            total_images_downloaded = 0
            failed_downloads = 0
            
            for location_index, location in enumerate(locations):
                # Check if download was paused or cancelled
                if trip_id in self.active_downloads:
                    status = self.active_downloads[trip_id].get('status')
                    if status == 'paused':
                        logger.info(f"[LANDMARK_DOWNLOAD] Download paused for trip {trip_id}")
                        return
                    elif status == 'cancelled':
                        logger.info(f"[LANDMARK_DOWNLOAD] Download cancelled for trip {trip_id}")
                        return
                
                # Update location progress
                location_progress = (location_index / total_locations) * 100
                elapsed_time = time.time() - start_time
                estimated_total_time = (elapsed_time / (location_index + 1)) * total_locations if location_index > 0 else 0
                estimated_remaining = max(0, estimated_total_time - elapsed_time)
                
                # Enhanced progress data with granular information
                self.active_downloads[trip_id] = {
                    "progress": location_progress,
                    "detail": f"Procesando {location['name']}...",
                    "status": "downloading",
                    "type": "landmarks",
                    # Granular progress information
                    "current_location_index": location_index,
                    "current_location_name": location['name'],
                    "locations_processed": location_index,
                    "total_locations": total_locations,
                    "landmarks_downloaded": total_landmarks_downloaded,
                    "images_downloaded": total_images_downloaded,
                    "failed_downloads": failed_downloads,
                    "current_phase": "fetching_landmarks",
                    "estimated_time_remaining": f"{int(estimated_remaining // 60):02d}:{int(estimated_remaining % 60):02d}" if estimated_remaining > 0 else "Calculando...",
                    "download_speed_landmarks_per_min": (total_landmarks_downloaded / (elapsed_time / 60)) if elapsed_time > 0 else 0,
                    "settings_used": {
                        "radius_km": radius_km,
                        "download_images": download_images,
                        "max_landmarks_per_location": max_landmarks_per_location,
                        "image_categories": image_categories
                    }
                }
                
                logger.info(f"[LANDMARK_DOWNLOAD] Processing location {location_index + 1}/{total_locations}: {location['name']} ({location['lat']}, {location['lon']})")
                
                try:
                    # Update phase to landmark fetching
                    self.active_downloads[trip_id]["current_phase"] = "fetching_landmarks"
                    self.active_downloads[trip_id]["detail"] = f"Obteniendo landmarks cerca de {location['name']}..."
                    
                    # Get landmarks from Overpass API
                    location_landmarks = await self.fetch_poi_landmarks_from_overpass(
                        location["lat"], 
                        location["lon"], 
                        radius_km
                    )
                    
                    # Limit landmarks per location based on settings
                    if len(location_landmarks) > max_landmarks_per_location:
                        location_landmarks = location_landmarks[:max_landmarks_per_location]
                    
                    # Assign trip_id to each landmark
                    for landmark in location_landmarks:
                        landmark["trip_id"] = trip.id
                        
                    logger.info(f"[LANDMARK_DOWNLOAD] Found {len(location_landmarks)} landmarks near {location['name']}")
                    
                    # Process landmarks with simulated image download
                    for landmark_index, landmark in enumerate(location_landmarks):
                        landmark_progress = (landmark_index / len(location_landmarks)) * 100 if location_landmarks else 100
                        
                        self.active_downloads[trip_id].update({
                            "current_phase": "processing_landmark",
                            "detail": f"Procesando landmark: {landmark.get('name', 'Sin nombre')}",
                            "current_landmark_progress": landmark_progress,
                            "current_landmark_name": landmark.get('name', 'Sin nombre'),
                            "landmarks_in_current_location": len(location_landmarks),
                            "current_landmark_index": landmark_index
                        })
                        
                        # Download image if enabled and landmark is in image categories
                        if download_images and landmark.get('category') in image_categories:
                            try:
                                self.active_downloads[trip_id].update({
                                    "current_phase": "downloading_image",
                                    "detail": f"Descargando imagen para: {landmark.get('name', 'Sin nombre')}"
                                })
                                
                                # Simulate image download process
                                await asyncio.sleep(0.2)  # Simulate image download time
                                
                                # Mark image as downloaded (this would be actual logic)
                                landmark["has_image"] = True
                                total_images_downloaded += 1
                                
                                self.active_downloads[trip_id]["images_downloaded"] = total_images_downloaded
                                
                            except Exception as e:
                                logger.error(f"[LANDMARK_DOWNLOAD] Error downloading image for {landmark.get('name')}: {str(e)}")
                                failed_downloads += 1
                                self.active_downloads[trip_id]["failed_downloads"] = failed_downloads
                        
                        # Small delay to allow progress updates to be sent
                        await asyncio.sleep(0.05)
                    
                    # Add location itself as a landmark
                    location_landmark = {
                        "id": f"trip_{trip.id}_{location['type']}_{location_index}",
                        "name": location['name'],
                        "lat": location["lat"],
                        "lon": location["lon"],
                        "radius_m": 100,
                        "category": f"trip_{location['type']}",
                        "description": f"{location['type'].title()} point of trip: {getattr(trip, 'name', 'Unknown Trip')}",
                        "trip_id": trip.id
                    }
                    all_landmarks.append(location_landmark)
                    
                    # Add all fetched landmarks
                    all_landmarks.extend(location_landmarks)
                    total_landmarks_downloaded += len(location_landmarks) + 1  # +1 for location landmark
                    
                    self.active_downloads[trip_id]["landmarks_downloaded"] = total_landmarks_downloaded
                    
                except Exception as e:
                    logger.error(f"[LANDMARK_DOWNLOAD] Error processing location {location['name']}: {str(e)}", exc_info=True)
                    failed_downloads += 1
                    self.active_downloads[trip_id]["failed_downloads"] = failed_downloads
                    
                    # Add fallback landmark for the location
                    fallback_landmark = {
                        "id": f"trip_{trip.id}_{location['type']}_{location_index}",
                        "name": location['name'],
                        "lat": location["lat"],
                        "lon": location["lon"],
                        "radius_m": 100,
                        "category": f"trip_{location['type']}",
                        "description": f"{location['type'].title()} point of trip: {getattr(trip, 'name', 'Unknown Trip')}",
                        "trip_id": trip.id
                    }
                    all_landmarks.append(fallback_landmark)
                    total_landmarks_downloaded += 1
                    self.active_downloads[trip_id]["landmarks_downloaded"] = total_landmarks_downloaded
                
                # Brief pause between locations
                await asyncio.sleep(0.1)
            
            # Processing complete, update final status
            # Check if download was paused
            if trip_id in self.active_downloads and self.active_downloads[trip_id].get('status') == 'paused':
                logger.info(f"[LANDMARK_DOWNLOAD] Download paused for trip {trip_id}")
                return
                
            self.active_downloads[trip_id] = {
                "progress": 90,  # Almost done
                "detail": f"Processing {len(all_landmarks)} landmarks...",
                "status": "downloading"
            }
            
            # Remove duplicates by ID
            unique_landmarks = {}
            for landmark in all_landmarks:
                if "id" in landmark:
                    unique_landmarks[landmark["id"]] = landmark
                else:
                    # Create a pseudo-ID based on coordinates
                    lm_id = f"{landmark.get('lat', 0)},{landmark.get('lon', 0)}"
                    unique_landmarks[lm_id] = landmark
            
            logger.info(f"[LANDMARK_DOWNLOAD] Adding {len(unique_landmarks)} landmarks to database")
            
            # Add landmarks to the database
            for lm_id, landmark in unique_landmarks.items():
                try:
                    # Ensure the landmark has an ID
                    if "id" not in landmark:
                        landmark["id"] = str(uuid.uuid4())[:8]
                        
                    # Ensure the landmark is associated with the trip
                    if "trip_id" not in landmark:
                        landmark["trip_id"] = trip.id
                        
                    # Add to database
                    if self.landmark_checker and hasattr(self.landmark_checker, 'landmarks_db'):
                        self.landmark_checker.landmarks_db.add_landmark(landmark)
                except Exception as e:
                    logger.error(f"[LANDMARK_DOWNLOAD] Error adding landmark {landmark.get('name', 'unknown')}: {str(e)}")
            
            # Reload landmarks in the landmark checker
            try:
                if self.landmark_checker:
                    logger.info(f"[LANDMARK_DOWNLOAD] Reloading landmarks in landmark checker")
                    self.landmark_checker.load_landmarks()
            except Exception as e:
                logger.error(f"[LANDMARK_DOWNLOAD] Error reloading landmarks: {str(e)}", exc_info=True)
            
            # Update trip status if planned_trips is provided
            if planned_trips and save_trips_to_disk:
                for i, t in enumerate(planned_trips):
                    if getattr(t, 'id', None) == trip_id:
                        updated_trip_dict = t.dict() if hasattr(t, 'dict') else t.__dict__
                        updated_trip_dict["landmarks_downloaded"] = True
                        # Update the trip in the list
                        # This depends on the trip model structure
                        break
                
                # Save trips to disk
                try:
                    save_trips_to_disk()
                except Exception as e:
                    logger.error(f"Error saving trips to disk: {str(e)}")
            
            # Mark as complete
            self.active_downloads[trip_id] = {
                "progress": 100,
                "detail": f"Downloaded {len(unique_landmarks)} landmarks",
                "status": "complete"
            }
            
            logger.info(f"[LANDMARK_DOWNLOAD] Successfully downloaded {len(unique_landmarks)} landmarks for trip {trip.id}")
            
            # Notify user about completion
            if self.audio_notifier:
                trip_name = getattr(trip, 'name', 'sin nombre')
                self.audio_notifier.announce(
                    f"Se han descargado {len(unique_landmarks)} puntos de interés para el viaje {trip_name}",
                    title="Descarga Completa",
                    notification_type="success",
                    send_notification=True
                )
            
        except Exception as e:
            logger.error(f"[LANDMARK_DOWNLOAD] Error in background landmark download: {str(e)}", exc_info=True)
            # Update status to error
            self.active_downloads[trip_id] = {
                "progress": 0,
                "detail": str(e),
                "status": "error"
            }
            
            # Notify user about error
            if self.audio_notifier:
                trip_name = getattr(trip, 'name', 'sin nombre')
                self.audio_notifier.announce(
                    f"Error al descargar puntos de interés para el viaje {trip_name}: {str(e)}",
                    title="Error en Descarga",
                    notification_type="error",
                    send_notification=True
                )
