from fastapi import APIRouter, HTTPException, UploadFile, Form, File, BackgroundTasks
from fastapi.responses import JSONResponse
import os
import time
import shutil
from datetime import datetime
from typing import List, Dict, Optional, Any

router = APIRouter()

# Will be initialized from main.py
trip_logger = None
video_maker = None
config = None

# Route to generate daily summary video
@router.post("/generate-summary")
async def generate_summary(day: str, background_tasks: BackgroundTasks):
    try:
        target_date = datetime.strptime(day, "%Y-%m-%d").date()
        # Asynchronously generate the video
        background_tasks.add_task(video_maker.create_daily_summary, target_date)
        return {"status": "success", "message": f"Started generating summary for {day}"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

# Route to upload Insta360 videos
@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    date: str = Form(...),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None)
):
    # Validate date format
    try:
        upload_date = datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"detail": "Invalid date format. Use YYYY-MM-DD"}
        )
    
    # Create upload directory with proper path from config
    year_month = upload_date.strftime('%Y-%m')
    upload_dir = os.path.join(config.upload_path, year_month)
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save the file with a timestamp-based filename
    timestamp = int(time.time())
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{timestamp}{file_extension}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Add to database with proper metadata
    metadata = {
        'file_path': file_path,
        'original_filename': file.filename,
        'lat': lat,
        'lon': lon,
        'source': 'external'
    }
    
    video_id = trip_logger.add_external_video(upload_date, metadata)
    
    return {
        "id": video_id,
        "filename": filename,
        "original_filename": file.filename,
        "date": date,
        "status": "uploaded"
    }

# New API endpoint for bulk uploads with processing status tracking
@router.post("/bulk-upload")
async def bulk_upload_videos(
    files: List[UploadFile] = File(...),
    dates: List[str] = Form(...),
    lats: Optional[List[float]] = Form(None),
    lons: Optional[List[float]] = Form(None)
):
    results = []
    
    # Make sure we have the same number of dates as files
    if len(files) != len(dates):
        return JSONResponse(
            status_code=400,
            content={"detail": "Number of files and dates must match"}
        )
    
    # Process each file
    for i, file in enumerate(files):
        try:
            date = dates[i]
            
            # Get coordinates if available
            lat = lats[i] if lats and i < len(lats) else None
            lon = lons[i] if lons and i < len(lons) else None
            
            # Validate date format
            try:
                upload_date = datetime.strptime(date, '%Y-%m-%d')
            except ValueError:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": "Invalid date format. Use YYYY-MM-DD"
                })
                continue
                
            # Create upload directory with proper path from config
            year_month = upload_date.strftime('%Y-%m')
            upload_dir = os.path.join(config.upload_path, year_month)
            os.makedirs(upload_dir, exist_ok=True)
            
            # Save the file with a timestamp-based filename
            timestamp = int(time.time())
            file_extension = os.path.splitext(file.filename)[1]
            filename = f"{timestamp}{file_extension}"
            file_path = os.path.join(upload_dir, filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Add to database with proper metadata
            metadata = {
                'file_path': file_path,
                'original_filename': file.filename,
                'lat': lat,
                'lon': lon,
                'source': 'external'
            }
            
            video_id = trip_logger.add_external_video(upload_date, metadata)
            
            results.append({
                "id": video_id,
                "filename": filename,
                "original_filename": file.filename,
                "date": date,
                "success": True
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    return {"results": results}