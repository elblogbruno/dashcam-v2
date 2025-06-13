#!/usr/bin/env python3
"""
Demo script para mostrar la integración completa de GPS y Video en el sistema dashcam
"""

import sys
import os
import time
import logging
from datetime import datetime, timedelta

# Add backend to path
sys.path.append('/root/dashcam-v2/backend')

from trip_logger import TripLogger
from video_metadata_injector import VideoMetadataInjector
from landmarks.core.landmark_checker import LandmarkChecker

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def simulate_video_recording_with_gps():
    """Simula una grabación de video real con seguimiento GPS y detección de landmarks"""
    
    logger.info("=== Demo: Integración GPS-Video Completa ===")
    
    try:
        # Initialize components
        trip_logger = TripLogger()
        video_injector = VideoMetadataInjector()
        landmark_checker = LandmarkChecker()
        
        # Start a new trip
        trip_id = trip_logger.start_trip()
        logger.info(f"🚗 Iniciado viaje: {trip_id}")
        
        # Simulate driving route through NYC with GPS coordinates
        route_points = [
            {"lat": 40.7589, "lon": -73.9851, "location": "Times Square"},
            {"lat": 40.7614, "lon": -73.9776, "location": "Central Park South"},
            {"lat": 40.7829, "lon": -73.9654, "location": "Central Park North"},
            {"lat": 40.7505, "lon": -73.9934, "location": "Hudson Yards"},
            {"lat": 40.7282, "lon": -74.0776, "location": "Battery Park"}
        ]
        
        gps_track = []
        video_segments = []
        
        logger.info("📍 Simulando ruta con coordenadas GPS...")
        
        for i, point in enumerate(route_points):
            # Log GPS coordinate
            success = trip_logger.log_gps_coordinate(
                latitude=point["lat"],
                longitude=point["lon"],
                altitude=10.0 + (i * 2),  # Varying altitude
                speed=25.0 + (i * 5),     # Varying speed
                heading=45 + (i * 20),    # Changing direction
                satellites=8 + i,
                fix_quality=3
            )
            
            if success:
                logger.info(f"  ✓ GPS logged: {point['location']} ({point['lat']:.4f}, {point['lon']:.4f})")
                gps_track.append(point)
                
                # Check for nearby landmarks
                nearby_landmarks = landmark_checker.get_nearby_landmarks(
                    point["lat"], point["lon"], radius_km=1.0
                )
                
                if nearby_landmarks:
                    logger.info(f"    🏛️  Landmarks cercanos: {len(nearby_landmarks)}")
                    for landmark_info in nearby_landmarks[:2]:  # Show first 2
                        landmark = landmark_info['landmark']
                        distance_meters = landmark_info['distance_meters']
                        
                        logger.info(f"      - {landmark['name']}: {distance_meters:.0f}m")
                        
                        # Log quality upgrade if landmark is very close
                        if distance_meters < 500:
                            trip_logger.log_quality_upgrade(
                                landmark_id=landmark.get('id'),
                                landmark_name=landmark['name'],
                                distance_meters=distance_meters,
                                reason="proximity_to_landmark"
                            )
                            logger.info(f"      ⚡ Calidad mejorada por proximidad")
                
                # Simulate video segment creation
                start_time = datetime.now() - timedelta(seconds=(len(route_points)-i)*30)
                end_time = start_time + timedelta(seconds=30)
                
                video_info = {
                    'sequence': i + 1,
                    'start_time': start_time.isoformat(),
                    'end_time': end_time.isoformat(),
                    'location': point['location'],
                    'quality': 'high' if nearby_landmarks else 'normal'
                }
                video_segments.append(video_info)
                
            time.sleep(0.1)  # Small delay to simulate real time
        
        # End the trip
        trip_logger.end_trip(
            end_lat=route_points[-1]["lat"],
            end_lon=route_points[-1]["lon"]
        )
        logger.info(f"🏁 Viaje {trip_id} finalizado")
        
        # Get complete GPS track from database
        db_gps_track = trip_logger.get_gps_track_for_trip(trip_id)
        logger.info(f"📊 Track GPS completo: {len(db_gps_track)} puntos")
        
        # Generate comprehensive trip summary
        trip_summary = trip_logger.get_trip_gps_summary(trip_id)
        logger.info("📋 Resumen del viaje:")
        logger.info(f"  - Puntos GPS: {len(trip_summary.get('gps_track', []))}")
        logger.info(f"  - Landmarks: {len(trip_summary.get('landmarks', []))}")
        logger.info(f"  - Mejoras de calidad: {len(trip_summary.get('quality_upgrades', []))}")
        
        stats = trip_summary.get('statistics', {})
        if stats:
            logger.info(f"  - Velocidad promedio: {stats.get('avg_speed', 0):.1f} km/h")
            logger.info(f"  - Velocidad máxima: {stats.get('max_speed', 0):.1f} km/h")
            logger.info(f"  - Satélites promedio: {stats.get('avg_satellites', 0):.1f}")
        
        # Demonstrate video metadata preparation for each segment
        logger.info("🎥 Preparando metadata para segmentos de video...")
        
        for segment in video_segments:
            # Get GPS data for this time range
            segment_start = datetime.fromisoformat(segment['start_time'])
            segment_end = datetime.fromisoformat(segment['end_time'])
            
            # For demo, use the full track (in real system, would filter by time)
            metadata = video_injector.prepare_gps_metadata(db_gps_track, segment)
            
            logger.info(f"  📼 Segmento {segment['sequence']} ({segment['location']}):")
            logger.info(f"    - Waypoints: {len(metadata.get('waypoints', []))}")
            logger.info(f"    - Distancia: {metadata.get('total_distance_km', 0):.2f} km")
            logger.info(f"    - Coordenadas: {metadata.get('metadata:gps_start_lat', 'N/A')}, {metadata.get('metadata:gps_start_lon', 'N/A')}")
            
            # Create GPX track for this segment
            gpx_content = video_injector.create_gpx_track(db_gps_track, segment)
            if gpx_content:
                logger.info(f"    ✓ GPX track generado ({len(gpx_content)} caracteres)")
        
        logger.info("🎉 Demo completado exitosamente!")
        logger.info("Sistema listo para:")
        logger.info("  ✓ Registro continuo de coordenadas GPS")
        logger.info("  ✓ Inyección de metadata GPS en videos")
        logger.info("  ✓ Detección inteligente de landmarks")
        logger.info("  ✓ Mejoras automáticas de calidad")
        logger.info("  ✓ Generación de tracks GPX")
        logger.info("  ✓ Análisis completo de viajes")
        
        return True
        
    except Exception as e:
        logger.error(f"Error en demo: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    simulate_video_recording_with_gps()
