#!/usr/bin/env python3
"""
Script para añadir datos GPS aleatorios a todos los videos existentes para pruebas.
Este script generará pistas GPS realistas para los clips de video existentes.
"""

import os
import sys
import random
import json
import math
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple

# Añadir el directorio backend al path para importar módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from trip_logger_package.trip_logger import TripLogger

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GPSDataGenerator:
    """Generador de datos GPS aleatorios pero realistas"""
    
    def __init__(self):
        # Coordenadas base para diferentes regiones (puedes cambiar estas coordenadas)
        self.base_locations = [
            {"name": "Madrid", "lat": 40.4168, "lon": -3.7038},
            {"name": "Barcelona", "lat": 41.3851, "lon": 2.1734},
            {"name": "Valencia", "lat": 39.4699, "lon": -0.3763},
            {"name": "Sevilla", "lat": 37.3891, "lon": -5.9845},
            {"name": "Bilbao", "lat": 43.2627, "lon": -2.9253},
        ]
        
        # Parámetros para generar movimiento realista
        self.speed_range = (20, 60)  # km/h
        self.direction_change_probability = 0.1  # 10% probabilidad de cambiar dirección
        self.max_direction_change = 30  # Máximo cambio de dirección en grados
        
    def generate_gps_track(self, start_time: str, end_time: str, 
                          base_location: Dict = None) -> Dict:
        """
        Genera una pista GPS realista entre dos tiempos dados
        
        Args:
            start_time: Tiempo de inicio en formato ISO
            end_time: Tiempo de fin en formato ISO
            base_location: Ubicación base opcional
            
        Returns:
            Dict con metadatos GPS incluyendo waypoints, bounds, distancia, etc.
        """
        try:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            duration_seconds = (end_dt - start_dt).total_seconds()
            
            # Seleccionar ubicación base aleatoria si no se proporciona
            if not base_location:
                base_location = random.choice(self.base_locations)
            
            # Generar waypoints cada 2 segundos
            waypoints = []
            total_distance = 0.0
            
            # Posición inicial
            current_lat = base_location["lat"] + random.uniform(-0.01, 0.01)
            current_lon = base_location["lon"] + random.uniform(-0.01, 0.01)
            current_direction = random.uniform(0, 360)  # Dirección inicial aleatoria
            
            # Límites para tracking
            min_lat = max_lat = current_lat
            min_lon = max_lon = current_lon
            
            # Generar waypoints a lo largo del tiempo
            for i in range(0, int(duration_seconds) + 1, 2):  # Cada 2 segundos
                timestamp = start_dt + timedelta(seconds=i)
                
                # Velocidad aleatoria dentro del rango
                speed_kmh = random.uniform(*self.speed_range)
                speed_ms = speed_kmh / 3.6  # Convertir a m/s
                
                # Cambiar dirección ocasionalmente
                if random.random() < self.direction_change_probability:
                    direction_change = random.uniform(-self.max_direction_change, 
                                                    self.max_direction_change)
                    current_direction = (current_direction + direction_change) % 360
                
                # Calcular nueva posición
                if i > 0:  # No mover en el primer waypoint
                    # Distancia recorrida en 2 segundos
                    distance_m = speed_ms * 2
                    
                    # Convertir dirección a radianes
                    direction_rad = math.radians(current_direction)
                    
                    # Calcular cambio en coordenadas (aproximación simple)
                    # 1 grado de latitud ≈ 111,320 metros
                    # 1 grado de longitud ≈ 111,320 * cos(latitud) metros
                    lat_change = (distance_m * math.cos(direction_rad)) / 111320
                    lon_change = (distance_m * math.sin(direction_rad)) / (111320 * math.cos(math.radians(current_lat)))
                    
                    # Actualizar posición
                    prev_lat, prev_lon = current_lat, current_lon
                    current_lat += lat_change
                    current_lon += lon_change
                    
                    # Calcular distancia real recorrida
                    segment_distance = self._calculate_distance(prev_lat, prev_lon, current_lat, current_lon)
                    total_distance += segment_distance
                
                # Actualizar límites
                min_lat = min(min_lat, current_lat)
                max_lat = max(max_lat, current_lat)
                min_lon = min(min_lon, current_lon)
                max_lon = max(max_lon, current_lon)
                
                # Crear waypoint
                waypoint = {
                    "timestamp": timestamp.isoformat(),
                    "latitude": round(current_lat, 6),
                    "longitude": round(current_lon, 6),
                    "altitude": random.uniform(50, 200),  # Altitud aleatoria
                    "speed": round(speed_kmh, 1),
                    "heading": round(current_direction, 1),
                    "satellites": random.randint(4, 12),
                    "fix_quality": random.choice([2, 3, 4])  # GPS fix quality
                }
                waypoints.append(waypoint)
            
            # Crear metadatos GPS
            gps_metadata = {
                "waypoints": waypoints,
                "bounds": {
                    "north": round(max_lat, 6),
                    "south": round(min_lat, 6),
                    "east": round(max_lon, 6),
                    "west": round(min_lon, 6)
                },
                "total_distance": round(total_distance, 2),
                "point_count": len(waypoints),
                "duration_seconds": int(duration_seconds),
                "average_speed": round((total_distance / (duration_seconds / 3600)) if duration_seconds > 0 else 0, 1),
                "max_speed": max([w["speed"] for w in waypoints]) if waypoints else 0,
                "start_location": {
                    "latitude": waypoints[0]["latitude"] if waypoints else current_lat,
                    "longitude": waypoints[0]["longitude"] if waypoints else current_lon
                },
                "end_location": {
                    "latitude": waypoints[-1]["latitude"] if waypoints else current_lat,
                    "longitude": waypoints[-1]["longitude"] if waypoints else current_lon
                }
            }
            
            return gps_metadata
            
        except Exception as e:
            logger.error(f"Error generating GPS track: {str(e)}")
            return {}
    
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calcula la distancia entre dos puntos GPS usando la fórmula de Haversine
        
        Returns:
            Distancia en metros
        """
        R = 6371000  # Radio de la Tierra en metros
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) * math.sin(delta_lat / 2) +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lon / 2) * math.sin(delta_lon / 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c


class VideoGPSUpdater:
    """Actualizador de datos GPS para videos existentes"""
    
    def __init__(self, db_path: str = "/root/dashcam-v2/data/recordings.db"):
        self.db_path = db_path
        self.gps_generator = GPSDataGenerator()
        self.trip_logger = TripLogger(db_path)
        
    def get_all_video_clips(self) -> List[Dict]:
        """Obtiene todos los clips de video usando Trip Logger"""
        try:
            # Usar Trip Logger para obtener videos
            videos = self.trip_logger.get_trip_videos()
            
            # Convertir al formato esperado por el resto del código
            clips = []
            for video in videos:
                clip = {
                    'id': video.get('id', ''),
                    'trip_id': video.get('trip_id', ''),
                    'start_time': video.get('start_time', ''),
                    'end_time': video.get('end_time', ''),
                    'start_lat': video.get('start_lat'),
                    'start_lon': video.get('start_lon'),
                    'end_lat': video.get('end_lat'),
                    'end_lon': video.get('end_lon'),
                    'road_video_file': video.get('road_video_file', ''),
                    'interior_video_file': video.get('interior_video_file', ''),
                    'sequence_num': video.get('sequence_num', 0)
                }
                clips.append(clip)
            
            logger.info(f"Obtenidos {len(clips)} clips de video")
            return clips
            
        except Exception as e:
            logger.error(f"Error getting video clips: {str(e)}")
            return []
    
    def update_clip_with_gps_data(self, clip: Dict) -> bool:
        """Actualiza un clip individual con datos GPS usando Trip Logger"""
        try:
            # Generar datos GPS para este clip
            gps_metadata = self.gps_generator.generate_gps_track(
                clip["start_time"], 
                clip["end_time"]
            )
            
            if not gps_metadata:
                logger.warning(f"No se pudieron generar datos GPS para clip {clip['id']}")
                return False
            
            # Actualizar coordenadas de inicio y fin usando Trip Logger
            start_location = gps_metadata["start_location"]
            end_location = gps_metadata["end_location"]
            
            # Usar SQLAlchemy session para actualizar datos GPS
            with self.trip_logger.get_session() as session:
                # Actualizar video_clips con coordenadas de inicio y fin
                session.execute("""
                    UPDATE video_clips 
                    SET start_lat = :start_lat, start_lon = :start_lon, 
                        end_lat = :end_lat, end_lon = :end_lon
                    WHERE id = :clip_id
                """, {
                    'start_lat': start_location["latitude"],
                    'start_lon': start_location["longitude"],
                    'end_lat': end_location["latitude"],
                    'end_lon': end_location["longitude"],
                    'clip_id': clip["id"]
                })
                
                # Añadir waypoints individuales a la tabla gps_coordinates
                if clip["trip_id"]:
                    for waypoint in gps_metadata["waypoints"]:
                        session.execute("""
                            INSERT OR REPLACE INTO gps_coordinates 
                            (trip_id, timestamp, latitude, longitude, altitude, speed, heading, satellites, fix_quality)
                            VALUES (:trip_id, :timestamp, :latitude, :longitude, :altitude, :speed, :heading, :satellites, :fix_quality)
                        """, {
                            'trip_id': clip["trip_id"],
                            'timestamp': waypoint["timestamp"],
                            'latitude': waypoint["latitude"],
                            'longitude': waypoint["longitude"],
                            'altitude': waypoint["altitude"],
                            'speed': waypoint["speed"],
                            'heading': waypoint["heading"],
                            'satellites': waypoint["satellites"],
                            'fix_quality': waypoint["fix_quality"]
                        })
            
            logger.info(f"Clip {clip['id']} actualizado con {len(gps_metadata['waypoints'])} waypoints GPS")
            return True
            
        except Exception as e:
            logger.error(f"Error updating clip {clip['id']} with GPS data: {str(e)}")
            return False
    
    def update_all_clips(self) -> Dict:
        """Actualiza todos los clips con datos GPS aleatorios"""
        logger.info("Iniciando actualización de clips con datos GPS...")
        
        clips = self.get_all_video_clips()
        if not clips:
            logger.warning("No se encontraron clips para actualizar")
            return {"updated": 0, "failed": 0, "total": 0}
        
        logger.info(f"Encontrados {len(clips)} clips para actualizar")
        
        updated_count = 0
        failed_count = 0
        
        for i, clip in enumerate(clips, 1):
            logger.info(f"Procesando clip {i}/{len(clips)} (ID: {clip['id']})")
            
            # Verificar si ya tiene datos GPS
            if clip["start_lat"] and clip["start_lon"]:
                logger.info(f"Clip {clip['id']} ya tiene datos GPS, omitiendo...")
                continue
            
            success = self.update_clip_with_gps_data(clip)
            if success:
                updated_count += 1
            else:
                failed_count += 1
                
            # Pequeña pausa para no sobrecargar el sistema
            if i % 10 == 0:
                logger.info(f"Progreso: {i}/{len(clips)} clips procesados")
        
        result = {
            "updated": updated_count,
            "failed": failed_count,
            "total": len(clips)
        }
        
        logger.info(f"Actualización completada: {updated_count} actualizados, {failed_count} fallidos de {len(clips)} total")
        return result
    
    def generate_sample_gps_for_testing(self, num_samples: int = 5) -> List[Dict]:
        """Genera algunos ejemplos de datos GPS para pruebas"""
        logger.info(f"Generando {num_samples} ejemplos de datos GPS...")
        
        samples = []
        for i in range(num_samples):
            start_time = datetime.now() - timedelta(hours=i*2)
            end_time = start_time + timedelta(minutes=random.randint(5, 30))
            
            gps_data = self.gps_generator.generate_gps_track(
                start_time.isoformat(),
                end_time.isoformat()
            )
            
            sample = {
                "sample_id": i + 1,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "gps_metadata": gps_data
            }
            samples.append(sample)
            
            logger.info(f"Ejemplo {i+1}: {len(gps_data.get('waypoints', []))} waypoints, "
                       f"{gps_data.get('total_distance', 0):.1f}m distancia")
        
        return samples


def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Añadir datos GPS aleatorios a videos existentes")
    parser.add_argument("--db-path", default="/root/dashcam-v2/data/recordings.db",
                       help="Ruta a la base de datos")
    parser.add_argument("--samples-only", action="store_true",
                       help="Solo generar ejemplos de datos GPS, no actualizar la base de datos")
    parser.add_argument("--force", action="store_true",
                       help="Forzar actualización incluso si ya existen datos GPS")
    
    args = parser.parse_args()
    
    updater = VideoGPSUpdater(args.db_path)
    
    if args.samples_only:
        # Solo generar ejemplos
        samples = updater.generate_sample_gps_for_testing()
        
        print("\n=== EJEMPLOS DE DATOS GPS GENERADOS ===")
        for sample in samples:
            gps = sample["gps_metadata"]
            print(f"\nEjemplo {sample['sample_id']}:")
            print(f"  Duración: {sample['start_time']} - {sample['end_time']}")
            print(f"  Waypoints: {gps.get('point_count', 0)}")
            print(f"  Distancia: {gps.get('total_distance', 0):.1f}m")
            print(f"  Velocidad promedio: {gps.get('average_speed', 0):.1f} km/h")
            print(f"  Límites: N:{gps.get('bounds', {}).get('north', 0):.6f}, "
                  f"S:{gps.get('bounds', {}).get('south', 0):.6f}")
    else:
        # Actualizar todos los clips
        result = updater.update_all_clips()
        
        print(f"\n=== RESULTADO DE LA ACTUALIZACIÓN ===")
        print(f"Total de clips: {result['total']}")
        print(f"Clips actualizados: {result['updated']}")
        print(f"Clips con errores: {result['failed']}")
        print(f"Tasa de éxito: {(result['updated']/result['total']*100):.1f}%" if result['total'] > 0 else "N/A")


if __name__ == "__main__":
    main()
