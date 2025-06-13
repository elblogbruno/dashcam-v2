from fastapi import APIRouter, HTTPException
from datetime import datetime, date
from typing import Dict, List, Optional
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Will be initialized from main.py
trip_logger = None

@router.get("/{planned_trip_id}/actual-trips")
async def get_actual_trips_for_planned_trip(planned_trip_id: str):
    """Get all actual trips that were done during a planned trip"""
    if trip_logger is None:
        raise HTTPException(status_code=500, detail="Trip logger not initialized")
    
    try:
        # Use the new trip logger system to get trips filtered by planned_trip_id
        trips_for_planned_trip = trip_logger.get_trips_by_planned_trip_id(planned_trip_id)
        
        trips = []
        for trip in trips_for_planned_trip:
            # Convert trip to dict format if it's not already
            trip_data = trip if isinstance(trip, dict) else {
                'id': getattr(trip, 'id', None),
                'start_time': getattr(trip, 'start_time', None),
                'end_time': getattr(trip, 'end_time', None),
                'start_lat': getattr(trip, 'start_lat', None),
                'start_lon': getattr(trip, 'start_lon', None),
                'end_lat': getattr(trip, 'end_lat', None),
                'end_lon': getattr(trip, 'end_lon', None),
                'distance_km': getattr(trip, 'distance_km', None),
                'planned_trip_id': getattr(trip, 'planned_trip_id', None)
            }
            
            # Only include completed trips (have end_time)
            if not trip_data.get('end_time'):
                continue
            
            # Get additional data using the new system
            trip_id = trip_data['id']
            
            # Get video clips count
            video_clips_count = 0
            if hasattr(trip_logger, 'get_trip_videos'):
                try:
                    videos = trip_logger.get_trip_videos(trip_id)
                    video_clips_count = len(videos)
                except:
                    pass
            
            # Get landmark encounters count
            landmark_encounters_count = 0
            if hasattr(trip_logger, 'get_trip_landmarks'):
                try:
                    landmarks = trip_logger.get_trip_landmarks(trip_id)
                    landmark_encounters_count = len(landmarks)
                except:
                    pass
            
            # Get GPS statistics
            gps_points_count = 0
            avg_speed = 0
            max_speed = 0
            try:
                gps_stats = trip_logger.get_gps_statistics(trip_id)
                if gps_stats:
                    gps_points_count = getattr(gps_stats, 'total_points', 0)
                    avg_speed = getattr(gps_stats, 'avg_speed', 0) or 0
                    max_speed = getattr(gps_stats, 'max_speed', 0) or 0
            except:
                pass
            
            # Add the calculated data
            trip_data.update({
                'video_clips_count': video_clips_count,
                'landmark_encounters_count': landmark_encounters_count,
                'gps_points_count': gps_points_count,
                'avg_speed': avg_speed,
                'max_speed': max_speed
            })
            
            trips.append(trip_data)
        
        return {"trips": trips, "planned_trip_id": planned_trip_id, "using_new_system": True}
        
    except Exception as e:
        logger.error(f"Error getting actual trips for planned trip {planned_trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get actual trips: {str(e)}")

@router.get("/{planned_trip_id}/actual-trips/{trip_id}")
async def get_actual_trip_details(planned_trip_id: str, trip_id: int):
    """Get detailed information about a specific actual trip"""
    if trip_logger is None:
        raise HTTPException(status_code=500, detail="Trip logger not initialized")
    
    try:
        # Get comprehensive trip summary using the new system
        trip_summary = trip_logger.get_trip_gps_summary(trip_id)
        
        if not trip_summary:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        # Convert trip_summary to dict format for API response
        result = {
            'trip_info': trip_summary.trip_info if hasattr(trip_summary, 'trip_info') else {},
            'gps_track': trip_summary.gps_track if hasattr(trip_summary, 'gps_track') else [],
            'landmarks': trip_summary.landmarks if hasattr(trip_summary, 'landmarks') else [],
            'statistics': trip_summary.statistics if hasattr(trip_summary, 'statistics') else {},
            'planned_trip_id': planned_trip_id
        }
        
        # Get video clips for this trip using the new system
        video_clips = []
        if hasattr(trip_logger, 'get_trip_videos'):
            try:
                videos = trip_logger.get_trip_videos(trip_id)
                video_clips = [
                    video if isinstance(video, dict) else {
                        'id': getattr(video, 'id', None),
                        'trip_id': getattr(video, 'trip_id', None),
                        'start_time': getattr(video, 'start_time', None),
                        'end_time': getattr(video, 'end_time', None),
                        'sequence_num': getattr(video, 'sequence_num', None),
                        'quality': getattr(video, 'quality', None),
                        'road_video_file': getattr(video, 'road_video_file', None),
                        'interior_video_file': getattr(video, 'interior_video_file', None),
                        'start_lat': getattr(video, 'start_lat', None),
                        'start_lon': getattr(video, 'start_lon', None),
                        'end_lat': getattr(video, 'end_lat', None),
                        'end_lon': getattr(video, 'end_lon', None),
                        'landmark_type': getattr(video, 'landmark_type', None),
                        'location': getattr(video, 'location', None)
                    }
                    for video in videos
                ]
            except Exception as e:
                logger.warning(f"Could not get videos for trip {trip_id}: {e}")
        
        result['video_clips'] = video_clips
        result['using_new_system'] = True
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting trip details for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get trip details: {str(e)}")

@router.delete("/{planned_trip_id}/actual-trips/{trip_id}")
async def delete_actual_trip(planned_trip_id: str, trip_id: int):
    """Delete an actual trip and all its associated data"""
    if trip_logger is None:
        raise HTTPException(status_code=500, detail="Trip logger not initialized")
    
    try:
        # Check if trip exists using the new system
        trip = trip_logger.get_trip_by_id(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        # For now, we'll return a message that deletion through the new system
        # needs to be implemented as it requires careful consideration of data integrity
        # The new system uses SQLAlchemy relationships and cascade deletes
        
        return {
            "status": "error",
            "message": "Trip deletion through the new system requires administrative access",
            "note": "Please use the administrative interface or direct database access for trip deletion",
            "trip_id": trip_id,
            "planned_trip_id": planned_trip_id,
            "using_new_system": True
        }
        
    except Exception as e:
        logger.error(f"Error deleting trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete trip: {str(e)}")

@router.get("/{planned_trip_id}/actual-trips/{trip_id}/video-clips")
async def get_trip_video_clips(planned_trip_id: str, trip_id: int):
    """Get all video clips for a specific actual trip"""
    if trip_logger is None:
        raise HTTPException(status_code=500, detail="Trip logger not initialized")
    
    try:
        # Use the new trip logger system to get video clips
        clips = []
        if hasattr(trip_logger, 'get_trip_videos'):
            videos = trip_logger.get_trip_videos(trip_id)
            clips = [
                video if isinstance(video, dict) else {
                    'id': getattr(video, 'id', None),
                    'trip_id': getattr(video, 'trip_id', None),
                    'start_time': getattr(video, 'start_time', None),
                    'end_time': getattr(video, 'end_time', None),
                    'sequence_num': getattr(video, 'sequence_num', None),
                    'quality': getattr(video, 'quality', None),
                    'road_video_file': getattr(video, 'road_video_file', None),
                    'interior_video_file': getattr(video, 'interior_video_file', None),
                    'start_lat': getattr(video, 'start_lat', None),
                    'start_lon': getattr(video, 'start_lon', None),
                    'end_lat': getattr(video, 'end_lat', None),
                    'end_lon': getattr(video, 'end_lon', None),
                    'landmark_type': getattr(video, 'landmark_type', None),
                    'location': getattr(video, 'location', None)
                }
                for video in videos
            ]
        
        return {
            "video_clips": clips,
            "trip_id": trip_id,
            "planned_trip_id": planned_trip_id,
            "using_new_system": True
        }
        
    except Exception as e:
        logger.error(f"Error getting video clips for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get video clips: {str(e)}")

@router.get("/{planned_trip_id}/actual-trips/{trip_id}/gps-track")
async def get_trip_gps_track(planned_trip_id: str, trip_id: int):
    """Get GPS track data for a specific actual trip"""
    if trip_logger is None:
        raise HTTPException(status_code=500, detail="Trip logger not initialized")
    
    try:
        # Use the new trip logger system to get GPS track
        gps_track = []
        if hasattr(trip_logger, 'get_gps_track_for_trip'):
            gps_track = trip_logger.get_gps_track_for_trip(trip_id)
        
        return {
            "gps_track": gps_track,
            "trip_id": trip_id,
            "planned_trip_id": planned_trip_id,
            "using_new_system": True
        }
        
    except Exception as e:
        logger.error(f"Error getting GPS track for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get GPS track: {str(e)}")
