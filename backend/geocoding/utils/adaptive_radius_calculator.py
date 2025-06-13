"""
Calculadora de radio adaptativo para optimizar descargas de geodatos
por waypoint en el enfoque tradicional.
"""

import math
import logging
from typing import List, Dict, Tuple
from geopy.distance import geodesic

logger = logging.getLogger(__name__)

class AdaptiveRadiusCalculator:
    """
    Calcula radios optimizados para cada waypoint basándose en múltiples factores:
    - Densidad de waypoints cercanos
    - Tipo de área (urbana/rural)
    - Minimización de superposición
    - Patrones de viaje
    """
    
    def __init__(self, min_radius: float = 3.0, max_radius: float = 20.0):
        self.min_radius = min_radius
        self.max_radius = max_radius
    
    def calculate_distance(self, point1: Dict, point2: Dict) -> float:
        """Calcula distancia entre dos puntos en kilómetros"""
        return geodesic((point1['lat'], point1['lon']), (point2['lat'], point2['lon'])).kilometers
    
    def detect_area_type(self, lat: float, lon: float) -> str:
        """
        Detecta el tipo de área basándose en coordenadas.
        En una implementación completa, esto podría usar APIs de población/densidad.
        """
        # Heurística simple basada en coordenadas
        # TODO: Integrar con datos de población real o APIs geográficas
        
        # Por ahora, usar una heurística básica
        lat_abs = abs(lat)
        
        # Áreas muy pobladas típicamente están en ciertas latitudes
        if 30 <= lat_abs <= 60:  # Zonas templadas más pobladas
            return "urban"
        elif 20 <= lat_abs <= 30 or 60 <= lat_abs <= 70:
            return "suburban"
        else:
            return "rural"
    
    def calculate_density_factor(self, waypoint: Dict, all_waypoints: List[Dict], search_radius: float = 50.0) -> float:
        """
        Calcula un factor de densidad basado en cuántos waypoints hay cerca
        """
        nearby_count = 0
        total_distance = 0
        
        for other_wp in all_waypoints:
            if other_wp != waypoint:
                distance = self.calculate_distance(waypoint, other_wp)
                if distance <= search_radius:
                    nearby_count += 1
                    total_distance += distance
        
        if nearby_count == 0:
            return 1.0  # Factor neutro si no hay waypoints cercanos
        
        avg_distance = total_distance / nearby_count
        
        # Factor de densidad: más waypoints cercanos = factor menor (radio menor)
        # Rango típico: 0.5 - 1.5
        density_factor = max(0.5, min(1.5, avg_distance / 25.0))
        
        return density_factor
    
    def calculate_overlap_reduction_factor(self, waypoint: Dict, all_waypoints: List[Dict], base_radius: float) -> float:
        """
        Calcula un factor de reducción para minimizar superposición
        """
        overlap_penalty = 0.0
        
        for other_wp in all_waypoints:
            if other_wp != waypoint:
                distance = self.calculate_distance(waypoint, other_wp)
                
                # Si los círculos se superponen significativamente
                if distance < base_radius * 1.2:
                    # Penalización proporcional a la superposición
                    overlap_penalty += max(0, (base_radius * 1.2 - distance) / (base_radius * 1.2))
        
        # Factor de reducción: mayor superposición = menor radio
        reduction_factor = max(0.6, 1.0 - (overlap_penalty * 0.3))
        
        return reduction_factor
    
    def calculate_optimized_radii(self, waypoints: List[Dict]) -> List[float]:
        """
        Calcula radios optimizados para todos los waypoints
        """
        logger.info(f"Calculating optimized radii for {len(waypoints)} waypoints")
        
        optimized_radii = []
        
        for i, waypoint in enumerate(waypoints):
            # 1. Radio base según tipo de área
            area_type = self.detect_area_type(waypoint['lat'], waypoint['lon'])
            
            if area_type == "urban":
                base_radius = 6.0
            elif area_type == "suburban":
                base_radius = 10.0
            else:  # rural
                base_radius = 15.0
            
            # 2. Ajuste por densidad de waypoints
            density_factor = self.calculate_density_factor(waypoint, waypoints)
            radius_after_density = base_radius * density_factor
            
            # 3. Ajuste para minimizar superposición
            overlap_factor = self.calculate_overlap_reduction_factor(waypoint, waypoints, radius_after_density)
            final_radius = radius_after_density * overlap_factor
            
            # 4. Aplicar límites mínimos y máximos
            final_radius = max(self.min_radius, min(self.max_radius, final_radius))
            
            optimized_radii.append(final_radius)
            
            logger.debug(f"Waypoint {i+1} ({waypoint.get('name', 'Unknown')}): "
                        f"area={area_type}, base={base_radius:.1f}km, "
                        f"density_factor={density_factor:.2f}, overlap_factor={overlap_factor:.2f}, "
                        f"final={final_radius:.1f}km")
        
        # 5. Estadísticas finales
        avg_radius = sum(optimized_radii) / len(optimized_radii)
        min_radius_used = min(optimized_radii)
        max_radius_used = max(optimized_radii)
        
        logger.info(f"Optimized radii calculated: avg={avg_radius:.1f}km, "
                   f"range={min_radius_used:.1f}-{max_radius_used:.1f}km")
        
        return optimized_radii
    
    def get_optimization_stats(self, waypoints: List[Dict], optimized_radii: List[float]) -> Dict:
        """
        Calcula estadísticas de la optimización
        """
        total_area_optimized = sum(math.pi * (r ** 2) for r in optimized_radii)
        total_area_traditional = len(waypoints) * math.pi * (10.0 ** 2)  # 10km fijo
        
        area_savings = (total_area_traditional - total_area_optimized) / total_area_traditional
        
        return {
            "total_waypoints": len(waypoints),
            "avg_radius_km": sum(optimized_radii) / len(optimized_radii),
            "min_radius_km": min(optimized_radii),
            "max_radius_km": max(optimized_radii),
            "total_area_km2": total_area_optimized,
            "traditional_area_km2": total_area_traditional,
            "area_savings_percent": area_savings * 100,
            "estimated_efficiency_gain": area_savings * 100  # Simplificado
        }


def calculate_adaptive_radii_for_waypoints(waypoints: List[Dict]) -> Tuple[List[float], Dict]:
    """
    Función de conveniencia para calcular radios adaptativos
    
    Args:
        waypoints: Lista de waypoints con 'lat', 'lon', 'name'
    
    Returns:
        Tuple de (radios_optimizados, estadísticas)
    """
    calculator = AdaptiveRadiusCalculator()
    optimized_radii = calculator.calculate_optimized_radii(waypoints)
    stats = calculator.get_optimization_stats(waypoints, optimized_radii)
    
    return optimized_radii, stats
