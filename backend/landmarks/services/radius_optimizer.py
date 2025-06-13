"""
Algoritmo de optimización de radio para sistema DashCam V2.
Maximiza la eficiencia de cobertura de geodatos mediante análisis de densidad
de waypoints, detección de superposiciones y empaquetado óptimo de círculos.
"""

import math
import numpy as np
from typing import List, Tuple, Dict, Optional, Any
from dataclasses import dataclass
from geopy.distance import geodesic
import logging

logger = logging.getLogger(__name__)

@dataclass
class Waypoint:
    """Representa un waypoint con coordenadas geográficas."""
    lat: float
    lon: float
    name: Optional[str] = None
    
    def distance_to(self, other: 'Waypoint') -> float:
        """Calcula la distancia en kilómetros a otro waypoint."""
        return geodesic((self.lat, self.lon), (other.lat, other.lon)).kilometers

@dataclass
class CoverageCircle:
    """Representa un círculo de cobertura para descarga de geodatos."""
    center: Waypoint
    radius_km: float
    waypoints_covered: List[Waypoint]
    
    def area(self) -> float:
        """Calcula el área del círculo en km²."""
        return math.pi * (self.radius_km ** 2)
    
    def contains_waypoint(self, waypoint: Waypoint) -> bool:
        """Verifica si un waypoint está dentro del círculo."""
        return self.center.distance_to(waypoint) <= self.radius_km
    
    def overlap_area_with(self, other: 'CoverageCircle') -> float:
        """Calcula el área de superposición con otro círculo."""
        d = self.center.distance_to(other.center)
        r1, r2 = self.radius_km, other.radius_km
        
        # No hay superposición si la distancia es mayor que la suma de radios
        if d >= r1 + r2:
            return 0.0
        
        # Un círculo está completamente dentro del otro
        if d <= abs(r1 - r2):
            smaller_radius = min(r1, r2)
            return math.pi * (smaller_radius ** 2)
        
        # Superposición parcial - fórmula de intersección de círculos
        part1 = r1**2 * math.acos((d**2 + r1**2 - r2**2) / (2 * d * r1))
        part2 = r2**2 * math.acos((d**2 + r2**2 - r1**2) / (2 * d * r2))
        part3 = 0.5 * math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))
        
        return part1 + part2 - part3

@dataclass
class OptimizationResult:
    """Resultado del algoritmo de optimización."""
    optimized_circles: List[CoverageCircle]
    total_coverage_area: float
    total_overlap_area: float
    efficiency_ratio: float
    waypoints_covered: int
    avg_radius: float
    recommendations: List[str]

class WaypointDensityAnalyzer:
    """Analiza la densidad de waypoints para optimizar radios de cobertura."""
    
    def __init__(self, min_radius_km: float = 2.0, max_radius_km: float = 25.0):
        self.min_radius_km = min_radius_km
        self.max_radius_km = max_radius_km
    
    def analyze_density_clusters(self, waypoints: List[Waypoint]) -> List[List[Waypoint]]:
        """
        Agrupa waypoints en clusters basado en densidad espacial.
        Utiliza un algoritmo DBSCAN simplificado.
        """
        logger.debug(f"Analizando densidad de {len(waypoints)} waypoints para clustering")
        if not waypoints:
            logger.debug("No hay waypoints para analizar")
            return []
        
        # Optimización: aumentar el radio de análisis para datasets grandes
        # para crear clusters más grandes y reducir el número total
        if len(waypoints) > 50:
            analysis_radius = 15.0  # km - radio más grande para agrupar más waypoints
            logger.debug(f"Dataset grande detectado, usando radio de clustering ampliado: {analysis_radius}km")
        else:
            analysis_radius = 10.0  # km
            logger.debug(f"Usando radio de clustering estándar: {analysis_radius}km")
        
        clusters = []
        visited = set()
        
        for i, waypoint in enumerate(waypoints):
            if i in visited:
                continue
            
            cluster = [waypoint]
            visited.add(i)
            
            # Buscar waypoints cercanos (dentro de radio de análisis)
            for j, other_waypoint in enumerate(waypoints):
                if j in visited or i == j:
                    continue
                
                if waypoint.distance_to(other_waypoint) <= analysis_radius:
                    cluster.append(other_waypoint)
                    visited.add(j)
            
            if len(cluster) >= 3 or len(waypoints) <= 20:  # Solo crear clusters significativos para datasets grandes
                logger.debug(f"Cluster encontrado con {len(cluster)} waypoints (centro: {waypoint.lat:.4f},{waypoint.lon:.4f})")
                clusters.append(cluster)
            else:
                # Para clusters muy pequeños en datasets grandes, tratarlos individualmente
                for wp in cluster:
                    clusters.append([wp])
                logger.debug(f"Cluster pequeño dividido en {len(cluster)} clusters individuales")
        
        logger.info(f"Total de clusters generados: {len(clusters)}")
        return clusters
    
    def calculate_optimal_radius_for_cluster(self, cluster: List[Waypoint]) -> float:
        """
        Calcula el radio óptimo para un cluster de waypoints.
        Considera la densidad y distribución espacial.
        """
        logger.debug(f"Calculando radio óptimo para cluster de tamaño {len(cluster)}")
        if len(cluster) <= 1:
            logger.debug(f"Cluster pequeño, usando radio mínimo: {self.min_radius_km} km")
            return self.min_radius_km
        
        # Calcular centroide del cluster
        centroid_lat = sum(wp.lat for wp in cluster) / len(cluster)
        centroid_lon = sum(wp.lon for wp in cluster) / len(cluster)
        centroid = Waypoint(centroid_lat, centroid_lon)
        
        # Calcular distancias desde el centroide
        distances = [centroid.distance_to(wp) for wp in cluster]
        max_distance = max(distances)
        avg_distance = sum(distances) / len(distances)
        
        # Radio base según densidad
        density_factor = len(cluster) / (max_distance * max_distance) if max_distance > 0 else 1.0
        
        logger.debug(f"Centroide: ({centroid_lat:.5f}, {centroid_lon:.5f}), max_dist: {max_distance:.2f}, avg_dist: {avg_distance:.2f}, densidad: {density_factor:.2f}")
        
        # Ajustar radio según densidad y distribución
        if density_factor > 0.5:  # Alta densidad
            optimal_radius = min(max_distance * 1.2, self.max_radius_km * 0.6)
            logger.debug(f"Alta densidad, radio óptimo: {optimal_radius:.2f}")
        elif density_factor > 0.2:  # Densidad media
            optimal_radius = min(max_distance * 1.5, self.max_radius_km * 0.8)
            logger.debug(f"Densidad media, radio óptimo: {optimal_radius:.2f}")
        else:  # Baja densidad
            optimal_radius = min(max_distance * 2.0, self.max_radius_km)
            logger.debug(f"Baja densidad, radio óptimo: {optimal_radius:.2f}")
        
        return max(optimal_radius, self.min_radius_km)

class CirclePackingOptimizer:
    """Optimiza el empaquetado de círculos para minimizar superposiciones."""
    
    def __init__(self, overlap_tolerance: float = 0.15):
        """
        Args:
            overlap_tolerance: Tolerancia de superposición (0.15 = 15% máximo)
        """
        self.overlap_tolerance = overlap_tolerance
    
    def optimize_circle_packing(self, initial_circles: List[CoverageCircle]) -> List[CoverageCircle]:
        """
        Optimiza el empaquetado de círculos para reducir superposiciones.
        Utiliza algoritmo greedy con refinamiento local.
        """
        logger.debug(f"Iniciando optimización de empaquetado con {len(initial_circles)} círculos iniciales")
        if not initial_circles:
            logger.debug("No hay círculos iniciales para optimizar")
            return []
        
        # Optimización: para datasets grandes, usar los círculos iniciales directamente
        # con ajustes mínimos para evitar el algoritmo greedy costoso
        if len(initial_circles) > 30:
            logger.debug(f"Dataset grande ({len(initial_circles)} círculos), aplicando optimización rápida")
            optimized = self._fast_overlap_adjustment(initial_circles)
            logger.info(f"Optimización rápida completada. Total círculos: {len(optimized)}")
            return optimized
        
        # Para datasets pequeños, usar el algoritmo completo
        optimized = []
        remaining_waypoints = []
        
        # Recopilar todos los waypoints
        for circle in initial_circles:
            remaining_waypoints.extend(circle.waypoints_covered)
        
        # Eliminar duplicados manteniendo orden
        seen = set()
        unique_waypoints = []
        for wp in remaining_waypoints:
            wp_key = (wp.lat, wp.lon)
            if wp_key not in seen:
                seen.add(wp_key)
                unique_waypoints.append(wp)
        
        remaining_waypoints = unique_waypoints
        logger.debug(f"Waypoints únicos a cubrir: {len(remaining_waypoints)}")
        
        iteration = 0
        max_iterations = min(50, len(initial_circles) * 2)  # Limitar iteraciones
        
        while remaining_waypoints and iteration < max_iterations:
            iteration += 1
            # Encontrar el mejor círculo para los waypoints restantes
            best_circle = self._find_best_circle_for_waypoints(remaining_waypoints)
            if not best_circle:
                logger.warning(f"No se pudo encontrar un círculo óptimo en iteración {iteration}")
                break
            
            logger.debug(f"Iteración {iteration}: Mejor círculo cubre {len(best_circle.waypoints_covered)} waypoints, centro: ({best_circle.center.lat:.4f},{best_circle.center.lon:.4f}), radio: {best_circle.radius_km:.2f}")
            # Verificar y ajustar superposiciones
            adjusted_circle = self._adjust_for_overlaps(best_circle, optimized)
            optimized.append(adjusted_circle)
            
            # Remover waypoints cubiertos
            before = len(remaining_waypoints)
            remaining_waypoints = [
                wp for wp in remaining_waypoints 
                if not adjusted_circle.contains_waypoint(wp)
            ]
            after = len(remaining_waypoints)
            logger.debug(f"Waypoints restantes tras iteración {iteration}: {after} (cubiertos: {before - after})")
        
        logger.info(f"Optimización de empaquetado completada en {iteration} iteraciones. Total círculos optimizados: {len(optimized)}")
        return optimized
    
    def _find_best_circle_for_waypoints(self, waypoints: List[Waypoint]) -> Optional[CoverageCircle]:
        """Encuentra el círculo óptimo para cubrir el máximo número de waypoints."""
        logger.debug(f"Buscando mejor círculo para {len(waypoints)} waypoints")
        if not waypoints:
            logger.debug("No hay waypoints disponibles para encontrar círculo")
            return None
        
        best_circle = None
        max_coverage = 0
        
        # Optimización: limitar centros candidatos para datasets grandes
        if len(waypoints) > 20:
            # Para datasets grandes, usar solo una muestra representativa de centros
            sample_size = min(15, len(waypoints))
            # Seleccionar waypoints distribuidos uniformemente
            step = len(waypoints) // sample_size
            candidate_centers = [waypoints[i] for i in range(0, len(waypoints), step)][:sample_size]
            logger.debug(f"Dataset grande detectado, usando {len(candidate_centers)} centros candidatos (muestreo)")
        else:
            candidate_centers = waypoints
            logger.debug(f"Dataset pequeño, evaluando todos los {len(candidate_centers)} centros")
        
        # Optimización: usar menos radios candidatos con pasos más grandes
        radius_candidates = list(np.arange(2.0, 25.0, 2.0))  # Pasos de 2km en lugar de 1km
        total_combinations = len(candidate_centers) * len(radius_candidates)
        logger.debug(f"Evaluando {total_combinations} combinaciones centro-radio optimizadas")
        
        # Probar diferentes centros y radios
        for center_idx, center_wp in enumerate(candidate_centers):
            if center_idx % 5 == 0:  # Log cada 5 centros para no saturar logs
                logger.debug(f"Evaluando centro {center_idx+1}/{len(candidate_centers)}: ({center_wp.lat:.5f}, {center_wp.lon:.5f})")
            
            for radius in radius_candidates:
                covered = [wp for wp in waypoints if center_wp.distance_to(wp) <= radius]
                
                if len(covered) > max_coverage:
                    max_coverage = len(covered)
                    best_circle = CoverageCircle(center_wp, radius, covered)
                    logger.debug(f"Nuevo mejor círculo: radio={radius:.1f}km, cobertura={len(covered)} waypoints")
                
                # Optimización: early exit si ya cubrimos todos los waypoints
                if len(covered) == len(waypoints):
                    logger.debug(f"Cobertura completa alcanzada con radio {radius:.1f}km, terminando búsqueda temprana")
                    break
            
            # Si ya tenemos cobertura completa, no necesitamos probar más centros
            if max_coverage == len(waypoints):
                break
        
        logger.debug(f"Círculo óptimo encontrado: cobertura={max_coverage} waypoints")
        return best_circle
    
    def _adjust_for_overlaps(self, new_circle: CoverageCircle, 
                           existing_circles: List[CoverageCircle]) -> CoverageCircle:
        """Ajusta un círculo para minimizar superposiciones con círculos existentes."""
        adjusted_circle = new_circle
        
        for existing in existing_circles:
            overlap_area = adjusted_circle.overlap_area_with(existing)
            overlap_ratio = overlap_area / adjusted_circle.area()
            
            if overlap_ratio > self.overlap_tolerance:
                logger.debug(f"Superposición detectada ({overlap_ratio:.2%}), ajustando radio")
                # Reducir radio para minimizar superposición
                max_distance = existing.center.distance_to(adjusted_circle.center)
                new_radius = max(max_distance * 0.8, 2.0)
                
                # Recalcular waypoints cubiertos
                covered = [wp for wp in adjusted_circle.waypoints_covered 
                          if adjusted_circle.center.distance_to(wp) <= new_radius]
                
                adjusted_circle = CoverageCircle(
                    adjusted_circle.center, new_radius, covered
                )
        
        return adjusted_circle
    
    def _fast_overlap_adjustment(self, circles: List[CoverageCircle]) -> List[CoverageCircle]:
        """Optimización rápida para datasets grandes - ajuste mínimo de superposiciones."""
        logger.debug("Aplicando ajuste rápido de superposiciones")
        
        adjusted_circles = []
        for i, circle in enumerate(circles):
            adjusted_circle = circle
            
            # Solo verificar superposiciones con círculos ya procesados
            for existing in adjusted_circles:
                overlap_area = adjusted_circle.overlap_area_with(existing)
                overlap_ratio = overlap_area / adjusted_circle.area() if adjusted_circle.area() > 0 else 0
                
                if overlap_ratio > self.overlap_tolerance:
                    # Reducir radio ligeramente
                    distance_between_centers = existing.center.distance_to(adjusted_circle.center)
                    new_radius = max(distance_between_centers * 0.9, self.overlap_tolerance * adjusted_circle.radius_km, 2.0)
                    
                    # Recalcular waypoints cubiertos con nuevo radio
                    covered = [wp for wp in adjusted_circle.waypoints_covered 
                              if adjusted_circle.center.distance_to(wp) <= new_radius]
                    
                    adjusted_circle = CoverageCircle(
                        adjusted_circle.center, new_radius, covered
                    )
            
            adjusted_circles.append(adjusted_circle)
            
            if i % 10 == 0:  # Log progreso cada 10 círculos
                logger.debug(f"Procesados {i+1}/{len(circles)} círculos")
        
        return adjusted_circles

class RadiusOptimizer:
    """Clase principal para optimización de radio de cobertura de geodatos."""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.min_radius_km = self.config.get('min_radius_km', 2.0)
        self.max_radius_km = self.config.get('max_radius_km', 25.0)
        self.overlap_tolerance = self.config.get('overlap_tolerance', 0.15)
        
        self.density_analyzer = WaypointDensityAnalyzer(
            self.min_radius_km, self.max_radius_km
        )
        self.packing_optimizer = CirclePackingOptimizer(self.overlap_tolerance)
    
    def optimize_coverage(self, waypoints: List[Waypoint]) -> OptimizationResult:
        """
        Ejecuta el algoritmo completo de optimización de cobertura.
        
        Args:
            waypoints: Lista de waypoints a cubrir
            
        Returns:
            OptimizationResult: Resultado completo de la optimización
        """
        logger.info(f"Iniciando optimización para {len(waypoints)} waypoints")
        
        if not waypoints:
            logger.warning("No se recibieron waypoints para optimizar")
            return OptimizationResult([], 0, 0, 0, 0, 0, ["Sin waypoints para optimizar"])
        
        # Paso 1: Análisis de densidad y clustering
        clusters = self.density_analyzer.analyze_density_clusters(waypoints)
        logger.info(f"Identificados {len(clusters)} clusters de waypoints")
        
        # Paso 2: Calcular círculos iniciales basados en clusters
        initial_circles = []
        for idx, cluster in enumerate(clusters):
            optimal_radius = self.density_analyzer.calculate_optimal_radius_for_cluster(cluster)
            
            # Calcular centroide del cluster
            centroid_lat = sum(wp.lat for wp in cluster) / len(cluster)
            centroid_lon = sum(wp.lon for wp in cluster) / len(cluster)
            centroid = Waypoint(centroid_lat, centroid_lon)
            
            # Filtrar waypoints realmente cubiertos por el radio óptimo
            covered_waypoints = [
                wp for wp in cluster 
                if centroid.distance_to(wp) <= optimal_radius
            ]
            
            logger.debug(f"Cluster {idx}: centroide=({centroid_lat:.5f},{centroid_lon:.5f}), radio óptimo={optimal_radius:.2f}, waypoints cubiertos={len(covered_waypoints)}")
            if covered_waypoints:
                initial_circles.append(CoverageCircle(
                    centroid, optimal_radius, covered_waypoints
                ))
        
        logger.info(f"Círculos iniciales generados: {len(initial_circles)}")
        # Paso 3: Optimización de empaquetado
        optimized_circles = self.packing_optimizer.optimize_circle_packing(initial_circles)
        
        # Paso 4: Calcular métricas de optimización
        result = self._calculate_optimization_metrics(optimized_circles, waypoints)
        
        logger.info(f"Optimización completada: {result.waypoints_covered}/{len(waypoints)} waypoints cubiertos "
                   f"con eficiencia del {result.efficiency_ratio:.1%}")
        
        return result
    
    def _calculate_optimization_metrics(self, circles: List[CoverageCircle], 
                                      original_waypoints: List[Waypoint]) -> OptimizationResult:
        """Calcula métricas completas del resultado de optimización."""
        if not circles:
            logger.warning("No se pudieron generar círculos de cobertura")
            return OptimizationResult([], 0, 0, 0, 0, 0, ["No se pudieron generar círculos de cobertura"])
        
        # Métricas básicas
        total_coverage_area = sum(circle.area() for circle in circles)
        avg_radius = sum(circle.radius_km for circle in circles) / len(circles)
        
        # Calcular superposiciones
        total_overlap_area = 0
        for i, circle1 in enumerate(circles):
            for circle2 in circles[i+1:]:
                overlap = circle1.overlap_area_with(circle2)
                if overlap > 0:
                    logger.debug(f"Superposición entre círculo {i} y {i+1}: {overlap:.2f} km²")
                total_overlap_area += overlap
        
        # Contar waypoints únicos cubiertos
        covered_waypoints = set()
        for circle in circles:
            for wp in circle.waypoints_covered:
                covered_waypoints.add((wp.lat, wp.lon))
        
        waypoints_covered_count = len(covered_waypoints)
        
        # Calcular eficiencia
        if total_coverage_area > 0:
            efficiency_ratio = (total_coverage_area - total_overlap_area) / total_coverage_area
        else:
            efficiency_ratio = 0
        
        # Generar recomendaciones
        recommendations = self._generate_recommendations(
            circles, original_waypoints, efficiency_ratio, total_overlap_area
        )
        
        logger.info(f"Área total: {total_coverage_area:.2f} km², Superposición: {total_overlap_area:.2f} km², Eficiencia: {efficiency_ratio:.2%}")
        return OptimizationResult(
            optimized_circles=circles,
            total_coverage_area=total_coverage_area,
            total_overlap_area=total_overlap_area,
            efficiency_ratio=efficiency_ratio,
            waypoints_covered=waypoints_covered_count,
            avg_radius=avg_radius,
            recommendations=recommendations
        )
    
    def _generate_recommendations(self, circles: List[CoverageCircle], 
                                original_waypoints: List[Waypoint],
                                efficiency_ratio: float, 
                                total_overlap: float) -> List[str]:
        """Genera recomendaciones basadas en el análisis de optimización."""
        recommendations = []
        
        if efficiency_ratio < 0.7:
            recommendations.append("Eficiencia baja detectada. Considere reducir radios o redistribuir waypoints.")
        
        if total_overlap > sum(c.area() for c in circles) * 0.2:
            recommendations.append("Alta superposición detectada. Optimización adicional recomendada.")
        
        if len(circles) > len(original_waypoints) * 0.8:
            recommendations.append("Muchos círculos generados. Considere agrupar waypoints cercanos.")
        
        avg_radius = sum(c.radius_km for c in circles) / len(circles) if circles else 0
        if avg_radius > 15:
            recommendations.append("Radios promedio altos. Verifique dispersión de waypoints.")
        elif avg_radius < 5:
            recommendations.append("Radios promedio bajos. Potencial para mayor cobertura.")
        
        if not recommendations:
            recommendations.append("Optimización exitosa. Configuración eficiente lograda.")
        
        return recommendations


def calculate_optimal_radius_for_waypoints(waypoints: List[Dict[str, float]]) -> Dict[str, Any]:
    """
    Calculate the optimal radius that covers all waypoints efficiently.
    
    Args:
        waypoints: List of waypoint dictionaries with 'lat' and 'lon' keys
        
    Returns:
        Dictionary with optimization results including optimal radius and coverage analysis
    """
    logger.info(f"Calculando radio óptimo para {len(waypoints)} waypoints")
    
    if not waypoints or len(waypoints) < 2:
        logger.warning(f"Waypoints insuficientes ({len(waypoints)}), usando configuración por defecto")
        return {
            "optimal_radius_km": 10.0,  # Default radius
            "center_point": waypoints[0] if waypoints else {"lat": 0.0, "lon": 0.0},
            "coverage_efficiency": 1.0,
            "total_distance_km": 0.0,
            "waypoints_covered": len(waypoints),
            "analysis": {
                "method": "default",
                "reason": "Insufficient waypoints for optimization"
            }
        }
    
    # Calculate center point (geometric centroid)
    center_lat = sum(wp['lat'] for wp in waypoints) / len(waypoints)
    center_lon = sum(wp['lon'] for wp in waypoints) / len(waypoints)
    center_point = {"lat": center_lat, "lon": center_lon}
    logger.debug(f"Centroide calculado: ({center_lat:.6f}, {center_lon:.6f})")
    
    # Calculate distances from center to each waypoint
    distances = []
    for i, waypoint in enumerate(waypoints):
        distance = calculate_haversine_distance(
            center_lat, center_lon,
            waypoint['lat'], waypoint['lon']
        )
        distances.append(distance)
        logger.debug(f"Waypoint {i}: distancia al centro = {distance:.2f}km")
    
    # Find the maximum distance (this will be our minimum required radius)
    max_distance = max(distances)
    logger.debug(f"Distancia máxima al centro: {max_distance:.2f}km")
    
    # Calculate some statistics
    avg_distance = sum(distances) / len(distances)
    total_route_distance = calculate_total_route_distance(waypoints)
    logger.debug(f"Distancia promedio: {avg_distance:.2f}km, distancia total ruta: {total_route_distance:.2f}km")
    
    # Determine optimal radius based on distribution
    if len(waypoints) <= 3:
        # For short trips, use the maximum distance plus a small buffer
        optimal_radius = max_distance * 1.2
        method = "small_trip_buffer"
        logger.debug(f"Viaje corto detectado, aplicando buffer pequeño: {optimal_radius:.2f}km")
    elif max_distance / avg_distance > 2.0:
        # If there are outlier waypoints, use a more conservative approach
        # Use 90th percentile distance instead of maximum
        sorted_distances = sorted(distances)
        percentile_90_index = int(len(sorted_distances) * 0.9)
        optimal_radius = sorted_distances[percentile_90_index] * 1.3
        method = "outlier_resistant"
        logger.debug(f"Outliers detectados (ratio: {max_distance / avg_distance:.2f}), usando percentil 90: {optimal_radius:.2f}km")
    else:
        # For well-distributed waypoints, use maximum distance with moderate buffer
        optimal_radius = max_distance * 1.15
        method = "standard_buffer"
        logger.debug(f"Distribución normal, aplicando buffer estándar: {optimal_radius:.2f}km")
    
    # Ensure minimum practical radius
    original_radius = optimal_radius
    optimal_radius = max(optimal_radius, 2.0)  # At least 2km radius
    if original_radius != optimal_radius:
        logger.debug(f"Radio ajustado al mínimo: {original_radius:.2f} -> {optimal_radius:.2f}km")
    
    # Calculate coverage efficiency
    circle_area = math.pi * (optimal_radius ** 2)
    bounding_box_area = calculate_bounding_box_area(waypoints)
    coverage_efficiency = min(bounding_box_area / circle_area, 1.0) if circle_area > 0 else 0.0
    logger.debug(f"Área círculo: {circle_area:.2f}km², área bounding box: {bounding_box_area:.2f}km², eficiencia: {coverage_efficiency:.1%}")
    
    result = {
        "optimal_radius_km": round(optimal_radius, 2),
        "center_point": {
            "lat": round(center_lat, 6),
            "lon": round(center_lon, 6)
        },
        "coverage_efficiency": round(coverage_efficiency, 3),
        "total_distance_km": round(total_route_distance, 2),
        "max_waypoint_distance_km": round(max_distance, 2),
        "avg_waypoint_distance_km": round(avg_distance, 2),
        "waypoints_covered": len(waypoints),
        "analysis": {
            "method": method,
            "distance_distribution": {
                "min": round(min(distances), 2),
                "max": round(max(distances), 2),
                "avg": round(avg_distance, 2),
                "std_dev": round(calculate_std_deviation(distances), 2)
            },
            "optimization_notes": [
                f"Centro geométrico calculado en ({center_lat:.4f}, {center_lon:.4f})",
                f"Radio mínimo requerido: {max_distance:.2f} km",
                f"Buffer aplicado usando método: {method}",
                f"Eficiencia de cobertura: {coverage_efficiency:.1%}"
            ]
        }
    }
    
    logger.info(f"Cálculo completado: radio óptimo = {optimal_radius:.2f}km, eficiencia = {coverage_efficiency:.1%}")
    return result


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on the earth (specified in decimal degrees).
    Returns distance in kilometers.
    """
    logger.debug(f"Calculando distancia Haversine: ({lat1:.6f},{lon1:.6f}) -> ({lat2:.6f},{lon2:.6f})")
    
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    distance = c * r
    logger.debug(f"Distancia calculada: {distance:.3f}km")
    return distance


def calculate_total_route_distance(waypoints: List[Dict[str, float]]) -> float:
    """Calculate the total distance of the route connecting all waypoints in order."""
    logger.debug(f"Calculando distancia total de ruta para {len(waypoints)} waypoints")
    
    if len(waypoints) < 2:
        logger.debug("Menos de 2 waypoints, distancia total = 0")
        return 0.0
    
    total_distance = 0.0
    for i in range(len(waypoints) - 1):
        distance = calculate_haversine_distance(
            waypoints[i]['lat'], waypoints[i]['lon'],
            waypoints[i + 1]['lat'], waypoints[i + 1]['lon']
        )
        total_distance += distance
        logger.debug(f"Segmento {i}->{i+1}: {distance:.2f}km")
    
    logger.debug(f"Distancia total de ruta: {total_distance:.2f}km")
    return total_distance


def calculate_bounding_box_area(waypoints: List[Dict[str, float]]) -> float:
    """Calculate the area of the bounding box containing all waypoints."""
    logger.debug(f"Calculando área del bounding box para {len(waypoints)} waypoints")
    
    if not waypoints:
        logger.debug("No hay waypoints, área = 0")
        return 0.0
    
    min_lat = min(wp['lat'] for wp in waypoints)
    max_lat = max(wp['lat'] for wp in waypoints)
    min_lon = min(wp['lon'] for wp in waypoints)
    max_lon = max(wp['lon'] for wp in waypoints)
    
    logger.debug(f"Bounding box: lat[{min_lat:.6f}, {max_lat:.6f}], lon[{min_lon:.6f}, {max_lon:.6f}]")
    
    # Convert lat/lon differences to approximate kilometers
    lat_diff_km = (max_lat - min_lat) * 111.0  # Rough conversion: 1° lat ≈ 111 km
    
    # Longitude conversion depends on latitude
    avg_lat = (min_lat + max_lat) / 2
    lon_diff_km = (max_lon - min_lon) * 111.0 * math.cos(math.radians(avg_lat))
    
    area = lat_diff_km * lon_diff_km
    logger.debug(f"Dimensiones: {lat_diff_km:.2f}km x {lon_diff_km:.2f}km, área: {area:.2f}km²")
    return area


def calculate_std_deviation(values: List[float]) -> float:
    """Calculate standard deviation of a list of values."""
    logger.debug(f"Calculando desviación estándar para {len(values)} valores")
    
    if len(values) < 2:
        logger.debug("Menos de 2 valores, desviación estándar = 0")
        return 0.0
    
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
    std_dev = math.sqrt(variance)
    
    logger.debug(f"Media: {mean:.3f}, varianza: {variance:.3f}, desviación estándar: {std_dev:.3f}")
    return std_dev


def generate_optimized_grid_coverage(center_lat: float, center_lon: float, 
                                   radius_km: float, waypoints: List[Dict[str, float]]) -> List[Tuple[float, float]]:
    """
    Generate an optimized grid of points for geodata coverage that considers waypoint distribution.
    
    Args:
        center_lat: Center latitude for the grid
        center_lon: Center longitude for the grid  
        radius_km: Radius in kilometers for coverage
        waypoints: List of waypoints to optimize coverage for
        
    Returns:
        List of (lat, lon) tuples representing grid points
    """
    logger.info(f"Generando grilla optimizada: centro=({center_lat:.6f},{center_lon:.6f}), radio={radius_km}km, {len(waypoints)} waypoints")
    
    grid_points = []
    
    # Base grid density depends on radius
    if radius_km <= 5:
        grid_spacing_km = 1.0  # Dense grid for small areas
        logger.debug("Área pequeña detectada, usando grilla densa (1km)")
    elif radius_km <= 15:
        grid_spacing_km = 2.0  # Medium density
        logger.debug("Área mediana detectada, usando grilla media (2km)")
    else:
        grid_spacing_km = 3.0  # Sparse grid for large areas
        logger.debug("Área grande detectada, usando grilla dispersa (3km)")
    
    # Convert spacing to degrees (approximate)
    lat_spacing = grid_spacing_km / 111.0
    lon_spacing = grid_spacing_km / (111.0 * math.cos(math.radians(center_lat)))
    logger.debug(f"Espaciado en grados: lat={lat_spacing:.6f}, lon={lon_spacing:.6f}")
    
    # Calculate grid bounds
    lat_steps = int(radius_km / grid_spacing_km) + 1
    lon_steps = int(radius_km / grid_spacing_km) + 1
    logger.debug(f"Pasos de grilla: lat={lat_steps}, lon={lon_steps}")
    
    # Generate grid points within the radius
    points_generated = 0
    for i in range(-lat_steps, lat_steps + 1):
        for j in range(-lon_steps, lon_steps + 1):
            point_lat = center_lat + (i * lat_spacing)
            point_lon = center_lon + (j * lon_spacing)
            
            # Check if point is within radius
            distance = calculate_haversine_distance(center_lat, center_lon, point_lat, point_lon)
            if distance <= radius_km:
                grid_points.append((point_lat, point_lon))
                points_generated += 1
    
    logger.debug(f"Puntos base de grilla generados: {points_generated}")
    
    # Add waypoints themselves to ensure they're covered
    waypoints_added = 0
    critical_points_added = 0
    for waypoint in waypoints:
        # Check if waypoint is close to center and within radius
        distance = calculate_haversine_distance(center_lat, center_lon, waypoint['lat'], waypoint['lon'])
        if distance <= radius_km * 1.1:  # Small buffer
            # Add the exact waypoint location
            grid_points.append((waypoint['lat'], waypoint['lon']))
            waypoints_added += 1
            
            # Add points around critical waypoints for better coverage
            if distance <= radius_km * 0.8:  # Only for waypoints well within radius
                offset = 0.005  # Small offset in degrees (~0.5km)
                for lat_offset in [-offset, 0, offset]:
                    for lon_offset in [-offset, 0, offset]:
                        if lat_offset != 0 or lon_offset != 0:  # Skip center (already added)
                            nearby_point = (waypoint['lat'] + lat_offset, waypoint['lon'] + lon_offset)
                            grid_points.append(nearby_point)
                            critical_points_added += 1
    
    logger.debug(f"Waypoints agregados: {waypoints_added}, puntos críticos adicionales: {critical_points_added}")
    
    # Remove duplicates (with tolerance for floating point precision)
    unique_points = []
    tolerance = 0.001  # ~100m tolerance
    duplicates_removed = 0
    
    for point in grid_points:
        is_duplicate = False
        for existing_point in unique_points:
            if (abs(point[0] - existing_point[0]) < tolerance and 
                abs(point[1] - existing_point[1]) < tolerance):
                is_duplicate = True
                duplicates_removed += 1
                break
        
        if not is_duplicate:
            unique_points.append(point)
    
    logger.info(f"Grilla generada: {len(unique_points)} puntos únicos (duplicados removidos: {duplicates_removed})")
    return unique_points
