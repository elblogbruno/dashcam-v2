import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigation } from '../contexts/NavigationContext';
import PerformanceStats from './PerformanceStats';

/**
 * Componente optimizado para reproducción de streams MJPEG con soporte
 * para estadísticas de rendimiento, gestión de visibilidad y optimización de latencia
 */
function MJPEGStreamPlayer({ streamUrl, width = '100%', height = '100%', className = '', onError, showStats = false, cameraType = '' }) {
  // Hook de navegación para gestión de recursos basada en rutas
  const { shouldStreamBeActive, currentRoute } = useNavigation();
  
  // Estados
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [resolution, setResolution] = useState('');
  const [frameSize, setFrameSize] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // Nuevo estado para pausar por navegación
  
  // Referencias
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef(null);
  const frameTimestampsRef = useRef([]);
  const latencyHistoryRef = useRef([]);
  const lastLoadTimeRef = useRef(null);
  const imageTimeoutsRef = useRef([]);
  const isMountedRef = useRef(true); // Referencia para controlar si el componente está montado
  const clientIdRef = useRef(null); // Referencia para almacenar el ID de cliente
  const heartbeatIntervalRef = useRef(null); // Referencia para el intervalo de heartbeat
  const initialLoadAttemptedRef = useRef(false); // Nueva referencia para rastrear el intento de carga inicial
  const reconnectCountRef = useRef(0); // Contador de intentos de reconexión
  const isLoadingRef = useRef(false); // Controlar si está en proceso de carga para evitar múltiples cargas simultáneas
  const visibilityObserverRef = useRef(null); // Referencia para el observer de visibilidad
  const lastHeartbeatTimeRef = useRef(0); // Registro de último heartbeat enviado
  const streamUrlRef = useRef(streamUrl); // Referencia para mantener URL estable
  const routeStreamPausedRef = useRef(false); // Nueva ref para rastrear pausa por ruta
  const reloadStreamWithoutDisconnectRef = useRef(null); // Ref para evitar dependencias circulares

  // Limpiar recursos pero mantener la misma conexión
  const cleanupResources = useCallback(() => {
    // Limpiar timeouts
    if (imageTimeoutsRef.current.length > 0) {
      imageTimeoutsRef.current.forEach(timeoutId => {
        if (typeof timeoutId === 'number') {
          clearTimeout(timeoutId);
        } else if (typeof timeoutId === 'function') {
          clearInterval(timeoutId);
        }
      });
      imageTimeoutsRef.current = [];
    }
    
    // Limpiar intervalo de FPS
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }
  }, []);

  // Calcular y actualizar estadísticas de latencia
  const updateLatencyStats = useCallback((newLatency) => {
    if (!isMountedRef.current || !isVisible) return;
    
    // Verificar que la latencia sea razonable
    if (newLatency > 5000) {
      newLatency = 1000; // Limitar valores extremos
    }
    
    // Mantener historial limitado de latencia
    latencyHistoryRef.current.push(newLatency);
    if (latencyHistoryRef.current.length > 10) {
      latencyHistoryRef.current.shift();
    }
    
    // Calcular promedio
    const sum = latencyHistoryRef.current.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / latencyHistoryRef.current.length);
    setAvgLatency(avg);
    setLatency(newLatency);
  }, [isVisible]);

  // Función para enviar heartbeat al servidor para mantener la conexión activa
  // Solo se enviará cuando el stream sea visible
  const sendHeartbeat = useCallback(async () => {
    // No enviar heartbeats si no estamos montados, no tenemos ID o el stream no está visible
    if (!isMountedRef.current || (!clientIdRef.current && !isConnected)) return;
    
    // NEW: Siempre enviar el estado de visibilidad actual
    try {
      // Verificar si ya se envió un heartbeat recientemente (evitar duplicados)
      const now = Date.now();
      if (now - lastHeartbeatTimeRef.current < 2000) { // Mínimo 2 segundos entre heartbeats
        return;
      }
      lastHeartbeatTimeRef.current = now;
      
      // Obtener la ruta base para las solicitudes API
      let apiBase;
      if (window.location.port === '5173') {
        // Desarrollo
        apiBase = `http://${window.location.hostname}:8000/api`;
      } else {
        // Producción
        apiBase = `/api`;
      }
      
      // Si no hay client_id pero estamos conectados, usar un ID temporal
      const clientId = clientIdRef.current || `${cameraType}_temp_${Date.now()}`;
      
      // MEJORAS: Enviar telemetría completa para optimizaciones del servidor
      const heartbeatData = {
        // Estado básico
        visible: isVisible,
        connected: isConnected,
        paused: isPaused,
        routeActive: shouldStreamBeActive,
        currentRoute: currentRoute,
        
        // Métricas de rendimiento
        connectionQuality: fps > 15 ? 'excellent' : (fps > 5 ? 'good' : (fps > 0 ? 'poor' : 'disconnected')),
        fps: fps,
        avgLatency: avgLatency,
        currentLatency: latency,
        
        // Información del dispositivo (para optimizaciones del servidor)
        deviceInfo: {
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
          cores: navigator.hardwareConcurrency || 4,
          connection: navigator?.connection?.effectiveType || 'unknown',
          memoryUsage: performance?.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
          } : null
        },
        
        // Solicitud de optimizaciones
        requestOptimizations: {
          reduceBandwidth: avgLatency > 1000 || fps < 10,
          increaseQuality: avgLatency < 200 && fps > 20,
          adaptiveMode: true
        },
        
        // Timestamp para medición de latencia del heartbeat
        clientTimestamp: Date.now()
      };
      
      const response = await fetch(`${apiBase}/mjpeg/heartbeat/${clientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(heartbeatData)
      });
      
      const data = await response.json();
      
      if (data.status === 'ok') {
        // Si el servidor nos devuelve un client_id, actualizar nuestra referencia
        if (data.client_id && data.client_id !== clientIdRef.current) {
          console.log(`[${cameraType}] Actualizando ID de cliente MJPEG: ${clientIdRef.current} -> ${data.client_id}`);
          clientIdRef.current = data.client_id;
        }
        
        // NUEVAS OPTIMIZACIONES: Procesar recomendaciones del servidor
        if (data.optimizations) {
          console.log(`[${cameraType}] Optimizaciones recibidas del servidor:`, data.optimizations);
          
          // Aplicar optimizaciones sugeridas por el servidor
          if (data.optimizations.suggestedFps && data.optimizations.suggestedFps !== fps) {
            console.log(`[${cameraType}] Servidor sugiere FPS: ${data.optimizations.suggestedFps}`);
          }
          
          if (data.optimizations.recommendReconnect && isConnected) {
            console.log(`[${cameraType}] Servidor recomienda reconexión para optimizar`);
            setTimeout(() => {
              if (reloadStreamWithoutDisconnectRef.current) {
                reloadStreamWithoutDisconnectRef.current();
              }
            }, 1000);
          }
          
          if (data.optimizations.suggestedQuality) {
            console.log(`[${cameraType}] Servidor sugiere calidad: ${data.optimizations.suggestedQuality}`);
          }
        }
        
        // Medir latencia del heartbeat para diagnosticos
        if (data.serverTimestamp && heartbeatData.clientTimestamp) {
          const heartbeatLatency = Date.now() - heartbeatData.clientTimestamp;
          if (heartbeatLatency > 2000) {
            console.warn(`[${cameraType}] Alta latencia en heartbeat: ${heartbeatLatency}ms`);
          }
        }
      }
    } catch (error) {
      // Solo logear el error pero no desconectar
      console.error(`Error enviando heartbeat para MJPEG ${cameraType}:`, error);
    }
  }, [cameraType, isConnected, isVisible, fps, isPaused, shouldStreamBeActive, currentRoute, avgLatency, latency]);

  // Enviar señal de desconexión explícita cuando el stream ya no está visible
  const sendDisconnect = useCallback(async () => {
    if (!clientIdRef.current) return;
    
    try {
      // Obtener la ruta base para las solicitudes API
      let apiBase;
      if (window.location.port === '5173') {
        apiBase = `http://${window.location.hostname}:8000/api`;
      } else {
        apiBase = `/api`;
      }
      
      // Enviar desconexión explícita
      await fetch(`${apiBase}/mjpeg/heartbeat/${clientIdRef.current}?disconnect=true`, {
        method: 'POST'
      });
      
      console.log(`Desconexión explícita enviada para ${cameraType} (ID: ${clientIdRef.current})`);
    } catch (e) {
      console.warn(`Error enviando desconexión para ${cameraType}:`, e);
    }
  }, [cameraType]);

  // Inicializar el detector de visibilidad usando IntersectionObserver
  const setupVisibilityObserver = useCallback(() => {
    if (!containerRef.current || visibilityObserverRef.current) return;
    
    const options = {
      root: null, // viewport
      rootMargin: '0px',
      threshold: 0.1 // 10% debe ser visible
    };
    
    visibilityObserverRef.current = new IntersectionObserver((entries) => {
      const isCurrentlyVisible = entries[0]?.isIntersecting;
      
      // Solo actualizar si hay un cambio real de estado
      if (isVisible !== isCurrentlyVisible) {
        console.log(`Cambio de visibilidad en ${cameraType}: ${isCurrentlyVisible}`);
        setIsVisible(isCurrentlyVisible);
        
        if (isCurrentlyVisible) {
          // Si vuelve a ser visible, restauramos la conexión
          if (imgRef.current && imgRef.current._savedSrc) {
            console.log(`Restaurando conexión para ${cameraType} después de ser visible nuevamente`);
            imgRef.current.src = imgRef.current._savedSrc;
            delete imgRef.current._savedSrc;
            
            // Reiniciar heartbeats
            if (!heartbeatIntervalRef.current) {
              sendHeartbeat(); // Heartbeat inmediato
              heartbeatIntervalRef.current = setInterval(sendHeartbeat, 10000); // Cada 10s
            }
          }
        } else {
          // Si ya no es visible, pausamos la conexión pero no enviamos desconexión
          if (imgRef.current && imgRef.current.src !== '' && !imgRef.current.src.includes('data:image')) {
            // Guardar la URL actual
            imgRef.current._savedSrc = imgRef.current.src;
            // Usar una imagen en blanco en lugar de about:blank
            imgRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            
            // Detener heartbeats, pero NO enviar desconexión
            if (heartbeatIntervalRef.current) {
              clearInterval(heartbeatIntervalRef.current);
              heartbeatIntervalRef.current = null;
            }
          }
        }
      }
    }, options);
    
    visibilityObserverRef.current.observe(containerRef.current);
  }, [cameraType, isVisible, sendHeartbeat]);

  // Detector de frames MJPEG (utiliza un enfoque simplificado para evitar problemas CORS)
  const startFrameDetection = useCallback(() => {
    if (!isMountedRef.current || !isVisible) return;
    
    console.log(`Iniciando detector de frames MJPEG para ${cameraType}`);
    
    // MODO SIMPLIFICADO DE DETECCIÓN DE FRAMES PARA EVITAR PROBLEMAS CORS
    // En lugar de usar canvas, que puede causar errores de seguridad,
    // utilizamos un enfoque simplificado basado en eventos onLoad
    let lastFrameTime = Date.now();
    let frameCounter = 0;
    
    // Configurar un intervalo para actualizar las estadísticas
    const frameDetectionInterval = setInterval(() => {
      if (!isMountedRef.current || !imgRef.current) return;
      
      try {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastFrameTime;
        
        // Solo actualizar si han pasado al menos 300ms (limitar actualizaciones)
        if (timeSinceLastUpdate >= 300 && frameCounter > 0) {
          // Calcular FPS basado en frames contados
          const calculatedFps = Math.round(frameCounter * 1000 / timeSinceLastUpdate);
          setFps(Math.max(calculatedFps, 1)); // Asegurar al menos 1 FPS
          
          // Reiniciar contadores
          lastFrameTime = now;
          frameCounter = 0;
        }
      } catch (e) {
        console.error(`Error en detector simplificado de frames para ${cameraType}:`, e);
      }
    }, 1000);
    
    // Función que será llamada cuando se cargue un nuevo frame
    const handleNewFrame = () => {
      if (!isMountedRef.current) return;
      
      const now = Date.now();
      frameCounter++;
      frameTimestampsRef.current.push(now);
      
      // Actualizar latencia aproximada
      if (lastLoadTimeRef.current) {
        const frameLatency = now - lastLoadTimeRef.current;
        if (frameLatency < 2000) { // Ignorar valores extremos
          updateLatencyStats(frameLatency);
        }
      }
      
      lastLoadTimeRef.current = now;
      
      // Limitar el historial de timestamps
      if (frameTimestampsRef.current.length > 100) {
        frameTimestampsRef.current = frameTimestampsRef.current.slice(-100);
      }
    };
    
    // Agregar un MutationObserver para detectar cambios en el src de la imagen
    // Este es un método alternativo para detectar cuando llegan nuevos frames
    const observerConfig = { attributes: true, attributeFilter: ['src'] };
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          // No llamar handleNewFrame aquí, ya que img.onload es más fiable
          // y evita contar frames que no se cargan correctamente
        }
      });
    });
    
    // Iniciar observación
    if (imgRef.current) {
      // Nos aseguramos de que cuando se carga un frame se registre
      const originalOnload = imgRef.current.onload;
      imgRef.current._frameDetectionOnload = (e) => {
        // Llamar al handler original primero
        if (originalOnload) originalOnload.call(imgRef.current, e);
        // Luego procesamos el nuevo frame
        handleNewFrame();
      };
      imgRef.current.onload = imgRef.current._frameDetectionOnload;
      
      // Observar cambios en el atributo src
      mutationObserver.observe(imgRef.current, observerConfig);
    }
    
    // Guardar referencia al intervalo y observador para limpieza
    imageTimeoutsRef.current.push(frameDetectionInterval);
    imageTimeoutsRef.current.push(mutationObserver);
    
  }, [cameraType, updateLatencyStats]);

  // Inicializar contador de FPS
  const initFpsCounter = useCallback(() => {
    if (!isMountedRef.current || !isVisible) return;
    
    // Limpiar intervalo existente
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }
    
    // Resetear contador
    frameCountRef.current = 0;
    frameTimestampsRef.current = [];
    
    // Asegurar que tenemos un FPS mínimo inicial
    if (fps === 0) {
      setFps(1);
    }
    
    // Crear nuevo intervalo
    fpsIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(fpsIntervalRef.current);
        fpsIntervalRef.current = null;
        return;
      }
      
      // Calcular FPS basado en frames recientes
      const oneSecondAgo = Date.now() - 1000;
      const recentFrames = frameTimestampsRef.current.filter(ts => ts > oneSecondAgo);
      
      // Si no hay frames recientes pero había frames antes, mantener FPS mínimo
      if (recentFrames.length === 0 && frameTimestampsRef.current.length > 0) {
        const lastFrameTime = Math.max(...frameTimestampsRef.current);
        const timeSinceLastFrame = Date.now() - lastFrameTime;
        
        // Si hace menos de 5 segundos que recibimos un frame, mantenemos el valor
        if (timeSinceLastFrame < 5000) {
          // No hacer nada, mantener el FPS actual
        } else {
          // Si hace más tiempo, puede haber un problema con el stream
          console.log(`Sin frames nuevos en >5s para ${cameraType}, revisando conexión...`);
          
          // No forzar inmediatamente a 0 para evitar parpadeos
          if (fps > 1) setFps(1); // Bajar a 1 para mostrar que seguimos intentándolo
          
          // Solo intentar reconectar en casos extremos 
          // (aumentado significativamente para evitar ciclos de reconexión)
          if (isConnected && timeSinceLastFrame > 60000) { // 60 segundos sin frames
            console.log(`No se reciben frames para ${cameraType} desde hace más de 60s, reconectando...`);
            if (reloadStreamWithoutDisconnectRef.current) {
              reloadStreamWithoutDisconnectRef.current();
            }
          }
        }
      } 
      // Si hay frames recientes, actualizar el contador de FPS
      else if (recentFrames.length > 0) {
        // Calcular una tasa de FPS precisa
        const calculatedFps = recentFrames.length;
        
        // Actualizar solo si hay un cambio significativo
        if (Math.abs(calculatedFps - fps) > 1) {
          setFps(calculatedFps);
        }
        
        // Conservar un historial limitado para no consumir memoria
        if (frameTimestampsRef.current.length > 30) { // 30 segundos máximo
          frameTimestampsRef.current = frameTimestampsRef.current.slice(-30);
        }
      }
      
      // Resetear contador simple para la siguiente ventana
      frameCountRef.current = 0;
    }, 1000);
  }, [cameraType, fps, isConnected]);

  // Nueva función: recargar stream sin desconectar completamente
  const reloadStreamWithoutDisconnect = useCallback(() => {
    if (!isMountedRef.current || isLoadingRef.current) return;
    
    console.log(`Refrescando conexión MJPEG para ${cameraType} sin desconectar...`);
    isLoadingRef.current = true;
    
    try {
      // Recargar la imagen sin desconexiones explícitas
      if (imgRef.current) {
        try {
          // Construir URL correctamente - Simplificado para reducir errores
          const url = new URL(streamUrl, window.location.origin);
          
          // Añadir parámetros necesarios sin duplicar
          url.searchParams.set('reload', Date.now().toString());
          url.searchParams.set('nocache', Math.random().toString());
          
          const newSrc = url.toString();
          
          // Recargar la misma imagen con nuevo timestamp
          setTimeout(() => {
            if (imgRef.current && isMountedRef.current) {
              console.log(`Refrescando imagen MJPEG para ${cameraType}`);
              imgRef.current.src = newSrc;
            }
            
            // Liberar el bloqueo después de un tiempo para permitir nuevos intentos si es necesario
            setTimeout(() => {
              isLoadingRef.current = false;
            }, 5000);
          }, 100);
        } catch (urlError) {
          // Método alternativo si URL API no está soportada
          console.warn(`Error con URL API para ${cameraType}, usando método alternativo:`, urlError);
          
          // Método alternativo si el constructor URL no está disponible
          const baseUrl = streamUrl.split('?')[0];
          const queryParams = streamUrl.includes('?') ? streamUrl.split('?')[1] : '';
          
          // Construir URL manualmente
          let newSrc = baseUrl;
          if (queryParams) {
            newSrc += `?${queryParams}&reload=${Date.now()}&nocache=${Math.random()}`;
          } else {
            newSrc += `?reload=${Date.now()}&nocache=${Math.random()}`;
          }
          
          setTimeout(() => {
            if (imgRef.current && isMountedRef.current) {
              console.log(`Refrescando imagen MJPEG para ${cameraType} (método alternativo)`);
              imgRef.current.src = newSrc;
            }
            
            // Liberar el bloqueo después de un tiempo
            setTimeout(() => {
              isLoadingRef.current = false;
            }, 5000);
          }, 100);
        }
      }
    } catch (e) {
      console.error(`Error refrescando stream MJPEG para ${cameraType}:`, e);
      isLoadingRef.current = false;
    }
  }, [cameraType, streamUrl]);

  // Asignar función a ref para evitar dependencias circulares
  useEffect(() => {
    reloadStreamWithoutDisconnectRef.current = reloadStreamWithoutDisconnect;
  }, [reloadStreamWithoutDisconnect]);

  // Recargar stream con desconexión explícita (solo para errores graves)
  const reloadStream = useCallback(() => {
    if (!isMountedRef.current || isLoadingRef.current) return;
    
    // Incrementar contador de reconexiones
    reconnectCountRef.current += 1;
    console.log(`Iniciando reconexión #${reconnectCountRef.current} para cámara ${cameraType}`);
    
    // Limitar máximo de reconexiones consecutivas
    if (reconnectCountRef.current > 3) {
      console.warn(`Demasiados intentos de reconexión (${reconnectCountRef.current}) para ${cameraType}, pausando...`);
      
      // Esperar un tiempo mayor antes del próximo intento
      setTimeout(() => {
        reconnectCountRef.current = 0; 
        if (isMountedRef.current) {
          console.log(`Reintentando conexión para ${cameraType} después de pausa`);
          if (reloadStreamWithoutDisconnectRef.current) {
            reloadStreamWithoutDisconnectRef.current(); // Usar método suave
          }
        }
      }, 20000); // 20 segundos
      return;
    }
    
    isLoadingRef.current = true;
    setErrorMessage('Reconectando...');
    
    // Enviar señal de desconexión solo si es necesario
    if (clientIdRef.current && isConnected) {
      try {
        let apiBase = window.location.port === '5173' 
          ? `http://${window.location.hostname}:8000/api` 
          : '/api';
        
        // Usar fetch pero ignorar el resultado para no esperar
        fetch(`${apiBase}/mjpeg/heartbeat/${clientIdRef.current}?disconnect=true`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000) // 3s timeout
        }).catch(e => console.warn("Error enviando desconexión, continuando de todos modos:", e));
      } catch (e) {
        console.error("Error en manejo de desconexión:", e);
      }
    }
    
    // Limpiar algunos recursos pero mantener la conexión
    cleanupResources();
    
    // Intentar regenerar la conexión
    setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        // Detener imagen actual y recargar con nueva URL
        if (imgRef.current) {
          try {
            // Usar URL API para manejo más robusto de URLs
            const url = new URL(streamUrl, window.location.origin);
            
            // Añadir parámetros necesarios
            url.searchParams.set('reconnect', 'true');
            url.searchParams.set('t', Date.now().toString());
            url.searchParams.set('nocache', Math.random().toString());
            
            const newSrc = url.toString();
            imgRef.current.src = newSrc;
            console.log(`Recargando src para ${cameraType}: ${imgRef.current.src}`);
          } catch (urlError) {
            // Método alternativo si URL API no está soportada
            console.warn(`Error con URL API para ${cameraType}, usando método alternativo:`, urlError);
            
            // Construir URL correctamente de forma manual
            const baseUrl = streamUrl.split('?')[0];
            const queryParams = streamUrl.includes('?') ? streamUrl.split('?')[1] : '';
            
            let newSrc = baseUrl;
            if (queryParams) {
              newSrc += `?${queryParams}&reconnect=true&t=${Date.now()}&nocache=${Math.random()}`;
            } else {
              newSrc += `?reconnect=true&t=${Date.now()}&nocache=${Math.random()}`;
            }
            
            imgRef.current.src = newSrc;
            console.log(`Recargando src para ${cameraType} (método alternativo): ${newSrc}`);
          }
          
          // Resetear clientId para que se extraiga de nuevo
          clientIdRef.current = null;
          
          // Volver a inicializar FPS después de recargar
          initFpsCounter();
        }
        
        if (!isConnected) {
          setFps(1); // FPS inicial mínimo
        }
        
        // Liberar el bloqueo después de un tiempo
        setTimeout(() => {
          isLoadingRef.current = false;
        }, 5000);
        
      } catch (e) {
        console.error(`Error durante reconexión de ${cameraType}:`, e);
        setIsConnected(false);
        setFps(0);
        isLoadingRef.current = false;
      }
    }, 300);
  }, [cleanupResources, cameraType, isConnected, streamUrl, initFpsCounter]);

  // Manejador de eventos para la carga de frames
  const handleImageLoad = useCallback((e) => {
    if (!isMountedRef.current || !isVisible) return;
    
    const loadTime = Date.now();
    const img = e.target;
    
    // Resetear contador de reconexiones
    reconnectCountRef.current = 0;
    isLoadingRef.current = false;
    
    // Marcar carga inicial como intentada
    initialLoadAttemptedRef.current = true;
    
    // Marcar como conectado si es la primera vez
    if (!isConnected) {
      console.log(`[${cameraType}] Conexión MJPEG establecida`);
      setIsConnected(true);
      setErrorMessage('');
      
      // Extraer posible ID de cliente de la respuesta
      try {
        // Intentar obtener un ID de cliente estable
        if (!clientIdRef.current) {
          const tempClientId = `${cameraType}_${Date.now()}`;
          console.log(`[${cameraType}] Generando ID de cliente estable: ${tempClientId}`);
          clientIdRef.current = tempClientId;
        }
      } catch (error) {
        console.warn(`[${cameraType}] Error al extraer ID de cliente:`, error);
      }
      
      // OPTIMIZACIÓN DE LATENCIA: Precargar siguiente frame para reducir latencia
      // Esta técnica reduce la latencia percibida al preparar el siguiente frame
      if (imgRef.current && !isPaused && shouldStreamBeActive) {
        try {
          // Crear una nueva imagen para precargar el siguiente frame
          const preloadImg = new Image();
          preloadImg.crossOrigin = 'anonymous';
          
          // Configurar URL para el siguiente frame con timestamp futuro
          const preloadUrl = new URL(imgRef.current.src, window.location.origin);
          preloadUrl.searchParams.set('preload', 'true');
          preloadUrl.searchParams.set('t', (Date.now() + 100).toString());
          preloadUrl.searchParams.set('latencyOptimized', 'true');
          
          preloadImg.onload = () => {
            console.log(`[${cameraType}] Preload frame cargado para reducir latencia`);
          };
          
          preloadImg.onerror = () => {
            // Ignorar errores de preload para no afectar el stream principal
          };
          
          // Iniciar preload después de un pequeño delay para no interferir
          setTimeout(() => {
            if (isMountedRef.current && shouldStreamBeActive) {
              preloadImg.src = preloadUrl.toString();
            }
          }, 50);
          
        } catch (preloadError) {
          console.warn(`[${cameraType}] Error en preload para optimización de latencia:`, preloadError);
        }
      }
      
      // Iniciar las métricas
      const requestTime = parseInt(img.dataset.requestTime || loadTime.toString());
      const currentLatency = loadTime - requestTime;
      updateLatencyStats(currentLatency);
      
      // Iniciar detector de frames para MJPEG
      startFrameDetection();
      
      // Establecer un FPS inicial mínimo
      setFps(1);
      
      // Iniciar envío de heartbeats
      if (!heartbeatIntervalRef.current) {
        sendHeartbeat(); // Heartbeat inmediato
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, 10000); // Cada 10s
      }
    }
    
    // Actualizar último tiempo de carga
    lastLoadTimeRef.current = loadTime;
    
    // Actualizar resolución si está disponible
    if (img.naturalWidth && img.naturalHeight) {
      setResolution(`${img.naturalWidth}x${img.naturalHeight}`);
      
      // Estimar tamaño del frame
      const approxSize = Math.round((img.naturalWidth * img.naturalHeight * 3) / 1024); // KB
      setFrameSize(`${approxSize}KB`);
    }
    
    // Incrementar contador de frames y guardar timestamp
    frameCountRef.current += 1;
    frameTimestampsRef.current.push(loadTime);
    
    // Actualizar FPS si es necesario
    if (fps === 0 && frameCountRef.current > 1) {
      setFps(Math.max(1, frameTimestampsRef.current.length));
    }
  }, [cameraType, isConnected, updateLatencyStats, startFrameDetection, fps, sendHeartbeat, isVisible]);
  
  // Manejador de errores de imagen 
  const handleImageError = useCallback((e) => {
    if (!isMountedRef.current || !isVisible || isLoadingRef.current) return;
    
    console.error(`Error cargando imagen MJPEG para ${cameraType}:`, e);
    
    // Si ya estaba conectado y ahora falla, no desconectar inmediatamente
    if (isConnected) {
      console.log(`Error detectado para ${cameraType}. Evaluando reconexión...`);
      
      // Intento suave sin reconexión inmediata
      const timeoutId = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        // Intentar reconexión suave primero
        if (reloadStreamWithoutDisconnectRef.current) {
          reloadStreamWithoutDisconnectRef.current();
        }
      }, 2000); // Darle algo de tiempo para recuperarse
      
      imageTimeoutsRef.current.push(timeoutId);
    } else {
      // Primera conexión fallida
      setErrorMessage('Error de conexión');
      setIsConnected(false);
      
      if (onError) {
        onError(e);
      }
      
      // Reintentos con intervalos progresivos
      if (!initialLoadAttemptedRef.current || reconnectCountRef.current === 0) {
        initialLoadAttemptedRef.current = true;
        
        const timeoutId = setTimeout(() => {
          if (!isMountedRef.current) return;
          reloadStream();
        }, 1000);  
        
        imageTimeoutsRef.current.push(timeoutId);
      } else {
        // Retrasos progresivos pero con límite máximo
        const delay = Math.min(3000 * (reconnectCountRef.current), 15000);
        
        const timeoutId = setTimeout(() => {
          if (!isMountedRef.current) return;
          reloadStream();
        }, delay);
        
        imageTimeoutsRef.current.push(timeoutId);
      }
    }
  }, [cameraType, onError, reloadStream, isConnected, isVisible]);

  // Función para alternar el estado de expansión
  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  // Registrar observador de visibilidad cuando el componente está montado
  useEffect(() => {
    setupVisibilityObserver();
    
    return () => {
      // Limpiar observador al desmontar
      if (visibilityObserverRef.current) {
        visibilityObserverRef.current.disconnect();
        visibilityObserverRef.current = null;
      }
    };
  }, [setupVisibilityObserver]);

  // Iniciar envío de heartbeats solo cuando esté visible y conectado
  useEffect(() => {
    if (isConnected && isVisible && !heartbeatIntervalRef.current) {
      console.log(`Iniciando heartbeats para ${cameraType} (visible: ${isVisible})`);
      
      // Enviar heartbeat inmediato
      sendHeartbeat();
      
      // Configurar intervalo
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, 10000);
      
      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      };
    } else if ((!isConnected || !isVisible) && heartbeatIntervalRef.current) {
      // Detener heartbeats si no está conectado o no está visible
      console.log(`Deteniendo heartbeats para ${cameraType} (conectado: ${isConnected}, visible: ${isVisible})`);
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      
      // Si estaba conectado pero ya no es visible, enviar señal de desconexión
      if (isConnected && !isVisible && clientIdRef.current) {
        sendDisconnect();
      }
    }
  }, [isConnected, isVisible, sendHeartbeat, cameraType, sendDisconnect]);
  
  // NUEVA FUNCIÓN: Gestión de recursos basada en rutas (pausar/reanudar streams)
  useEffect(() => {
    console.log(`[${cameraType}] Evaluando estado de stream. Ruta: ${currentRoute}, shouldStreamBeActive: ${shouldStreamBeActive}`);
    
    if (!shouldStreamBeActive && !routeStreamPausedRef.current) {
      // Pausar stream cuando salimos del dashboard
      console.log(`[${cameraType}] Pausando stream debido a navegación fuera del dashboard`);
      routeStreamPausedRef.current = true;
      setIsPaused(true);
      
      // Pausar imagen para ahorrar recursos, pero mantener conexión de heartbeat
      if (imgRef.current && imgRef.current.src && !imgRef.current.src.includes('data:image')) {
        imgRef.current._routePausedSrc = imgRef.current.src;
        imgRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }
      
      // Reducir frecuencia de heartbeats para ahorrar recursos
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000); // Cada 30s en lugar de 10s
      }
      
    } else if (shouldStreamBeActive && routeStreamPausedRef.current) {
      // Reanudar stream cuando regresamos al dashboard
      console.log(`[${cameraType}] Reanudando stream debido a navegación de regreso al dashboard`);
      routeStreamPausedRef.current = false;
      setIsPaused(false);
      
      // Restaurar imagen si fue pausada por ruta
      if (imgRef.current && imgRef.current._routePausedSrc) {
        // Añadir timestamp para forzar recarga
        const url = new URL(imgRef.current._routePausedSrc, window.location.origin);
        url.searchParams.set('resume', Date.now().toString());
        url.searchParams.set('nocache', Math.random().toString());
        
        imgRef.current.src = url.toString();
        delete imgRef.current._routePausedSrc;
        
        console.log(`[${cameraType}] Stream reanudado con nueva URL`);
      }
      
      // Restaurar frecuencia normal de heartbeats
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, 10000); // Volver a 10s
      }
    }
  }, [shouldStreamBeActive, currentRoute, cameraType, sendHeartbeat]);
  
  // Mantener una referencia estable de la URL del stream para evitar reconexiones innecesarias
  useEffect(() => {
    // Solo actualizar la referencia, no hacer nada más
    streamUrlRef.current = streamUrl;
  }, [streamUrl]);
  
  // Limpiar recursos al desmontar
  useEffect(() => {
    // Inicializar isMountedRef
    isMountedRef.current = true;
    
    // Guardar la URL actual para evitar cambios durante la vida del componente
    const currentStreamUrl = streamUrlRef.current;
    
    // Realizar una única conexión inicial después de montar el componente
    const connectTimeout = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      console.log(`Conexión inicial para ${cameraType}`);
      if (imgRef.current) {
        try {
          // MEJORAS DE LATENCIA: Añadir parámetros avanzados para optimización
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const isLowPerformance = isMobile || navigator.hardwareConcurrency <= 4;
          const connectionType = navigator?.connection?.effectiveType || 'unknown';
          const hasSlowConnection = ['slow-2g', '2g', '3g'].includes(connectionType);
          
          // Determinar configuración óptima basada en capacidades del dispositivo
          const optimizedParams = {
            // Parámetros básicos
            stable: true,
            init: Date.now(),
            nocache: Math.random().toString().substring(2, 8),
            
            // Información del dispositivo
            deviceType: isMobile ? 'mobile' : 'desktop',
            cores: navigator.hardwareConcurrency || 4,
            
            // Optimizaciones de calidad y latencia
            quality: hasSlowConnection || isLowPerformance ? 'low' : 'medium',
            fps: hasSlowConnection ? 15 : (isLowPerformance ? 20 : 30),
            compression: hasSlowConnection ? 'high' : (isLowPerformance ? 'medium' : 'low'),
            
            // Configuraciones específicas para reducir latencia
            bufferSize: isLowPerformance ? 'small' : 'medium',
            prioritizeLatency: !hasSlowConnection,
            adaptiveQuality: true,
            
            // Información de conectividad
            connection: connectionType,
            
            // Parámetros específicos del navegador
            userAgent: encodeURIComponent(navigator.userAgent.substring(0, 100)),
            
            // Solo pausar si estamos fuera del dashboard
            paused: !shouldStreamBeActive
          };
          
          // Construir string de parámetros optimizado
          const separator = currentStreamUrl.includes('?') ? '&' : '?';
          const paramString = Object.entries(optimizedParams)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
          
          const initialUrl = `${currentStreamUrl}${separator}${paramString}`;
          console.log(`[${cameraType}] URL optimizada para latencia:`, { 
            params: optimizedParams, 
            finalUrl: initialUrl.substring(0, 200) + '...' 
          });
          
          imgRef.current.src = initialUrl;
        } catch (e) {
          console.error(`Error estableciendo URL inicial para ${cameraType}:`, e);
        }
      }
    }, 100);
    
    imageTimeoutsRef.current.push(connectTimeout);
    
    return () => {
      console.log(`Desmontando componente MJPEG para ${cameraType}`);
      isMountedRef.current = false;
      
      // Enviar una señal de desconexión explícita al servidor antes de desmontar
      if (clientIdRef.current) {
        try {
          sendDisconnect();
        } catch (e) {
          console.warn(`Error al desconectar ${cameraType}:`, e);
        }
      }
      
      // Limpiar todos los recursos
      cleanupResources();
      
      // Detener la imagen con una imagen en blanco en lugar de about:blank
      if (imgRef.current) {
        try {
          // Limpiar los event handlers personalizados que pudimos haber agregado
          if (imgRef.current._frameDetectionOnload) {
            imgRef.current.onload = null;
          }
          
          // Usar una imagen transparente de 1x1 en formato base64
          imgRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        } catch (e) {
          console.warn(`Error al limpiar imagen para ${cameraType}:`, e);
        }
      }
    };
  }, [cameraType, cleanupResources, sendDisconnect]);

  // Renderizar el componente
  return (
    <div 
      ref={containerRef}
      className={`mjpeg-player relative ${className} ${isExpanded ? 'expanded-player' : ''}`}
      style={{
        width: isExpanded ? '90vw' : width,
        height: isExpanded ? '80vh' : height,
        backgroundColor: 'black',
        overflow: 'hidden',
        transition: 'all 0.3s ease-in-out',
        zIndex: isExpanded ? 50 : 'auto',
        position: isExpanded ? 'fixed' : 'relative',
        top: isExpanded ? '50%' : 'auto',
        left: isExpanded ? '50%' : 'auto',
        transform: isExpanded ? 'translate(-50%, -50%)' : 'none',
        borderRadius: isExpanded ? '8px' : '0',
        boxShadow: isExpanded ? '0 0 20px rgba(0,0,0,0.5)' : 'none',
        maxWidth: isExpanded ? '1600px' : 'none'
      }}
      data-camera-type={cameraType} // Atributo para identificar el tipo de cámara
    >
      <img
        ref={imgRef}
        // No establecemos src aquí para controlar una única conexión en useEffect
        alt={`Stream de cámara ${cameraType}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          opacity: isConnected ? 1 : 0.2,
          transition: 'opacity 0.3s ease',
          imageRendering: 'auto',
          backfaceVisibility: 'hidden',
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        data-request-time={Date.now().toString()}
        onDragStart={(e) => e.preventDefault()}
        loading="eager"
        decoding="async"
      />
      
      {/* Overlay de carga/error */}
      {!isConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 text-white text-center p-4 z-10">
          <div className="animate-spin h-8 w-8 border-4 border-t-transparent border-white rounded-full mx-auto mb-2"></div>
          <p className="text-sm">Conectando a cámara {cameraType === 'road' ? 'frontal' : cameraType === 'interior' ? 'interior' : cameraType}...</p>
          {errorMessage && <p className="text-red-400 text-xs mt-2">{errorMessage}</p>}
        </div>
      )}
      
      {/* NUEVO: Overlay para stream pausado por navegación */}
      {isPaused && isConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 text-white text-center p-4 z-20">
          <div className="mb-3">
            <svg className="w-12 h-12 mx-auto text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-medium">Stream pausado para ahorrar recursos</p>
          <p className="text-xs text-gray-300 mt-1">
            Regresa al dashboard para reanudar automáticamente
          </p>
          <p className="text-xs text-blue-300 mt-2">
            Ruta actual: {currentRoute}
          </p>
        </div>
      )}
      
      {/* Estadísticas de rendimiento */}
      {showStats && isConnected && (
        <PerformanceStats
          videoRef={imgRef}
          stats={{
            fps,
            latency,
            avgLatency,
            resolution,
            frameSize,
            visible: isVisible
          }}
          cameraType={cameraType}
        />
      )}
      
      
    </div>
  );
}

MJPEGStreamPlayer.propTypes = {
  streamUrl: PropTypes.string.isRequired,
  width: PropTypes.string,
  height: PropTypes.string,
  className: PropTypes.string,
  onError: PropTypes.func,
  showStats: PropTypes.bool,
  cameraType: PropTypes.string
};

export default MJPEGStreamPlayer;