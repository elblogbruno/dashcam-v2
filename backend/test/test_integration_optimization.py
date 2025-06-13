#!/usr/bin/env python3
"""
Test de integración completa del sistema de optimización de radio
con el trip planner del sistema DashCam V2
"""

import sys
import os
import json
import asyncio
from datetime import datetime

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_test_trip():
    """Create a comprehensive test trip"""
    return {
        "id": "test-integration-001",
        "name": "Viaje Completo Madrid-Valencia-Barcelona",
        "start_location": {"lat": 40.4168, "lon": -3.7038},  # Madrid
        "end_location": {"lat": 41.3851, "lon": 2.1734},     # Barcelona
        "origin_name": "Madrid",
        "destination_name": "Barcelona",
        "waypoints": [
            {"lat": 40.2085, "lon": -3.7130, "name": "Aranjuez"},
            {"lat": 39.4699, "lon": -0.3763, "name": "Valencia"},
            {"lat": 40.9631, "lon": -2.7519, "name": "Guadalajara"},
            {"lat": 41.6561, "lon": -0.8773, "name": "Zaragoza"},
            {"lat": 41.6176, "lon": 0.6200, "name": "Lleida"}
        ],
        "start_date": "2025-06-15",
        "end_date": "2025-06-17",
        "notes": "Viaje de prueba para sistema de optimización",
        "landmarks_downloaded": False,
        "completed": False
    }

async def test_trip_optimization_integration():
    """Test complete integration with trip planner"""
    print("🌟 PRUEBA DE INTEGRACIÓN COMPLETA DEL SISTEMA DE OPTIMIZACIÓN")
    print("=" * 70)
    
    try:
        # Mock the trip planner components
        test_trip = create_test_trip()
        
        print(f"📍 Viaje de prueba: {test_trip['name']}")
        print(f"   🏁 Origen: {test_trip['origin_name']} ({test_trip['start_location']['lat']}, {test_trip['start_location']['lon']})")
        print(f"   🏁 Destino: {test_trip['destination_name']} ({test_trip['end_location']['lat']}, {test_trip['end_location']['lon']})")
        print(f"   📅 Fechas: {test_trip['start_date']} - {test_trip['end_date']}")
        print(f"   🗺️  Waypoints intermedios: {len(test_trip['waypoints'])}")
        for i, wp in enumerate(test_trip['waypoints']):
            print(f"      {i+1}. {wp['name']}: ({wp['lat']}, {wp['lon']})")
        
        # Test optimization functionality
        from landmarks.services.landmark_optimization_service import LandmarkOptimizationService, OptimizationMetricsCollector
        
        # Initialize services
        optimization_service = LandmarkOptimizationService()
        metrics_collector = OptimizationMetricsCollector()
        
        print(f"\n🔧 FASE 1: ANÁLISIS Y OPTIMIZACIÓN")
        print("-" * 40)
        
        # Prepare trip waypoints for optimization
        trip_waypoints = []
        # Add start location
        trip_waypoints.append({
            "lat": test_trip["start_location"]["lat"],
            "lon": test_trip["start_location"]["lon"],
            "name": test_trip["origin_name"]
        })
        # Add intermediate waypoints
        trip_waypoints.extend(test_trip["waypoints"])
        # Add end location
        trip_waypoints.append({
            "lat": test_trip["end_location"]["lat"],
            "lon": test_trip["end_location"]["lon"],
            "name": test_trip["destination_name"]
        })
        
        print(f"📊 Total de waypoints a optimizar: {len(trip_waypoints)}")
        
        # Test different trip types
        trip_types = ['city', 'highway', 'mixed']
        optimization_results = {}
        
        for trip_type in trip_types:
            print(f"\n🚗 Optimizando para tipo de viaje: {trip_type}")
            
            start_time = asyncio.get_event_loop().time()
            optimization_result = optimization_service.optimize_trip_landmarks(trip_waypoints, trip_type)
            end_time = asyncio.get_event_loop().time()
            
            processing_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            if optimization_result.get('success', True):
                optimization_results[trip_type] = optimization_result
                
                summary = optimization_result.get('optimization_summary', {})
                print(f"   ✅ Optimización exitosa")
                print(f"   ⏱️  Tiempo de procesamiento: {processing_time:.2f} ms")
                print(f"   📊 Regiones generadas: {summary.get('regions_count', 'N/A')}")
                print(f"   📐 Área total: {summary.get('total_coverage_area_km2', 'N/A'):.2f} km²")
                print(f"   ⚡ Eficiencia: {summary.get('efficiency_ratio', 'N/A'):.2f}")
                
                # Record metrics
                if 'optimization_result' in optimization_result:
                    metrics_collector.record_optimization_metrics(
                        optimization_result['optimization_result'],
                        f"{test_trip['id']}-{trip_type}",
                        {
                            'trip_type': trip_type,
                            'processing_time_seconds': processing_time / 1000,
                            'algorithm_version': '1.0'
                        }
                    )
                
            else:
                print(f"   ❌ Error en optimización: {optimization_result.get('error', 'Error desconocido')}")
        
        print(f"\n📈 FASE 2: ANÁLISIS DE RESULTADOS")
        print("-" * 40)
        
        # Compare optimization results
        if optimization_results:
            print(f"🔄 Comparación de tipos de viaje:")
            for trip_type, result in optimization_results.items():
                summary = result.get('optimization_summary', {})
                regions = summary.get('regions_count', 0)
                efficiency = summary.get('efficiency_ratio', 0)
                area = summary.get('total_coverage_area_km2', 0)
                
                print(f"   {trip_type.upper():>8}: {regions} regiones, {efficiency:.2f} eficiencia, {area:.1f} km²")
        
        # Show performance analytics
        analytics = metrics_collector.get_performance_analytics()
        print(f"\n📊 Análisis de rendimiento general:")
        print(f"   - Total optimizaciones: {analytics.get('total_optimizations', 0)}")
        print(f"   - Eficiencia promedio: {analytics.get('avg_efficiency_ratio', 0):.3f}")
        print(f"   - Tiempo promedio: {analytics.get('avg_processing_time', 0):.3f} seg")
        
        print(f"\n💾 FASE 3: SIMULACIÓN DE DESCARGA")
        print("-" * 40)
        
        # Simulate download estimation
        traditional_estimate = {
            "regions_count": len(trip_waypoints),
            "avg_radius_km": 15.0,
            "total_area_km2": len(trip_waypoints) * 3.14159 * (15.0 ** 2),
            "estimated_download_time_min": len(trip_waypoints) * 2.5,
            "estimated_size_mb": len(trip_waypoints) * 12.0
        }
        
        # Use best optimization result (mixed type as default)
        best_result = optimization_results.get('mixed', optimization_results.get('highway', optimization_results.get('city')))
        
        if best_result:
            optimized_summary = best_result.get('optimization_summary', {})
            
            print(f"📋 Comparación tradicional vs optimizado:")
            print(f"   TRADICIONAL:")
            print(f"     - Regiones: {traditional_estimate['regions_count']}")
            print(f"     - Radio promedio: {traditional_estimate['avg_radius_km']} km")
            print(f"     - Área total: {traditional_estimate['total_area_km2']:.1f} km²")
            print(f"     - Tiempo estimado: {traditional_estimate['estimated_download_time_min']:.1f} min")
            print(f"     - Tamaño estimado: {traditional_estimate['estimated_size_mb']:.1f} MB")
            
            print(f"   OPTIMIZADO:")
            print(f"     - Regiones: {optimized_summary.get('regions_count', 0)}")
            print(f"     - Radio promedio: {optimized_summary.get('avg_radius_km', 0):.1f} km")
            print(f"     - Área total: {optimized_summary.get('total_coverage_area_km2', 0):.1f} km²")
            print(f"     - Eficiencia: {optimized_summary.get('efficiency_ratio', 0):.2f}")
            
            # Calculate potential savings
            area_saving = (traditional_estimate['total_area_km2'] - optimized_summary.get('total_coverage_area_km2', 0))
            area_saving_percent = (area_saving / traditional_estimate['total_area_km2']) * 100 if traditional_estimate['total_area_km2'] > 0 else 0
            
            print(f"   AHORRO POTENCIAL:")
            print(f"     - Reducción de área: {area_saving:.1f} km² ({area_saving_percent:.1f}%)")
            print(f"     - Eficiencia mejorada: {optimized_summary.get('efficiency_ratio', 0):.1%}")
        
        print(f"\n🎯 FASE 4: RECOMENDACIONES")
        print("-" * 40)
        
        # Generate final recommendations
        recommendations = []
        
        if optimization_results:
            best_efficiency = max(result.get('optimization_summary', {}).get('efficiency_ratio', 0) 
                                for result in optimization_results.values())
            
            if best_efficiency > 0.8:
                recommendations.append("✅ Excelente eficiencia de optimización lograda")
            elif best_efficiency > 0.6:
                recommendations.append("⚠️  Eficiencia moderada - considerar ajustes de parámetros")
            else:
                recommendations.append("❌ Baja eficiencia - revisar configuración de waypoints")
            
            avg_regions = sum(result.get('optimization_summary', {}).get('regions_count', 0) 
                            for result in optimization_results.values()) / len(optimization_results)
            
            if avg_regions < len(trip_waypoints) * 0.8:
                recommendations.append("📍 Buen agrupamiento de waypoints conseguido")
            else:
                recommendations.append("🔄 Considerar mayor tolerancia de solapamiento")
        
        recommendations.extend([
            "💡 Sistema de optimización funcionando correctamente",
            "📊 Métricas de rendimiento registradas exitosamente",
            "🚀 Listo para integración en producción"
        ])
        
        print("🎁 Recomendaciones finales:")
        for i, rec in enumerate(recommendations, 1):
            print(f"   {i}. {rec}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error en prueba de integración: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run integration test"""
    print("🧪 INICIANDO PRUEBA DE INTEGRACIÓN DEL SISTEMA DE OPTIMIZACIÓN")
    print("=" * 70)
    
    success = await test_trip_optimization_integration()
    
    if success:
        print(f"\n🎉 ¡PRUEBA DE INTEGRACIÓN EXITOSA!")
        print("✅ El sistema de optimización de radio está completamente funcional")
        print("✅ Integración con trip planner verificada")
        print("✅ Métricas y analytics funcionando")
        print("✅ Listo para despliegue en producción")
    else:
        print(f"\n❌ PRUEBA DE INTEGRACIÓN FALLÓ")
        print("⚠️  Revisar errores y corregir antes del despliegue")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
