from fastapi import APIRouter, HTTPException
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional
import json
import sqlite3

router = APIRouter()

# Will be initialized from main.py
trip_logger = None

# Route to get all trips
@router.get("")
async def get_trips(date_str: Optional[str] = None):
    if date_str:
        try:
            selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            trips = trip_logger.get_trips_by_date(selected_date)
            return {"trips": trips}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        all_trips = trip_logger.get_all_trips()
        return {"trips": all_trips}

# Route to get trips by date range
@router.get("/range")
async def get_trips_range(start_date: str, end_date: str):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        trips = trip_logger.get_trips_by_date_range(start, end)
        return {"trips": trips}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

# Route to get trips by month for calendar view
@router.get("/calendar")
async def get_trips_by_month(year: int, month: int):
    try:
        # Get all trips for the specified month
        first_day = date(year, month, 1)
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
            
        # Get trips for the month
        trips = trip_logger.get_trips_by_date_range(first_day, next_month)
        
        # Format for calendar: group by day of month
        calendar_data = {}
        for trip in trips:
            # Handle different possible formats of trip data
            if isinstance(trip, dict):
                # Try to get start_time or start_date depending on what's available
                if "start_time" in trip:
                    date_str = trip["start_time"]
                elif "start_date" in trip:
                    # If only start_date is available, append a default time
                    date_str = f"{trip['start_date']} 00:00:00"
                else:
                    # Skip this trip if neither field is present
                    continue
            else:
                # If trip is not a dictionary, skip it
                continue
                
            try:
                trip_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").date()
                day = trip_date.day
                
                if day not in calendar_data:
                    calendar_data[day] = []
                    
                calendar_data[day].append(trip)
            except (ValueError, TypeError):
                # Skip entries that can't be parsed
                continue
            
        return calendar_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date parameters: {str(e)}")

# Route to start a trip manually
@router.post("/start")
async def start_trip():
    try:
        trip_id = trip_logger.start_trip()
        return {"status": "success", "trip_id": trip_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start trip: {str(e)}")

# Route to end a trip manually
@router.post("/end")
async def end_trip(trip_id: Optional[str] = None):
    try:
        success = trip_logger.end_trip(trip_id=trip_id)
        if success:
            return {"status": "success", "message": "Trip ended successfully"}
        else:
            raise HTTPException(status_code=404, detail="No active trip found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end trip: {str(e)}")

# Route to get trip statistics for dashboard
@router.get("/stats")
async def get_trip_stats(limit_recent: int = 5):
    try:
        # Get all trips for calculating statistics
        all_trips = trip_logger.get_all_trips(limit=None)
        
        # Initialize stats
        total_trips = len(all_trips)
        recording_time = 0
        distance_traveled = 0
        recent_trips = []
        
        # Calculate statistics
        for trip in all_trips:
            # Add distance if available
            if trip.get('distance_km'):
                distance_traveled += trip.get('distance_km')
            
            # Calculate recording time if start and end times are available
            if trip.get('start_time') and trip.get('end_time'):
                try:
                    start = datetime.fromisoformat(trip['start_time'])
                    end = datetime.fromisoformat(trip['end_time'])
                    duration = (end - start).total_seconds()
                    recording_time += duration
                except (ValueError, TypeError):
                    # Skip this trip if timestamps can't be parsed
                    pass
        
        # Get recent trips (limited number)
        recent_trips = all_trips[:limit_recent] if all_trips else []
        
        # Format recent trips to include only necessary data
        formatted_recent = []
        for trip in recent_trips:
            formatted_trip = {
                "id": trip.get('id'),
                "start_time": trip.get('start_time'),
                "end_time": trip.get('end_time'),
                "distance_km": trip.get('distance_km')
            }
            formatted_recent.append(formatted_trip)
            
        return {
            "total_trips": total_trips,
            "recording_time": int(recording_time),  # Return as seconds
            "distance_traveled": distance_traveled,
            "recent_trips": formatted_recent
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trip statistics: {str(e)}")