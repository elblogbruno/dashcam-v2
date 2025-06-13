from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Form, File, UploadFile, Query
from fastapi.responses import JSONResponse
import os
import json
import requests
import logging
import aiohttp
import aiofiles
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import asyncio
import tempfile
import shutil

# Define router
router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Will be initialized from main.py
config = None

# Base directory for landmark images
LANDMARK_IMAGES_DIR = "landmark_images"

class ImageSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 1

class ImageSearchResult(BaseModel):
    url: str
    source: Optional[str] = None
    title: Optional[str] = None
    license: Optional[str] = None

@router.post("/search")
async def search_images(request: ImageSearchRequest):
    """Search for images based on a query"""
    try:
        logger.info(f"Searching for images with query: {request.query}")
        
        # Placeholder for actual image search implementation
        # In a real application, we would use an image search API like Unsplash, Pixabay, etc.
        # Or have our own database of images
        
        # For now, we'll return a placeholder image based on keyword matching
        images = await search_placeholder_images(request.query, request.limit)
        
        return {"images": images}
    except Exception as e:
        logger.error(f"Error searching for images: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching for images: {str(e)}")

@router.post("/upload/{landmark_id}")
async def upload_image(
    landmark_id: str,
    file: UploadFile = File(...),
    trip_id: Optional[str] = Form(None)
):
    """Upload an image for a specific landmark"""
    try:
        # Ensure the directory exists
        landmark_images_path = os.path.join(config.data_path, LANDMARK_IMAGES_DIR, landmark_id)
        os.makedirs(landmark_images_path, exist_ok=True)
        
        # Generate a filename
        filename = f"{landmark_id}_{file.filename}"
        filepath = os.path.join(landmark_images_path, filename)
        
        # Save the uploaded file
        async with aiofiles.open(filepath, "wb") as f:
            content = await file.read()
            await f.write(content)
        
        # Create metadata file
        metadata = {
            "landmark_id": landmark_id,
            "trip_id": trip_id,
            "filename": filename,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "uploaded_at": str(datetime.now())
        }
        
        metadata_filepath = os.path.join(landmark_images_path, f"{filename}.meta.json")
        async with aiofiles.open(metadata_filepath, "w") as f:
            await f.write(json.dumps(metadata, indent=2))
        
        logger.info(f"Uploaded image for landmark {landmark_id}: {filename}")
        
        return {
            "status": "success",
            "message": "Image uploaded successfully",
            "landmark_id": landmark_id,
            "filename": filename
        }
    except Exception as e:
        logger.error(f"Error uploading image for landmark {landmark_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")

@router.get("/{landmark_id}")
async def get_landmark_images(landmark_id: str):
    """Get all images for a specific landmark"""
    try:
        landmark_images_path = os.path.join(config.data_path, LANDMARK_IMAGES_DIR, landmark_id)
        
        if not os.path.exists(landmark_images_path):
            return {"images": []}
        
        images = []
        for filename in os.listdir(landmark_images_path):
            if filename.endswith(".meta.json"):
                continue
                
            # Get metadata if available
            metadata_file = os.path.join(landmark_images_path, f"{filename}.meta.json")
            metadata = {}
            
            if os.path.exists(metadata_file):
                try:
                    with open(metadata_file, "r") as f:
                        metadata = json.load(f)
                except:
                    pass
            
            images.append({
                "landmark_id": landmark_id,
                "filename": filename,
                "url": f"/api/landmark-images/file/{landmark_id}/{filename}",
                "metadata": metadata
            })
        
        return {"images": images}
    except Exception as e:
        logger.error(f"Error getting images for landmark {landmark_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting images: {str(e)}")

@router.get("/file/{landmark_id}/{filename}")
async def get_landmark_image_file(landmark_id: str, filename: str):
    """Get a specific image file for a landmark"""
    try:
        filepath = os.path.join(config.data_path, LANDMARK_IMAGES_DIR, landmark_id, filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Image not found")
        
        return FileResponse(filepath)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error getting image file {filename} for landmark {landmark_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting image file: {str(e)}")

@router.delete("/{landmark_id}/{filename}")
async def delete_landmark_image(landmark_id: str, filename: str):
    """Delete a specific image for a landmark"""
    try:
        filepath = os.path.join(config.data_path, LANDMARK_IMAGES_DIR, landmark_id, filename)
        metadata_filepath = os.path.join(config.data_path, LANDMARK_IMAGES_DIR, landmark_id, f"{filename}.meta.json")
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Delete files
        os.remove(filepath)
        if os.path.exists(metadata_filepath):
            os.remove(metadata_filepath)
        
        return {"status": "success", "message": "Image deleted successfully"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error deleting image {filename} for landmark {landmark_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting image: {str(e)}")

async def search_placeholder_images(query: str, limit: int = 1) -> List[Dict[str, Any]]:
    """Search for placeholder images based on keyword matching"""
    # Define some placeholder image URLs based on categories
    category_images = {
        "natural": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "mountain": "https://images.unsplash.com/photo-1519681393784-d120267933ba?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "lake": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "waterfall": "https://images.unsplash.com/photo-1546182990-dffeafbe841d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "forest": "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "beach": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "museum": "https://images.unsplash.com/photo-1554907984-15263bfd63bd?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "historic": "https://images.unsplash.com/photo-1558379879-4841ff1fca67?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "monument": "https://images.unsplash.com/photo-1494949360228-4e9bde560065?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "restaurant": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "cafe": "https://images.unsplash.com/photo-1556742563-e1bfdc0a5dad?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "gas_station": "https://images.unsplash.com/photo-1559267307-b3fa3c402723?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "hotel": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "landmark": "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "viewpoint": "https://images.unsplash.com/photo-1480497490787-505ec076689f?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        # Add specific gas station brands
        "shell": "https://images.unsplash.com/photo-1560043785-a452de5f6c60?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "chevron": "https://images.unsplash.com/photo-1622244296050-4770134a1eaa?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "bp": "https://images.unsplash.com/photo-1568893702125-bc10b5b85d1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "exxon": "https://images.unsplash.com/photo-1570129329578-2f3d77bde6d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "mobil": "https://images.unsplash.com/photo-1559267307-b3fa3c402723?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "texaco": "https://images.unsplash.com/photo-1572183302939-e38cb9f7ebc2?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "arco": "https://images.unsplash.com/photo-1559267307-b3fa3c402723?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
        "76": "https://images.unsplash.com/photo-1559267307-b3fa3c402723?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
    }
    
    # Default image - usando una imagen que sabemos que funciona
    default_image = "https://images.unsplash.com/photo-1559267307-b3fa3c402723?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
    
    # Convert query to lowercase for matching
    query_lower = query.lower()
    
    # First, check for specific gas station brands or specific names
    matching_images = []
    
    # Build a list of specific brands to check in the query
    specific_brands = ["shell", "chevron", "bp", "exxon", "mobil", "texaco", "arco", "76"]
    
    # Check for specific gas station brands first
    for brand in specific_brands:
        if brand in query_lower:
            matching_images.append({
                "url": category_images.get(brand.lower(), category_images["gas_station"]),
                "source": "placeholder",
                "title": f"{brand.upper()} gas station image",
                "license": "Unsplash license"
            })
            logger.info(f"Found matching brand image for '{brand}' in query: '{query}'")
            break
    
    # If no specific brand was found, check for general categories
    if not matching_images:
        for keyword, image_url in category_images.items():
            # Skip the specific brands we already checked
            if keyword in specific_brands:
                continue
                
            if keyword in query_lower:
                matching_images.append({
                    "url": image_url,
                    "source": "placeholder",
                    "title": f"{keyword.capitalize()} image",
                    "license": "Unsplash license"
                })
                logger.info(f"Found matching category image for '{keyword}' in query: '{query}'")
                break
    
    # If we have enough matches, return them; otherwise add the default image
    if len(matching_images) < limit:
        matching_images.append({
            "url": default_image,
            "source": "placeholder",
            "title": "Default landmark image",
            "license": "Unsplash license"
        })
    
    # Return only the requested number of images
    return matching_images[:limit]
