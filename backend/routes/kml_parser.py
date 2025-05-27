from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional, Any
import os
import tempfile
import zipfile
import xml.etree.ElementTree as ET
import json
import shutil
import logging
import uuid
from pydantic import BaseModel

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

router = APIRouter()

# Variables que serán inicializadas desde main.py
landmark_checker = None
planned_trips = []
config = None

# Modelos
class KmlPlacemark(BaseModel):
    name: str
    lat: float
    lon: float
    description: Optional[str] = None
    category: Optional[str] = "kml_import"

class KmlImportResult(BaseModel):
    placemarks: List[KmlPlacemark] = []
    waypoints: List[Dict[str, Any]] = []


# Function to extract KML content from a KMZ file
async def extract_kml_from_kmz(kmz_file):
    with tempfile.NamedTemporaryFile(suffix=".kmz", delete=False) as temp_file:
        file_content = await kmz_file.read()
        temp_file.write(file_content)
        temp_file_path = temp_file.name
    
    try:
        with zipfile.ZipFile(temp_file_path, 'r') as kmz:
            # KMZ files typically have a doc.kml file inside
            kml_files = [f for f in kmz.namelist() if f.endswith('.kml')]
            if not kml_files:
                raise ValueError("No KML file found in the KMZ archive")
            
            # Extract the first KML file found
            kml_content = kmz.read(kml_files[0])
            return kml_content
    finally:
        # Cleanup the temporary file
        os.unlink(temp_file_path)


# Parse KML content and extract waypoints and placemarks
def parse_kml_content(kml_content):
    try:
        # Parse KML content
        root = ET.fromstring(kml_content)
        
        # Define the KML namespace
        ns = {'kml': 'http://www.opengis.net/kml/2.2'}
        
        waypoints = []
        placemarks = []
        
        # Find all Placemark elements
        for placemark in root.findall('.//kml:Placemark', ns):
            name_elem = placemark.find('kml:name', ns)
            name = name_elem.text if name_elem is not None else "Unnamed"
            
            # Check for description
            desc_elem = placemark.find('kml:description', ns)
            description = desc_elem.text if desc_elem is not None else None
            
            # Look for Point coordinates
            point = placemark.find('.//kml:Point/kml:coordinates', ns)
            if point is not None:
                # KML coordinates are in lon,lat,alt format
                coords = point.text.strip().split(',')
                if len(coords) >= 2:
                    try:
                        lon = float(coords[0])
                        lat = float(coords[1])
                        
                        # Create data structure
                        data = {
                            'name': name,
                            'lat': lat,
                            'lon': lon,
                            'description': description
                        }
                        
                        waypoints.append(data)
                        placemarks.append(data)
                    except ValueError:
                        logger.warning(f"Invalid coordinates for placemark: {name}")
                        continue
            
            # Look for LineString coordinates (for routes)
            linestring = placemark.find('.//kml:LineString/kml:coordinates', ns)
            if linestring is not None:
                coords_text = linestring.text.strip()
                # Split by whitespace to get each coordinate pair
                coord_pairs = coords_text.split()
                
                for i, pair in enumerate(coord_pairs):
                    coords = pair.strip().split(',')
                    if len(coords) >= 2:
                        try:
                            lon = float(coords[0])
                            lat = float(coords[1])
                            
                            # Create waypoint data structure
                            waypoint_data = {
                                'name': f"{name} - Point {i+1}",
                                'lat': lat,
                                'lon': lon,
                                'description': f"Part of route: {name}"
                            }
                            
                            waypoints.append(waypoint_data)
                        except ValueError:
                            continue
        
        return {
            'waypoints': waypoints,
            'placemarks': placemarks
        }
        
    except Exception as e:
        logger.error(f"Error parsing KML: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error parsing KML: {str(e)}")


@router.post("/upload-kml")
async def upload_kml_file(file: UploadFile = File(...)):
    """Upload a KML or KMZ file and extract waypoints and placemarks"""
    try:
        # Check file extension
        file_ext = file.filename.split('.')[-1].lower()
        
        if file_ext == 'kmz':
            # Extract KML from KMZ
            kml_content = await extract_kml_from_kmz(file)
        elif file_ext == 'kml':
            # Read KML file content
            kml_content = await file.read()
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a KML or KMZ file.")
        
        # Parse KML content
        result = parse_kml_content(kml_content)
        
        return result
    except Exception as e:
        logger.error(f"Error processing KML/KMZ file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.post("/{trip_id}/import-landmarks-from-kml")
async def import_landmarks_from_kml(
    trip_id: str,
    file: UploadFile = File(...),
    selected_placemarks: Optional[str] = Form(None)
):
    """Import landmarks from a KML/KMZ file into a trip"""
    global landmark_checker, planned_trips
    
    # Check if landmark_checker is initialized
    if landmark_checker is None:
        raise HTTPException(status_code=500, detail="Landmark checker not initialized")
    
    # Find the trip
    trip = next((t for t in planned_trips if t.id == trip_id), None)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    try:
        # Parse selected indices if provided
        selected_indices = []
        if selected_placemarks:
            try:
                selected_indices = json.loads(selected_placemarks)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid selected_placemarks format")
        
        # Process the KML/KMZ file
        file_ext = file.filename.split('.')[-1].lower()
        
        if file_ext == 'kmz':
            kml_content = await extract_kml_from_kmz(file)
        elif file_ext == 'kml':
            kml_content = await file.read()
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Parse KML content
        parsed_data = parse_kml_content(kml_content)
        placemarks = parsed_data.get('placemarks', [])
        
        # Filter placemarks if selected indices are provided
        if selected_indices:
            try:
                placemarks = [placemarks[i] for i in selected_indices if 0 <= i < len(placemarks)]
            except (IndexError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid selected indices")
        
        # Add landmarks to the database
        added_count = 0
        for placemark in placemarks:
            try:
                landmark_id = f"kml_import_{uuid.uuid4().hex[:8]}"
                
                landmark_data = {
                    "id": landmark_id,
                    "name": placemark["name"],
                    "lat": placemark["lat"],
                    "lon": placemark["lon"],
                    "radius_m": 100,  # Default radius
                    "category": "kml_import",
                    "description": placemark.get("description", f"Imported from KML for trip: {trip.name}"),
                    "trip_id": trip_id
                }
                
                landmark_checker.add_landmark(landmark_data)
                added_count += 1
                
            except Exception as e:
                logger.error(f"Error adding landmark from KML: {str(e)}")
                continue
        
        # Update trip landmarks_downloaded flag
        for t in planned_trips:
            if t.id == trip_id:
                t.landmarks_downloaded = True
                break
        
        return {
            "status": "success",
            "message": f"Successfully imported {added_count} landmarks",
            "imported_count": added_count
        }
        
    except Exception as e:
        logger.error(f"Error importing landmarks from KML: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing landmarks: {str(e)}")


@router.post("/{trip_id}/import-waypoints")
async def import_waypoints_to_trip(
    trip_id: str,
    file: UploadFile = File(...),
    selected_waypoints: Optional[str] = Form(None)
):
    """Import waypoints from a KML/KMZ file into a trip"""
    global planned_trips
    
    # Find the trip
    trip = next((t for t in planned_trips if t.id == trip_id), None)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    try:
        # Parse selected indices if provided
        selected_indices = []
        if selected_waypoints:
            try:
                selected_indices = json.loads(selected_waypoints)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid selected_waypoints format")
        
        # Process the KML/KMZ file
        file_ext = file.filename.split('.')[-1].lower()
        
        if file_ext == 'kmz':
            kml_content = await extract_kml_from_kmz(file)
        elif file_ext == 'kml':
            kml_content = await file.read()
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Parse KML content
        parsed_data = parse_kml_content(kml_content)
        waypoints = parsed_data.get('waypoints', [])
        
        # Filter waypoints if selected indices are provided
        if selected_indices:
            try:
                waypoints = [waypoints[i] for i in selected_indices if 0 <= i < len(waypoints)]
            except (IndexError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid selected indices")
        
        # Add waypoints to the trip
        for trip_obj in planned_trips:
            if trip_obj.id == trip_id:
                if trip_obj.waypoints is None:
                    trip_obj.waypoints = []
                
                # Add the new waypoints
                for wp in waypoints:
                    trip_obj.waypoints.append({
                        "lat": wp["lat"],
                        "lon": wp["lon"],
                        "name": wp["name"]
                    })
                break
        
        # Save the updated trips data
        return {
            "status": "success",
            "message": f"Successfully imported {len(waypoints)} waypoints",
            "trip": next((t for t in planned_trips if t.id == trip_id), None)
        }
        
    except Exception as e:
        logger.error(f"Error importing waypoints from KML: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing waypoints: {str(e)}")
