"""
Integración del optimizador de radio con el sistema de landmarks DashCam V2.
Proporciona interfaces para integrar la optimización de radio en el flujo
de descarga de geodatos y landmarks existente.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict
import json

from .radius_optimizer import (
    RadiusOptimizer, Waypoint, OptimizationResult, CoverageCircle
)

logger = logging.getLogger(__name__)

class LandmarkOptimizationService:
    """Servicio de integración para optimización de landmarks y geodatos."""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.optimizer = RadiusOptimizer(self.config)
        
        # Configuración por defecto para diferentes tipos de viaje
        self.trip_type_configs = {
            'city': {
                'min_radius_km': 2.0,
                'max_radius_km': 15.0,
                'overlap_tolerance': 0.10,
                'density_threshold': 'high'
            },
            'highway': {
                'min_radius_km': 5.0,
                'max_radius_km': 25.0,
                'overlap_tolerance': 0.20,
                'density_threshold': 'low'
            },
            'mixed': {
                'min_radius_km': 3.0,
                'max_radius_km': 20.0,
                'overlap_tolerance': 0.15,
                'density_threshold': 'medium'
            }
        }
    
    def optimize_trip_landmarks(self, trip_waypoints: List[Dict[str, Any]], 
                               trip_type: str = 'mixed') -> Dict[str, Any]:
        """
        Optimiza la descarga de landmarks para un viaje específico.
        
        Args:
            trip_waypoints: Lista de waypoints del viaje con formato:
                [{'lat': float, 'lon': float, 'name': str}, ...]
            trip_type: Tipo de viaje ('city', 'highway', 'mixed')
            
        Returns:
            Dict con resultado de optimización y configuraciones recomendadas
        """
        logger.info(f"Optimizando landmarks para viaje tipo '{trip_type}' con {len(trip_waypoints)} waypoints")
        
        try:
            # Convertir waypoints a formato interno
            waypoints = [
                Waypoint(
                    lat=wp['lat'],
                    lon=wp['lon'],
                    name=wp.get('name', f"Waypoint_{i}")
                )
                for i, wp in enumerate(trip_waypoints)
            ]
            
            # Configurar optimizador según tipo de viaje
            trip_config = self.trip_type_configs.get(trip_type, self.trip_type_configs['mixed'])
            self.optimizer = RadiusOptimizer(trip_config)
            
            # Ejecutar optimización
            optimization_result = self.optimizer.optimize_coverage(waypoints)
            
            # Convertir resultado a formato serializable
            result = self._format_optimization_result(optimization_result, trip_type)
            
            logger.info(f"Optimización completada exitosamente para viaje {trip_type}")
            return result
            
        except Exception as e:
            logger.error(f"Error en optimización de landmarks: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'fallback_config': self._get_fallback_config(trip_type)
            }
    
    def get_optimized_download_regions(self, optimization_result: OptimizationResult) -> List[Dict[str, Any]]:
        """
        Convierte el resultado de optimización en regiones de descarga.
        Compatible con el sistema existente de descarga de landmarks.
        
        Returns:
            Lista de regiones con formato compatible con fetch_poi_landmarks_from_overpass
        """
        regions = []
        
        for i, circle in enumerate(optimization_result.optimized_circles):
            region = {
                'id': f"optimized_region_{i}",
                'center_lat': circle.center.lat,
                'center_lon': circle.center.lon,
                'radius_km': circle.radius_km,
                'waypoints_covered': len(circle.waypoints_covered),
                'estimated_area_km2': circle.area(),
                'waypoint_names': [wp.name for wp in circle.waypoints_covered if wp.name]
            }
            regions.append(region)
        
        return regions
    
    def calculate_download_efficiency_gain(self, original_config: Dict[str, Any], 
                                         optimized_result: OptimizationResult) -> Dict[str, Any]:
        """
        Calcula la mejora de eficiencia comparando configuración original vs optimizada.
        
        Args:
            original_config: Configuración original con radio fijo
            optimized_result: Resultado de la optimización
            
        Returns:
            Métricas de mejora y comparación
        """
        # Calcular métricas de configuración original
        original_radius = original_config.get('radius_km', 10.0)
        original_waypoints = original_config.get('waypoint_count', len(optimized_result.optimized_circles))
        
        # Área total con configuración original (asumiendo un círculo por waypoint)
        original_total_area = original_waypoints * (3.14159 * (original_radius ** 2))
        
        # Calcular mejoras
        area_reduction = max(0, original_total_area - optimized_result.total_coverage_area)
        area_reduction_percent = (area_reduction / original_total_area * 100) if original_total_area > 0 else 0
        
        # Estimación de reducción de datos
        data_reduction_estimate = area_reduction_percent * 0.8  # Aproximación conservadora
        
        efficiency_comparison = {
            'original_config': {
                'total_area_km2': original_total_area,
                'radius_km': original_radius,
                'regions_count': original_waypoints,
                'efficiency_estimated': 0.6  # Asumido para config fija
            },
            'optimized_config': {
                'total_area_km2': optimized_result.total_coverage_area,
                'avg_radius_km': optimized_result.avg_radius,
                'regions_count': len(optimized_result.optimized_circles),
                'efficiency_ratio': optimized_result.efficiency_ratio
            },
            'improvements': {
                'area_reduction_km2': area_reduction,
                'area_reduction_percent': area_reduction_percent,
                'estimated_data_reduction_percent': data_reduction_estimate,
                'efficiency_gain': max(0, optimized_result.efficiency_ratio - 0.6),
                'regions_optimization': original_waypoints - len(optimized_result.optimized_circles)
            }
        }
        
        return efficiency_comparison
    
    def generate_download_plan(self, optimization_result: OptimizationResult, 
                             priority_order: str = 'size_asc') -> List[Dict[str, Any]]:
        """
        Genera un plan de descarga ordenado para las regiones optimizadas.
        
        Args:
            optimization_result: Resultado de la optimización
            priority_order: Orden de prioridad ('size_asc', 'size_desc', 'coverage_desc')
            
        Returns:
            Plan de descarga ordenado con estimaciones
        """
        regions = self.get_optimized_download_regions(optimization_result)
        
        # Agregar estimaciones de descarga
        for region in regions:
            region.update(self._estimate_download_metrics(region))
        
        # Ordenar según prioridad
        if priority_order == 'size_asc':
            regions.sort(key=lambda x: x['estimated_size_mb'])
        elif priority_order == 'size_desc':
            regions.sort(key=lambda x: x['estimated_size_mb'], reverse=True)
        elif priority_order == 'coverage_desc':
            regions.sort(key=lambda x: x['waypoints_covered'], reverse=True)
        
        # Agregar información de secuencia
        total_size = sum(r['estimated_size_mb'] for r in regions)
        cumulative_size = 0
        
        for i, region in enumerate(regions):
            cumulative_size += region['estimated_size_mb']
            region.update({
                'download_order': i + 1,
                'cumulative_size_mb': cumulative_size,
                'progress_percent': (cumulative_size / total_size * 100) if total_size > 0 else 0
            })
        
        return regions
    
    def _format_optimization_result(self, result: OptimizationResult, trip_type: str) -> Dict[str, Any]:
        """Convierte OptimizationResult a formato JSON serializable."""
        return {
            'success': True,
            'trip_type': trip_type,
            'optimization_summary': {
                'regions_count': len(result.optimized_circles),
                'total_coverage_area_km2': round(result.total_coverage_area, 2),
                'total_overlap_area_km2': round(result.total_overlap_area, 2),
                'efficiency_ratio': round(result.efficiency_ratio, 3),
                'waypoints_covered': result.waypoints_covered,
                'avg_radius_km': round(result.avg_radius, 2)
            },
            'download_regions': self.get_optimized_download_regions(result),
            'recommendations': result.recommendations,
            'download_plan': self.generate_download_plan(result),
            'timestamp': self._get_current_timestamp()
        }
    
    def _estimate_download_metrics(self, region: Dict[str, Any]) -> Dict[str, Any]:
        """Estima métricas de descarga para una región."""
        area_km2 = region['estimated_area_km2']
        
        # Estimaciones basadas en densidad típica de POIs/landmarks
        # Estas fórmulas pueden ajustarse basándose en datos históricos reales
        estimated_pois = area_km2 * 15  # ~15 POIs por km² en promedio
        estimated_size_mb = area_km2 * 0.8  # ~0.8 MB por km² incluyendo mapas offline
        estimated_download_time_sec = estimated_size_mb * 2  # ~2 segundos por MB
        
        return {
            'estimated_pois': int(estimated_pois),
            'estimated_size_mb': round(estimated_size_mb, 2),
            'estimated_download_time_sec': int(estimated_download_time_sec),
            'estimated_download_time_min': round(estimated_download_time_sec / 60, 1)
        }
    
    def _get_fallback_config(self, trip_type: str) -> Dict[str, Any]:
        """Proporciona configuración de respaldo en caso de error."""
        fallback_radii = {
            'city': 8.0,
            'highway': 15.0,
            'mixed': 12.0
        }
        
        return {
            'radius_km': fallback_radii.get(trip_type, 12.0),
            'message': f'Usando configuración de respaldo para viaje tipo {trip_type}',
            'optimization_enabled': False
        }
    
    def _get_current_timestamp(self) -> str:
        """Obtiene timestamp actual en formato ISO."""
        from datetime import datetime
        return datetime.now().isoformat()

class OptimizationMetricsCollector:
    """Recopila métricas de rendimiento de las optimizaciones para mejora continua."""
    
    def __init__(self):
        self.metrics_history = []
    
    def record_optimization_metrics(self, result: OptimizationResult, 
                                  execution_time_ms: float,
                                  trip_type: str) -> None:
        """Registra métricas de una optimización ejecutada."""
        metrics = {
            'timestamp': self._get_current_timestamp(),
            'trip_type': trip_type,
            'execution_time_ms': execution_time_ms,
            'regions_generated': len(result.optimized_circles),
            'efficiency_achieved': result.efficiency_ratio,
            'coverage_area_km2': result.total_coverage_area,
            'overlap_area_km2': result.total_overlap_area,
            'waypoints_processed': result.waypoints_covered
        }
        
        self.metrics_history.append(metrics)
        
        # Mantener solo las últimas 1000 métricas
        if len(self.metrics_history) > 1000:
            self.metrics_history = self.metrics_history[-1000:]
    
    def get_performance_analytics(self) -> Dict[str, Any]:
        """Proporciona análisis de rendimiento de las optimizaciones."""
        if not self.metrics_history:
            return {
                'total_optimizations': 0,
                'avg_efficiency_ratio': 0.0,
                'avg_execution_time': 0.0,
                'avg_radius': 0.0,
                'avg_processing_time': 0.0,
                'recent_optimizations': [],
                'message': 'Sin datos de métricas disponibles'
            }
        
        try:
            # Calcular promedios con validación de tipos más robusta
            valid_metrics = []
            
            for i, m in enumerate(self.metrics_history):
                try:
                    # Asegurar que m es un diccionario
                    if not isinstance(m, dict):
                        logger.warning(f"Skipping invalid metric at index {i}: not a dict")
                        continue
                    
                    # Validar y convertir execution_time_ms
                    exec_time = 0.0
                    exec_time_raw = m.get('execution_time_ms', 0)
                    if isinstance(exec_time_raw, (int, float)):
                        exec_time = float(exec_time_raw)
                    elif isinstance(exec_time_raw, str):
                        try:
                            exec_time = float(exec_time_raw)
                        except (ValueError, TypeError):
                            exec_time = 0.0
                    
                    # Validar y convertir efficiency_achieved
                    efficiency = 0.0
                    efficiency_raw = m.get('efficiency_achieved', 0.0)
                    if isinstance(efficiency_raw, (int, float)):
                        efficiency = float(efficiency_raw)
                    elif isinstance(efficiency_raw, str):
                        try:
                            efficiency = float(efficiency_raw)
                        except (ValueError, TypeError):
                            efficiency = 0.0
                    
                    # Validar regions_generated
                    regions = 0
                    regions_raw = m.get('regions_generated', 0)
                    if isinstance(regions_raw, (int, float)):
                        regions = int(regions_raw)
                    elif isinstance(regions_raw, str):
                        try:
                            regions = int(regions_raw)
                        except (ValueError, TypeError):
                            regions = 0
                    
                    # Validar trip_type
                    trip_type = str(m.get('trip_type', 'unknown'))
                    
                    # Crear métrica validada
                    valid_metric = {
                        'execution_time_ms': exec_time,
                        'efficiency_achieved': efficiency,
                        'trip_type': trip_type,
                        'regions_generated': regions,
                        'coverage_area_km2': float(m.get('coverage_area_km2', 0.0)),
                        'timestamp': str(m.get('timestamp', '')),
                        'waypoints_processed': int(m.get('waypoints_processed', 0))
                    }
                    
                    valid_metrics.append(valid_metric)
                    
                except Exception as metric_error:
                    logger.warning(f"Error processing metric at index {i}: {str(metric_error)}")
                    continue
            
            if not valid_metrics:
                return {
                    'total_optimizations': 0,
                    'avg_efficiency_ratio': 0.0,
                    'avg_execution_time': 0.0,
                    'message': 'Sin métricas válidas disponibles'
                }
            
            # Calcular promedios de forma segura
            total_metrics = len(valid_metrics)
            avg_efficiency = sum(m['efficiency_achieved'] for m in valid_metrics) / total_metrics
            avg_execution_time = sum(m['execution_time_ms'] for m in valid_metrics) / total_metrics
            avg_regions = sum(m['regions_generated'] for m in valid_metrics) / total_metrics
            
            # Análisis por tipo de viaje de forma segura
            trip_type_stats = {}
            for metrics in valid_metrics:
                try:
                    trip_type = str(metrics['trip_type'])  # Asegurar que es string
                    if trip_type not in trip_type_stats:
                        trip_type_stats[trip_type] = []
                    trip_type_stats[trip_type].append(metrics)
                except Exception as trip_error:
                    logger.warning(f"Error processing trip type: {str(trip_error)}")
                    continue
            
            # Construir analíticas de forma segura
            analytics = {
                'total_optimizations': total_metrics,
                'avg_efficiency_ratio': round(float(avg_efficiency), 3),
                'avg_execution_time': round(float(avg_execution_time) / 1000, 2),
                'avg_processing_time': round(float(avg_execution_time) / 1000, 2),
                'avg_radius': round(float(avg_regions), 1),
                'avg_execution_time_ms': round(float(avg_execution_time), 2),
                'trip_type_performance': {},
                'recent_optimizations': valid_metrics[-10:] if valid_metrics else []
            }
            
            # Estadísticas por tipo de viaje de forma segura
            for trip_type, stats in trip_type_stats.items():
                try:
                    if stats and isinstance(stats, list):
                        stats_count = len(stats)
                        avg_eff = sum(s['efficiency_achieved'] for s in stats) / stats_count
                        avg_reg = sum(s['regions_generated'] for s in stats) / stats_count
                        avg_time = sum(s['execution_time_ms'] for s in stats) / stats_count
                        
                        analytics['trip_type_performance'][str(trip_type)] = {
                            'count': stats_count,
                            'avg_efficiency': round(float(avg_eff), 3),
                            'avg_regions': round(float(avg_reg), 1),
                            'avg_execution_time_ms': round(float(avg_time), 2)
                        }
                except Exception as stats_error:
                    logger.warning(f"Error calculating stats for trip type {trip_type}: {str(stats_error)}")
                    continue
            
            return analytics
            
        except Exception as e:
            logger.error(f"Error calculating performance analytics: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'total_optimizations': len(self.metrics_history),
                'avg_efficiency_ratio': 0.0,
                'avg_execution_time': 0.0,
                'error': str(e),
                'message': 'Error procesando métricas'
            }
        
        return analytics
    
    def _get_current_timestamp(self) -> str:
        """Obtiene timestamp actual en formato ISO."""
        from datetime import datetime
        return datetime.now().isoformat()
