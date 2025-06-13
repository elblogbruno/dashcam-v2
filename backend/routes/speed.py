from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be initialized from main.py
trip_logger = None
gps_reader = None

@router.get("/current")
async def get_current_speed():
    """Obtiene la velocidad actual del vehículo"""
    try:
        # Primero intentar obtener velocidad del GPS reader
        gps_data = gps_reader.get_location() if gps_reader else None
        
        # Obtener velocidad calculada del trip logger
        calculated_speed = trip_logger.get_current_speed() if trip_logger else 0.0
        
        # Preparar respuesta
        response = {
            "current_speed_kmh": 0.0,
            "gps_speed_kmh": 0.0,
            "calculated_speed_kmh": calculated_speed,
            "source": "none",
            "timestamp": datetime.now().isoformat(),
            "gps_status": "inactive"
        }
        
        if gps_data:
            gps_speed = gps_data.get('speed', 0.0) or 0.0
            response["gps_speed_kmh"] = gps_speed
            response["gps_status"] = gps_data.get('status', 'inactive')
            
            # Determinar velocidad final y fuente
            if gps_speed > 0 and calculated_speed > 0:
                # Promedio ponderado si ambas están disponibles
                response["current_speed_kmh"] = (gps_speed * 0.7) + (calculated_speed * 0.3)
                response["source"] = "combined"
            elif gps_speed > 0:
                response["current_speed_kmh"] = gps_speed
                response["source"] = "gps"
            elif calculated_speed > 0:
                response["current_speed_kmh"] = calculated_speed
                response["source"] = "calculated"
            else:
                response["source"] = "none"
        elif calculated_speed > 0:
            response["current_speed_kmh"] = calculated_speed
            response["source"] = "calculated"
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting current speed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error obtaining speed data: {str(e)}")

@router.get("/trip/{trip_id}/statistics")
async def get_trip_speed_statistics(trip_id: int):
    """Obtiene estadísticas de velocidad para un viaje específico"""
    try:
        if not trip_logger:
            raise HTTPException(status_code=500, detail="Trip logger not initialized")
            
        stats = trip_logger.get_trip_speed_statistics(trip_id)
        
        if not stats:
            raise HTTPException(status_code=404, detail="Trip not found or no speed data available")
            
        return {
            "trip_id": trip_id,
            "statistics": stats,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting speed statistics for trip {trip_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error obtaining trip speed statistics: {str(e)}")

@router.get("/current/detailed")
async def get_detailed_speed_info():
    """Obtiene información detallada de velocidad incluyendo datos GPS"""
    try:
        # Obtener datos GPS actuales
        gps_data = gps_reader.get_location() if gps_reader else None
        
        # Obtener velocidad calculada
        calculated_speed = trip_logger.get_current_speed() if trip_logger else 0.0
        
        # Obtener estadísticas del viaje actual si hay uno activo
        current_trip_stats = None
        if trip_logger and trip_logger.current_trip_id:
            current_trip_stats = trip_logger.get_trip_speed_statistics(trip_logger.current_trip_id)
        
        response = {
            "current_speed": {
                "kmh": 0.0,
                "mph": 0.0,
                "ms": 0.0,
                "source": "none"
            },
            "gps_data": {
                "speed_kmh": 0.0,
                "latitude": None,
                "longitude": None,
                "altitude": None,
                "heading": None,
                "satellites": None,
                "fix_quality": None,
                "status": "inactive",
                "last_update": None
            },
            "calculated_speed_kmh": calculated_speed,
            "current_trip": {
                "active": trip_logger.current_trip_id is not None if trip_logger else False,
                "trip_id": trip_logger.current_trip_id if trip_logger else None,
                "statistics": current_trip_stats
            },
            "timestamp": datetime.now().isoformat()
        }
        
        # Rellenar datos GPS si están disponibles
        if gps_data:
            gps_speed = gps_data.get('speed', 0.0) or 0.0
            response["gps_data"].update({
                "speed_kmh": gps_speed,
                "latitude": gps_data.get('latitude'),
                "longitude": gps_data.get('longitude'),
                "altitude": gps_data.get('altitude'),
                "heading": gps_data.get('heading'),
                "satellites": gps_data.get('satellites'),
                "fix_quality": gps_data.get('fix_quality'),
                "status": gps_data.get('status', 'inactive'),
                "last_update": gps_data.get('timestamp')
            })
            
            # Calcular velocidad final
            if gps_speed > 0 and calculated_speed > 0:
                final_speed = (gps_speed * 0.7) + (calculated_speed * 0.3)
                source = "combined"
            elif gps_speed > 0:
                final_speed = gps_speed
                source = "gps"
            elif calculated_speed > 0:
                final_speed = calculated_speed
                source = "calculated"
            else:
                final_speed = 0.0
                source = "none"
        else:
            final_speed = calculated_speed
            source = "calculated" if calculated_speed > 0 else "none"
        
        # Actualizar velocidad actual con conversiones
        response["current_speed"].update({
            "kmh": final_speed,
            "mph": final_speed * 0.621371,  # km/h a mph
            "ms": final_speed / 3.6,        # km/h a m/s
            "source": source
        })
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting detailed speed info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error obtaining detailed speed data: {str(e)}")
