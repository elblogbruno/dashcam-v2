from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import json
import os
from typing import Optional
import shutil

# Import the LandmarkChecker class
# from landmark_checker import LandmarkChecker
# from config import config

import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

router = APIRouter()
landmark_checker = None  # Will be initialized from main.py

# Route to get nearby landmarks
@router.get("/nearby")
async def get_nearby_landmarks(lat: Optional[float] = None, lon: Optional[float] = None):
    global landmark_checker
    
    if landmark_checker is None:
        raise HTTPException(status_code=500, detail="Landmark checker not initialized")
    
    # If lat/lon provided, use those, otherwise use the global current_location
    # This will be handled in the main app where this function is called
    nearby = landmark_checker.check_nearby(lat, lon)
        
    return {"landmark": nearby}

# Route to download landmarks
@router.get("/download")
async def download_landmarks():
    """Download all landmarks as a JSON file"""
    try:
        if landmark_checker is None:
            raise HTTPException(status_code=500, detail="Landmark checker not initialized")
        
        # Get all landmarks from database
        landmarks = landmark_checker.landmarks
        
        # Create a temporary file and write landmarks to it
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w+") as temp_file:
            json.dump(landmarks, temp_file, indent=2)
            temp_file_path = temp_file.name
        
        # Return the file
        return FileResponse(
            path=temp_file_path,
            filename="landmarks.json",
            media_type="application/json",
            background=os.unlink  # This will delete the file after sending
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download landmarks: {str(e)}")

# Route to upload landmarks
@router.post("/upload")
async def upload_landmarks(landmarks_file: dict):
    """Import landmarks from a JSON object"""
    try:
        if landmark_checker is None:
            raise HTTPException(status_code=500, detail="Landmark checker not initialized")
        
        # Validate the input is a list of landmarks
        if not isinstance(landmarks_file, list):
            raise HTTPException(status_code=400, detail="Invalid landmarks format. Expected a list of landmark objects.")
        
        # Create a temporary file with the JSON content
        import tempfile
        temp_file_path = None
        
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w+") as temp_file:
            json.dump(landmarks_file, temp_file, indent=2)
            temp_file_path = temp_file.name
        
        try:
            # Import landmarks from the temporary file
            added_count = landmark_checker.landmarks_db.import_from_json(temp_file_path)
            
            # Reload landmarks in the checker
            landmark_checker.load_landmarks()
            
            # Clean up the temporary file
            import os
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
            return {
                "status": "success", 
                "message": f"Imported {added_count} landmarks successfully"
            }
        finally:
            # Ensure the temporary file is removed in case of an error
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload landmarks: {str(e)}")

# Route to add a new landmark
@router.post("/add")
async def add_landmark(landmark: dict):
    """Add a new landmark to the database"""
    try:
        if landmark_checker is None:
            raise HTTPException(status_code=500, detail="Landmark checker not initialized")
        
        # Validate the landmark object
        required_fields = ["name", "lat", "lon", "radius_m"]
        for field in required_fields:
            if field not in landmark:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Missing required field: {field}"
                )
        
        # Add the new landmark to the database
        result = landmark_checker.landmarks_db.add_landmark(landmark)
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to add landmark")
        
        # Reload landmarks in the landmark checker
        landmark_checker.load_landmarks()
        
        return {"status": "success", "message": "Landmark added successfully", "landmark": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add landmark: {str(e)}")

# Route to delete a landmark
@router.delete("/{landmark_id}")
async def delete_landmark(landmark_id: str):
    """Delete a landmark from the database"""
    try:
        if landmark_checker is None:
            raise HTTPException(status_code=500, detail="Landmark checker not initialized")
            
        # Remove from database
        result = landmark_checker.remove_landmark(landmark_id)
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Landmark with ID {landmark_id} not found")
        
        return {"status": "success", "message": "Landmark deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete landmark: {str(e)}")

# Route to search landmarks
@router.get("/search")
async def search_landmarks(q: str = ""):
    """Search landmarks by name or category"""
    if landmark_checker is None:
        raise HTTPException(status_code=500, detail="Landmark checker not initialized")
    
    q = q.lower()
    results = []
    
    # Search through all landmarks for matches
    for landmark in landmark_checker.landmarks:
        name = landmark.get("name", "").lower()
        category = landmark.get("category", "").lower()
        description = landmark.get("description", "").lower()
        
        # Check if query matches any fields
        if q in name or q in category or q in description:
            results.append(landmark)
    
    return results

# Route to get all landmarks
@router.get("")
async def get_all_landmarks():
    """Get all landmarks"""
    if landmark_checker is None:
        raise HTTPException(status_code=500, detail="Landmark checker not initialized")
    
    return landmark_checker.landmarks

# Route to get landmarks by trip ID
@router.get("/by-trip/{trip_id}")
async def get_landmarks_by_trip(trip_id: str):
    """Get all landmarks associated with a specific trip"""
    if landmark_checker is None:
        raise HTTPException(status_code=500, detail="Landmark checker not initialized")
    
    try:
        # Obtener landmarks que tienen el trip_id explícito
        landmarks = landmark_checker.landmarks_db.get_landmarks_by_trip(trip_id)
        
        # Además, buscar landmarks que tengan el trip_id en su ID
        # Esto es para los landmarks especiales como los puntos de inicio, waypoints y destino
        all_landmarks = landmark_checker.landmarks
        trip_pattern = f"trip_{trip_id}_"
        
        # Filtrar landmarks adicionales por ID
        for landmark in all_landmarks:
            landmark_id = landmark.get("id", "")
            if trip_pattern in landmark_id and landmark not in landmarks:
                landmarks.append(landmark)
                
        logger.info(f"Found {len(landmarks)} landmarks for trip {trip_id}")
        return landmarks
    except Exception as e:
        logger.error(f"Error getting landmarks for trip {trip_id}: {str(e)}")
        # En caso de error, intentar buscar directamente en los landmarks cargados
        try:
            all_landmarks = landmark_checker.landmarks
            trip_pattern = f"trip_{trip_id}_"
            filtered_landmarks = []
            
            for landmark in all_landmarks:
                # Incluir si tiene trip_id explícito o si el ID contiene el patrón
                if (landmark.get("trip_id") == trip_id or 
                    trip_pattern in landmark.get("id", "")):
                    filtered_landmarks.append(landmark)
            
            return filtered_landmarks
        except Exception as e:
            logger.error(f"Error in fallback method for getting trip landmarks: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get landmarks for trip: {str(e)}")

# Route for bulk deletion of landmarks
@router.post("/bulk-delete")
async def bulk_delete_landmarks(criteria: dict):
    """Bulk delete landmarks based on criteria with optimized batch operations"""
    try:
        if landmark_checker is None:
            raise HTTPException(status_code=500, detail="Landmark checker not initialized")
        
        # Extract criteria
        category = criteria.get("category")
        trip_id = criteria.get("trip_id")
        landmark_ids = criteria.get("landmark_ids", [])
        
        deleted_count = 0
        
        # Delete by specific IDs using batch operation
        if landmark_ids:
            # Validate IDs are not empty
            valid_ids = [lid for lid in landmark_ids if lid]
            if valid_ids:
                # Use the new batch deletion method
                deleted_count = landmark_checker.landmarks_db.remove_landmarks_batch(valid_ids)
        
        # Delete by category using optimized query
        elif category:
            deleted_count = landmark_checker.landmarks_db.remove_landmarks_by_category(category)
        
        # Delete by trip ID
        elif trip_id:
            deleted_count = landmark_checker.landmarks_db.remove_trip_landmarks(trip_id)
        
        else:
            raise HTTPException(status_code=400, detail="No valid deletion criteria provided")
        
        # Reload landmarks in the checker after bulk operations
        if deleted_count > 0:
            landmark_checker.load_landmarks()
        
        return {
            "status": "success",
            "message": f"Successfully deleted {deleted_count} landmarks",
            "deleted_count": deleted_count
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk delete: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete landmarks: {str(e)}")

# Route to get unique categories for bulk operations
@router.get("/categories")
async def get_landmark_categories():
    """Get all unique categories from landmarks"""
    try:
        if landmark_checker is None:
            raise HTTPException(status_code=500, detail="Landmark checker not initialized")
        
        categories = set()
        for landmark in landmark_checker.landmarks:
            category = landmark.get("category")
            if category:
                categories.add(category)
        
        return {
            "categories": sorted(list(categories))
        }
    
    except Exception as e:
        logger.error(f"Error getting categories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get categories: {str(e)}")