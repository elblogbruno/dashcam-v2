import cv2
import numpy as np
import time
import logging

logger = logging.getLogger(__name__)

class ImageOptimizer:
    """
    Utilidad para optimizar imágenes para streaming adaptativo.
    Ajusta dinámicamente la calidad y resolución según la carga del sistema.
    """
    
    def __init__(self):
        # Estadísticas de rendimiento
        self.processing_times = []
        self.last_optimization = time.time()
        self.optimization_level = 0  # 0: ninguno, 1: leve, 2: moderado, 3: fuerte
        
        # Configuración adicional para mejor rendimiento
        self.target_fps = 15  # FPS objetivo máximo
        self.last_frame_time = time.time()
        self.frame_count = 0
        self.fps_history = []
        
        # Límites y configuración
        self.max_processing_time = 0.03  # máximo 30ms por frame
        self.quality_levels = {
            0: 88,  # Calidad original
            1: 80,  # Optimización leve
            2: 70,  # Optimización moderada
            3: 60   # Optimización fuerte
        }
        self.resize_factors = {
            0: 1.0,  # Sin cambio
            1: 0.9,  # Reducción leve
            2: 0.8,  # Reducción moderada
            3: 0.7   # Reducción fuerte
        }
        
    def optimize_frame(self, frame, client_count=1, force_level=None):
        """
        Optimiza un frame según la carga del sistema y el número de clientes.
        
        Args:
            frame: El frame a optimizar (numpy array)
            client_count: Número de clientes activos
            force_level: Forzar un nivel específico de optimización
            
        Returns:
            Tuple (frame optimizado, calidad JPEG)
        """
        if frame is None:
            return None, 85
            
        start_time = time.time()
        
        # NUEVA CARACTERÍSTICA: Control de FPS adaptativo
        # Si estamos generando frames demasiado rápido, saltear algunos
        current_time = time.time()
        time_since_last = current_time - self.last_frame_time
        
        # Calcular FPS actual
        if time_since_last > 0:
            current_fps = 1.0 / time_since_last
            
            # Mantener historial de FPS
            self.fps_history.append(current_fps)
            if len(self.fps_history) > 10:
                self.fps_history = self.fps_history[-10:]
            
            # FPS promedio reciente
            avg_fps = sum(self.fps_history) / len(self.fps_history)
            
            # Si el FPS es demasiado alto, reducirlo (excepto cuando se fuerza un nivel)
            if force_level is None and avg_fps > self.target_fps * 1.2:
                # Incrementar nivel de optimización para reducir carga
                force_level = min(self.optimization_level + 1, 3)
            
        # Actualizar tiempo del último frame
        self.last_frame_time = current_time
        self.frame_count += 1
        
        # Determinar nivel de optimización
        if force_level is not None:
            level = min(max(force_level, 0), 3)
        else:
            level = self._determine_optimization_level(client_count)
        
        # Aplicar optimizaciones según nivel
        quality = self.quality_levels.get(level, 85)
        resize_factor = self.resize_factors.get(level, 1.0)
        
        # Si el nivel es 3 (muy alto), reducir aún más la resolución
        if level == 3 and client_count >= 2:
            resize_factor *= 0.8  # Reducción adicional del 20%
        
        # Aplicar resize si es necesario
        if resize_factor < 1.0 and frame is not None:
            try:
                h, w = frame.shape[:2]
                new_w = max(int(w * resize_factor), 320)  # Mínimo ancho 320px
                new_h = max(int(h * resize_factor), 240)  # Mínimo altura 240px
                frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
            except Exception as e:
                logger.error(f"Error durante el resize de imagen: {e}")
        
        # Actualizar estadísticas
        processing_time = time.time() - start_time
        self.processing_times.append(processing_time)
        if len(self.processing_times) > 100:
            self.processing_times = self.processing_times[-100:]
        
        # Actualizar estado para próximos frames
        self.optimization_level = level
        
        return frame, quality
    
    def _determine_optimization_level(self, client_count):
        """Determina el nivel de optimización según métricas actuales"""
        # Actualizar nivel solo cada 5 segundos para evitar fluctuaciones rápidas
        current_time = time.time()
        if current_time - self.last_optimization < 5.0:
            return self.optimization_level
            
        # Calcular tiempo de procesamiento promedio
        if self.processing_times:
            avg_time = sum(self.processing_times) / len(self.processing_times)
        else:
            avg_time = 0
            
        # Factores que influyen en el nivel de optimización
        level = 0
        
        # Por número de clientes
        if client_count > 4:
            level = 3  # Optimización máxima para muchos clientes
        elif client_count > 2:
            level = 2  # Optimización moderada
        elif client_count > 1:
            level = 1  # Optimización leve
        else:
            level = 0  # Sin optimización para un solo cliente
            
        # Por tiempo de procesamiento
        if avg_time > self.max_processing_time * 0.8:
            level += 1
            
        # Limitar nivel máximo
        level = min(level, 3)
        
        # Actualizar estado
        self.optimization_level = level
        self.last_optimization = current_time
        
        return level

# Instancia global para uso en toda la aplicación
optimizer = ImageOptimizer()
