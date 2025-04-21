from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import json
import os
from typing import Optional
import shutil

# Import the LandmarkChecker class
from landmark_checker import LandmarkChecker
from config import config

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
    """Download the landmarks.json file"""
    try:
        landmarks_path = config.landmarks_path
        if not os.path.exists(landmarks_path):
            return JSONResponse(
                status_code=404,
                content={"detail": "Landmarks file not found"}
            )
        
        return FileResponse(
            path=landmarks_path,
            filename="landmarks.json",
            media_type="application/json"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download landmarks: {str(e)}")

# Route to upload landmarks
@router.post("/upload")
async def upload_landmarks(landmarks_file: dict):
    """Update the landmarks.json file with new content"""
    try:
        landmarks_path = config.landmarks_path
        
        # Create a backup of the existing file
        if os.path.exists(landmarks_path):
            backup_path = f"{landmarks_path}.backup"
            shutil.copy2(landmarks_path, backup_path)
        
        # Write the new landmarks to the file
        with open(landmarks_path, "w") as f:
            json.dump(landmarks_file, f, indent=2)
        
        # Reload landmarks in the landmark checker
        if landmark_checker:
            landmark_checker.reload_landmarks()
        
        return {"status": "success", "message": "Landmarks uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload landmarks: {str(e)}")

# Route to add a new landmark
@router.post("/add")
async def add_landmark(landmark: dict):
    """Add a new landmark to the landmarks.json file"""
    try:
        landmarks_path = config.landmarks_path
        
        # Read existing landmarks
        existing_landmarks = []
        if os.path.exists(landmarks_path):
            with open(landmarks_path, "r") as f:
                try:
                    existing_landmarks = json.load(f)
                except json.JSONDecodeError:
                    existing_landmarks = []
        
        # Validate the landmark object
        required_fields = ["name", "lat", "lon", "radius"]
        for field in required_fields:
            if field not in landmark:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Missing required field: {field}"
                )
        
        # Add the new landmark
        existing_landmarks.append(landmark)
        
        # Write back to file
        with open(landmarks_path, "w") as f:
            json.dump(existing_landmarks, f, indent=2)
        
        # Reload landmarks in the landmark checker
        if landmark_checker:
            landmark_checker.reload_landmarks()
        
        return {"status": "success", "message": "Landmark added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add landmark: {str(e)}")

# Route to delete a landmark
@router.delete("/{landmark_id}")
async def delete_landmark(landmark_id: str):
    """Delete a landmark from the landmarks.json file"""
    try:
        landmarks_path = config.landmarks_path
        
        # Read existing landmarks
        if not os.path.exists(landmarks_path):
            raise HTTPException(status_code=404, detail="Landmarks file not found")
            
        with open(landmarks_path, "r") as f:
            try:
                existing_landmarks = json.load(f)
            except json.JSONDecodeError:
                raise HTTPException(status_code=500, detail="Invalid landmarks file format")
        
        # Find and remove the landmark
        landmark_found = False
        updated_landmarks = []
        for landmark in existing_landmarks:
            if str(landmark.get("id", "")) == landmark_id:
                landmark_found = True
            else:
                updated_landmarks.append(landmark)
        
        if not landmark_found:
            raise HTTPException(status_code=404, detail=f"Landmark with ID {landmark_id} not found")
        
        # Write back to file
        with open(landmarks_path, "w") as f:
            json.dump(updated_landmarks, f, indent=2)
        
        # Reload landmarks in the landmark checker
        if landmark_checker:
            landmark_checker.reload_landmarks()
        
        return {"status": "success", "message": "Landmark deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete landmark: {str(e)}")