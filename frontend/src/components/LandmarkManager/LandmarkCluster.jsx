import React, { useEffect, useRef } from 'react';
import { LayerGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './LandmarkCluster.css';

// Helper para facilitar el debug con timestamps
const logDebug = (message, data = null) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
  console.log(`[${timestamp}][LandmarkCluster] ${message}`, data || '');
};

// Implementación de clustering optimizada que conecta los marcadores de React-Leaflet
// con la biblioteca nativa de clustering de Leaflet
const LandmarkCluster = ({ children }) => {
  const map = useMap();
  const markerClusterRef = useRef(null);
  const markersRef = useRef([]);
  const childrenRef = useRef(children);
  
  logDebug('Inicializando componente LandmarkCluster');
  logDebug(`Recibido ${React.Children.count(children)} elementos hijos`);
  
  // Actualizar la referencia a los children cuando cambien
  useEffect(() => {
    const childCount = React.Children.count(children);
    logDebug(`children actualizados, ahora hay ${childCount} elementos`);
    childrenRef.current = children;
    
    // Si el cluster ya existe, actualizamos sus marcadores
    if (markerClusterRef.current) {
      logDebug(`Actualizando marcadores porque children cambiaron`);
      updateClusterMarkers();
    } else {
      logDebug(`No se actualizan marcadores porque el cluster aún no está inicializado`);
    }
  }, [children]);
  
  // Crear el grupo de clusters una sola vez
  useEffect(() => {
    logDebug('Inicializando Marker Cluster Group');
    
    try {
      // Verificar que leaflet.markercluster esté cargado correctamente
      if (!L.MarkerClusterGroup) {
        logDebug('ERROR: L.MarkerClusterGroup no está definido, la librería markercluster podría no estar cargada correctamente', L);
        return;
      }
      
      logDebug('L.MarkerClusterGroup está disponible:', !!L.MarkerClusterGroup);
      
      // Crear nuevo grupo de clusters con opciones optimizadas para todos los niveles de zoom
      markerClusterRef.current = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true, // Activar spiderfy en zoom máximo
        disableClusteringAtZoom: 16, // Desactivar clustering en zoom alto para ver puntos individuales
        maxClusterRadius: function(zoom) {
          // Ajustar el radio de clustering según el nivel de zoom
          // A menor zoom, mayor radio para agrupar más puntos
          if (zoom <= 5) return 120;      // Nivel continental
          else if (zoom <= 7) return 100; // Nivel país
          else if (zoom <= 9) return 80;  // Nivel regional
          else if (zoom <= 12) return 60; // Nivel ciudad
          else if (zoom <= 15) return 40; // Nivel barrio
          else return 30;                 // Nivel calle
        },
        animate: false, // Desactivar animaciones para mejor rendimiento
        spiderfyDistanceMultiplier: 1.5, // Menor distancia al expandir cluster
        showCoverageOnHover: false, // No mostrar área de cobertura al pasar el mouse
        zoomToBoundsOnClick: true, // Hacer zoom al hacer clic en un cluster
        removeOutsideVisibleBounds: true, // Eliminar marcadores fuera de vista
        singleMarkerMode: false, // No mostrar clusters para un solo marcador
        iconCreateFunction: function(cluster) {
          // Personalizar el icono del cluster según la cantidad de puntos
          const count = cluster.getChildCount();
          let className = 'marker-cluster ';
          
          if (count < 10) {
            className += 'marker-cluster-small';
          } else if (count < 50) {
            className += 'marker-cluster-medium';
          } else {
            className += 'marker-cluster-large';
          }
          
          return L.divIcon({ 
            html: `<div><span>${count}</span></div>`, 
            className: className,
            iconSize: L.point(40, 40)
          });
        }
      });
      
      logDebug('Grupo de clusters creado correctamente:', !!markerClusterRef.current);
      
      // Añadir al mapa
      map.addLayer(markerClusterRef.current);
      logDebug('Grupo de clusters añadido al mapa');
      
      // Hacer la primera carga de marcadores
      logDebug('Realizando primera carga de marcadores');
      updateClusterMarkers();
    } catch (error) {
      logDebug('ERROR al inicializar marker cluster:', error);
    }
    
    return () => {
      // Limpiar al desmontar
      if (markerClusterRef.current) {
        logDebug('Limpiando grupo de clusters al desmontar componente');
        map.removeLayer(markerClusterRef.current);
      }
    };
  }, [map]);
  
  // Función para actualizar los marcadores en el cluster 
  // con optimización para minimizar la creación/eliminación innecesaria
  const updateClusterMarkers = () => {
    logDebug('Iniciando actualización de marcadores en el cluster');
    
    if (!markerClusterRef.current) {
      logDebug('ADVERTENCIA: No hay cluster para actualizar');
      return;
    }
    
    // Para evitar parpadeo, usamos un enfoque más inteligente:
    // 1. Almacenar los marcadores actuales
    // 2. Crear nuevos marcadores
    // 3. Eliminar solo los marcadores que ya no existen
    // 4. Añadir solo los nuevos marcadores
    
    // Limpiar marcadores existentes, pero manejar este proceso de manera eficiente
    logDebug('Actualizando capas en el cluster');
    const oldMarkers = [...markersRef.current];
    markersRef.current = [];
    
    const childCount = React.Children.count(childrenRef.current);
    logDebug(`Procesando ${childCount} elementos hijos`);
    
    if (childCount === 0) {
      logDebug('ADVERTENCIA: No hay elementos hijos para procesar');
      // Si no hay hijos, simplemente limpiar todo
      markerClusterRef.current.clearLayers();
      return;
    } 
    // Extraer y procesar marcadores de los hijos
      React.Children.forEach(childrenRef.current, (child, index) => {
        if (!child) {
          logDebug(`ADVERTENCIA: Elemento hijo #${index} es null o undefined`);
          return;
        }
        
        // Ignorar elementos que son strings o números
        if (typeof child === 'string' || typeof child === 'number') {
          logDebug(`Ignorando elemento hijo #${index} por ser de tipo: ${typeof child}`);
          return;
        }
        
        // Ignorar elementos que son divs de texto (como el mensaje de "No hay landmarks")
        if (child.type === 'div' || (child.props && !child.props.position)) {
          logDebug(`Ignorando elemento hijo #${index} por ser un div o no tener posición`);
          return;
        }
        
        if (!child.props) {
          logDebug(`ADVERTENCIA: Elemento hijo #${index} no tiene props`, child);
          return;
        }
        
        if (!child.props.position) {
          logDebug(`ADVERTENCIA: Elemento hijo #${index} no tiene posición definida`, child.props);
          return;
        }
        
        try {
          logDebug(`Procesando hijo #${index} en posición [${child.props.position}]`);
          
          // Crear un marcador Leaflet nativo con las props del componente React
          const marker = L.marker(child.props.position, {
            icon: child.props.icon || new L.Icon.Default(),
            ...child.props
          });
          
          // Logging más detallado
          logDebug(`Marcador #${index} creado con éxito, tiene icono personalizado: ${!!child.props.icon}`);
          
          // Si hay evento onClick, añadirlo al marcador
          if (child.props.onClick) {
            logDebug(`Añadiendo handler onClick al marcador #${index}`);
            marker.on('click', (e) => {
              logDebug(`Marcador #${index} clickeado`);
              child.props.onClick(e);
            });
          }
          
          // Si hay landmark, loggearlo
          if (child.props.landmark) {
            logDebug(`Marcador #${index} representa landmark: ${child.props.landmark.id} - ${child.props.landmark.name}`);
          }
          
          // Si hay popup como hijo, añadirlo al marcador
          if (child.props.children) {
            logDebug(`Configurando popup para marcador #${index}`);
            const popup = document.createElement('div');
            popup.className = 'leaflet-popup-content-wrapper';
            popup.innerHTML = '<div class="leaflet-popup-content">Cargando...</div>';
            
            marker.bindPopup(popup);
            
            // Al abrir el popup, actualizamos su contenido
            marker.on('popupopen', (e) => {
              logDebug(`Popup abierto para marcador #${index}`);
              if (child.props.landmark) {
                popup.querySelector('.leaflet-popup-content').innerHTML = 
                  `<h3 class="text-lg font-bold mb-1">${child.props.landmark.name || 'Sin nombre'}</h3>
                   <p class="text-sm text-gray-600">${child.props.landmark.category || 'general'}</p>`;
              }
            });
          }
          
          markersRef.current.push(marker);
          logDebug(`Marcador #${index} añadido a la cola de marcadores, total: ${markersRef.current.length}`);
        } catch (error) {
          logDebug(`ERROR creando marcador #${index}:`, error);
        }
      });
      
      // Añadir todos los marcadores al cluster de una vez (más eficiente)
      if (markersRef.current.length > 0) {
        logDebug(`Añadiendo ${markersRef.current.length} marcadores al cluster de una vez`);
        try {
          // Usar addLayers para mejor rendimiento con muchos marcadores
          markerClusterRef.current.addLayers(markersRef.current);
          
          // Forzar un refresh del cluster para actualizar visualmente
          setTimeout(() => {
            markerClusterRef.current.refreshClusters();
            logDebug('Clusters refrescados');
          }, 200);
          
          logDebug('Marcadores añadidos con éxito al cluster');
        } catch (error) {
          logDebug('ERROR al añadir marcadores al cluster:', error);
        }
      } else {
        logDebug('ADVERTENCIA: No hay marcadores para añadir al cluster');
      } 
  };
  
  // No renderizamos nada en React, todo se maneja directamente con Leaflet
  logDebug(`Renderizando componente (sin elementos visuales, solo lógica)`);
  return null;
};

export default LandmarkCluster;
