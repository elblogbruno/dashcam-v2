#!/usr/bin/env python3
"""
Test script for the radius optimization system
"""

import sys
import os
import json
import asyncio
from typing import List, Dict, Any

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from landmarks.services.radius_optimizer import RadiusOptimizer, Waypoint
    from landmarks.services.landmark_optimization_service import LandmarkOptimizationService, OptimizationMetricsCollector
except ImportError as e:
    print(f"Error importing optimization services: {e}")
    sys.exit(1)

def create_test_trip():
    """Create a sample trip for testing"""
    # Trip from Madrid to Barcelona with some waypoints
    return {
        "id": "test-trip-001",
        "name": "Madrid a Barcelona - Prueba Optimización",
        "start_location": {"lat": 40.4168, "lon": -3.7038},  # Madrid
        "end_location": {"lat": 41.3851, "lon": 2.1734},     # Barcelona
        "waypoints": [
            {"lat": 40.9631, "lon": -2.7519, "name": "Guadalajara"},  # Guadalajara
            {"lat": 41.6561, "lon": -0.8773, "name": "Zaragoza"},     # Zaragoza
            {"lat": 41.6176, "lon": 0.6200, "name": "Lleida"}        # Lleida
        ]
    }

def convert_to_opt_waypoints(trip_data: Dict[str, Any]) -> List[Waypoint]:
    """Convert trip data to optimization waypoints"""
    waypoints = []
    
    # Add start location
    start = trip_data["start_location"]
    waypoints.append(Waypoint(lat=start["lat"], lon=start["lon"], name="Inicio"))
    
    # Add intermediate waypoints
    for wp in trip_data.get("waypoints", []):
        waypoints.append(Waypoint(lat=wp["lat"], lon=wp["lon"], name=wp.get("name", "Waypoint")))
    
    # Add end location
    end = trip_data["end_location"]
    waypoints.append(Waypoint(lat=end["lat"], lon=end["lon"], name="Destino"))
    
    return waypoints

async def test_radius_optimizer():
    """Test the RadiusOptimizer class"""
    print("🔧 PRUEBA DEL OPTIMIZADOR DE RADIO")
    print("=" * 50)
    
    try:
        # Create test trip
        trip_data = create_test_trip()
        waypoints = convert_to_opt_waypoints(trip_data)
        
        print(f"📍 Viaje de prueba: {trip_data['name']}")
        print(f"   Waypoints: {len(waypoints)}")
        for i, wp in enumerate(waypoints):
            print(f"   {i+1}. {wp.name}: ({wp.lat:.4f}, {wp.lon:.4f})")
        
        # Test different configurations
        test_configs = [
            {"min_radius_km": 5.0, "max_radius_km": 25.0, "overlap_tolerance": 0.15},
            {"min_radius_km": 8.0, "max_radius_km": 30.0, "overlap_tolerance": 0.20},
        ]
        
        for i, config in enumerate(test_configs):
            print(f"\n🧪 Configuración de prueba {i+1}: {config}")
            
            # Create optimizer with config
            optimizer = RadiusOptimizer(config)
            
            # Calculate optimized coverage
            optimization_result = optimizer.optimize_coverage(waypoints)
            
            print(f"   ✅ Optimización completada")
            print(f"   📊 Radio promedio: {optimization_result.avg_radius:.2f} km")
            print(f"   📐 Área total: {optimization_result.total_coverage_area:.2f} km²")
            print(f"   🔄 Área de solapamiento: {optimization_result.total_overlap_area:.2f} km²")
            print(f"   ⚡ Ratio de eficiencia: {optimization_result.efficiency_ratio:.2f}")
            print(f"   👥 Waypoints cubiertos: {optimization_result.waypoints_covered}/{len(waypoints)}")
            
            # Show individual circles
            print(f"   📍 Círculos de cobertura:")
            for j, circle in enumerate(optimization_result.optimized_circles):
                print(f"      {j+1}. Centro: ({circle.center.lat:.4f}, {circle.center.lon:.4f}) - Radio: {circle.radius_km:.2f} km")
                print(f"         Cubre {len(circle.waypoints_covered)} waypoints")
            
            # Show recommendations
            print(f"   💡 Recomendaciones:")
            for rec in optimization_result.recommendations:
                print(f"      - {rec}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en prueba del optimizador: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_landmark_optimization_service():
    """Test the LandmarkOptimizationService class"""
    print("\n🏢 PRUEBA DEL SERVICIO DE OPTIMIZACIÓN DE LANDMARKS")
    print("=" * 50)
    
    try:
        # Create test trip
        trip_data = create_test_trip()
        
        # Convert to the format expected by the service
        trip_waypoints = []
        # Add start location
        trip_waypoints.append({
            "lat": trip_data["start_location"]["lat"],
            "lon": trip_data["start_location"]["lon"],
            "name": "Madrid"
        })
        # Add intermediate waypoints
        for wp in trip_data.get("waypoints", []):
            trip_waypoints.append(wp)
        # Add end location
        trip_waypoints.append({
            "lat": trip_data["end_location"]["lat"],
            "lon": trip_data["end_location"]["lon"],
            "name": "Barcelona"
        })
        
        # Test landmark optimization service
        service = LandmarkOptimizationService()
        
        # Test different trip types
        trip_types = ['city', 'highway', 'mixed']
        
        for trip_type in trip_types:
            print(f"\n🚗 Probando tipo de viaje: {trip_type}")
            
            # Test optimization
            optimization_result = service.optimize_trip_landmarks(trip_waypoints, trip_type)
            
            if optimization_result.get('success', True):
                print(f"✅ Optimización de landmarks completada para tipo {trip_type}")
                
                if 'optimization_summary' in optimization_result:
                    summary = optimization_result['optimization_summary']
                    print(f"📊 Resumen:")
                    print(f"   - Regiones: {summary.get('regions_count', 'N/A')}")
                    print(f"   - Radio promedio: {summary.get('avg_radius_km', 'N/A'):.2f} km")
                    print(f"   - Área total: {summary.get('total_coverage_area_km2', 'N/A'):.2f} km²")
                    print(f"   - Eficiencia: {summary.get('efficiency_ratio', 'N/A'):.2f}")
                
                # Show download regions
                if 'download_regions' in optimization_result:
                    regions = optimization_result['download_regions']
                    print(f"📍 Regiones de descarga ({len(regions)}):")
                    for i, region in enumerate(regions[:3]):  # Show first 3
                        print(f"   {i+1}. {region.get('waypoint_name', 'Sin nombre')}: {region.get('radius_km', 0):.2f} km")
                        print(f"      POIs estimados: {region.get('estimated_pois', 0)}")
                        print(f"      Tamaño estimado: {region.get('estimated_size_mb', 0):.2f} MB")
                    if len(regions) > 3:
                        print(f"      ... y {len(regions) - 3} regiones más")
                
                # Test efficiency calculation if available
                if 'optimization_summary' in optimization_result:
                    try:
                        traditional_config = {"radius_km": 15.0, "waypoint_count": len(trip_waypoints)}
                        
                        # Create a mock object with the summary data
                        class MockResult:
                            def __init__(self, summary_dict):
                                for key, value in summary_dict.items():
                                    setattr(self, key, value)
                        
                        mock_result = MockResult(optimization_result['optimization_summary'])
                        efficiency_gain = service.calculate_download_efficiency_gain(traditional_config, mock_result)
                        
                        print(f"⚡ Ganancia de eficiencia:")
                        print(f"   - Ahorro de área: {efficiency_gain.get('area_reduction_percent', 0):.1f}%")
                        print(f"   - Ahorro de datos: {efficiency_gain.get('data_reduction_percent', 0):.1f}%")
                        print(f"   - Ahorro de tiempo: {efficiency_gain.get('time_reduction_percent', 0):.1f}%")
                    except Exception as e:
                        print(f"   ⚠️  No se pudo calcular ganancia de eficiencia: {str(e)}")
            
            else:
                print(f"❌ Error en optimización para tipo {trip_type}: {optimization_result.get('error', 'Error desconocido')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en prueba del servicio: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_metrics_collector():
    """Test the OptimizationMetricsCollector"""
    print("\n📈 PRUEBA DEL RECOLECTOR DE MÉTRICAS")
    print("=" * 50)
    
    try:
        collector = OptimizationMetricsCollector()
        
        # Create test optimization result
        trip_data = create_test_trip()
        waypoints = convert_to_opt_waypoints(trip_data)
        
        # Create mock optimization result
        from landmarks.services.radius_optimizer import OptimizationResult, CoverageCircle
        
        # Create some mock circles
        mock_circles = [
            CoverageCircle(waypoints[0], 10.0, [waypoints[0]]),
            CoverageCircle(waypoints[1], 12.0, [waypoints[1]]),
            CoverageCircle(waypoints[2], 8.0, [waypoints[2]])
        ]
        
        mock_result = OptimizationResult(
            optimized_circles=mock_circles,
            total_coverage_area=628.3,  # π * 10² + π * 12² + π * 8²
            total_overlap_area=50.2,
            efficiency_ratio=0.85,
            waypoints_covered=len(waypoints),
            avg_radius=10.0,
            recommendations=["Optimización exitosa"]
        )
        
        # Test recording optimization metrics
        trip_id = "test-trip-001"
        additional_data = {
            "trip_type": "mixed",
            "processing_time_seconds": 2.3,
            "algorithm_version": "1.0"
        }
        
        collector.record_optimization_metrics(mock_result, trip_id, additional_data)
        print(f"✅ Métrica registrada para viaje: {trip_id}")
        
        # Test getting performance analytics
        analytics = collector.get_performance_analytics()
        
        print(f"📊 Análisis de rendimiento:")
        print(f"   - Total de optimizaciones: {analytics.get('total_optimizations', 0)}")
        print(f"   - Eficiencia promedio: {analytics.get('avg_efficiency_ratio', 0):.2f}")
        print(f"   - Radio promedio: {analytics.get('avg_radius', 0):.2f} km")
        print(f"   - Tiempo promedio: {analytics.get('avg_processing_time', 0):.2f} seg")
        
        # Test with multiple records
        for i in range(3):
            additional_trip_id = f"test-trip-{i+2:03d}"
            mock_result.efficiency_ratio = 0.75 + (i * 0.05)  # Vary efficiency
            mock_result.avg_radius = 8.0 + (i * 2.0)  # Vary radius
            additional_data["processing_time_seconds"] = 1.5 + (i * 0.5)
            
            collector.record_optimization_metrics(mock_result, additional_trip_id, additional_data)
        
        print(f"✅ Registradas {3} métricas adicionales")
        
        # Get updated analytics
        updated_analytics = collector.get_performance_analytics()
        print(f"📈 Análisis actualizado:")
        print(f"   - Total de optimizaciones: {updated_analytics.get('total_optimizations', 0)}")
        print(f"   - Eficiencia promedio: {updated_analytics.get('avg_efficiency_ratio', 0):.2f}")
        print(f"   - Radio promedio: {updated_analytics.get('avg_radius', 0):.2f} km")
        print(f"   - Tiempo promedio: {updated_analytics.get('avg_processing_time', 0):.2f} seg")
        
        # Show recent optimizations if available
        if 'recent_optimizations' in updated_analytics:
            recent = updated_analytics['recent_optimizations']
            print(f"   - Optimizaciones recientes: {len(recent)}")
            for opt in recent[:2]:  # Show first 2
                print(f"     * {opt.get('trip_id', 'N/A')}: eficiencia {opt.get('efficiency_ratio', 0):.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en prueba de métricas: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    print("🚀 INICIANDO PRUEBAS DEL SISTEMA DE OPTIMIZACIÓN DE RADIO")
    print("=" * 60)
    
    tests = [
        ("Optimizador de Radio", test_radius_optimizer),
        ("Servicio de Optimización de Landmarks", test_landmark_optimization_service),
        ("Recolector de Métricas", test_metrics_collector)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 Ejecutando: {test_name}")
        success = await test_func()
        results.append((test_name, success))
        
        if success:
            print(f"✅ {test_name}: PASÓ")
        else:
            print(f"❌ {test_name}: FALLÓ")
    
    print(f"\n📋 RESUMEN DE PRUEBAS")
    print("=" * 30)
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASÓ" if success else "❌ FALLÓ"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 Resultado final: {passed}/{total} pruebas pasaron")
    
    if passed == total:
        print("🎉 ¡Todas las pruebas pasaron! El sistema de optimización está funcionando correctamente.")
    else:
        print("⚠️  Algunas pruebas fallaron. Revisa los errores arriba.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
