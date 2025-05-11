import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Componente para mostrar una cámara utilizando WebRTC
 * 
 * Este componente establece una conexión WebRTC con el servidor para recibir
 * streams de video de baja latencia desde las cámaras del dashcam.
 */
function WebRTCCamera({ cameraType, width = '100%', height = '100%', className = '', onError }) {
  const [connectionState, setConnectionState] = useState('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [videoReceived, setVideoReceived] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(16/9); // Valor predeterminado: 16:9
  const [orientation, setOrientation] = useState(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  
  // Referencias para los elementos y objetos WebRTC
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const webSocketRef = useRef(null);
  const videoCheckTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const blackFrameDetectionRef = useRef(null);
  
  // Función para crear una oferta SDP
  const createOffer = async (peerConnection) => {
    try {
      // Crear una oferta con las limitaciones adecuadas
      const offerOptions = {
        offerToReceiveAudio: false,
        offerToReceiveVideo: true,
        voiceActivityDetection: false
      };
      
      const offer = await peerConnection.createOffer(offerOptions);
      
      // Verificar si la oferta tiene secciones multimedia
      const mediaSections = offer.sdp.match(/m=([^\r\n]+)/g);
      
      if (!mediaSections || mediaSections.length === 0) {
        console.log("Creando oferta SDP con sección multimedia explícita");
        
        // Crear una oferta SDP básica con sección multimedia explícita
        const sessionPart = offer.sdp.match(/^(v=0\r\n(?:.*?)(?:t=0 0\r\n))/s);
        
        if (sessionPart) {
          const sdpLines = offer.sdp.split('\r\n');
          let hasBundle = false;
          let hasMsidSemantic = false;
          
          // Verificar si ya hay líneas de BUNDLE y msid-semantic
          for (const line of sdpLines) {
            if (line.startsWith('a=group:BUNDLE')) hasBundle = true;
            if (line.startsWith('a=msid-semantic:')) hasMsidSemantic = true;
          }
          
          // Construir una nueva oferta SDP con secciones de media explícitas
          let newSdp = sessionPart[0];
          
          // Añadir BUNDLE si no existe
          if (!hasBundle) newSdp += 'a=group:BUNDLE 0\r\n';
          
          // Añadir msid-semantic si no existe
          if (!hasMsidSemantic) newSdp += 'a=msid-semantic:WMS\r\n';
          
          // Añadir sección multimedia explícita
          newSdp += 'm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';
          newSdp += 'c=IN IP4 0.0.0.0\r\n';
          newSdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';
          newSdp += 'a=rtcp-mux\r\n';  // RTCP mux es obligatorio
          newSdp += 'a=ice-ufrag:' + Math.random().toString(36).substr(2, 8) + '\r\n';
          newSdp += 'a=ice-pwd:' + Math.random().toString(36).substr(2, 24) + '\r\n';
          newSdp += 'a=fingerprint:sha-256 ' + ('00:'.repeat(31) + '00') + '\r\n';
          newSdp += 'a=setup:actpass\r\n';
          newSdp += 'a=mid:0\r\n';
          newSdp += 'a=extmap:1 urn:ietf:params:rtp-hdrext:toffset\r\n';
          newSdp += 'a=recvonly\r\n';
          newSdp += 'a=rtpmap:96 H264/90000\r\n';
          newSdp += 'a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r\n';
          
          // Crear una nueva oferta con el SDP modificado
          const modifiedOffer = new RTCSessionDescription({
            type: 'offer',
            sdp: newSdp
          });
          
          console.log("Oferta SDP modificada con secciones multimedia explícitas");
          
          // Establecer descripción local
          await peerConnection.setLocalDescription(modifiedOffer);
          return modifiedOffer;
        }
      }
      
      // Si la oferta ya tiene secciones multimedia, usarla tal cual
      await peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      setErrorMessage(`Error creating WebRTC offer: ${error.message}`);
      if (onError) onError(error.message);
      return null;
    }
  };
  
  // Función para verificar si el video está realmente reproduciéndose
  const checkVideoStatus = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Si hay un stream y el video tiene dimensiones, consideramos que está funcionando
      if (video.srcObject && video.videoWidth > 0 && video.videoHeight > 0) {
        console.log(`Video stream active for ${cameraType} camera: ${video.videoWidth}x${video.videoHeight}`);
        setVideoReceived(true);
        
        // Actualizar el tiempo del último frame recibido
        lastFrameTimeRef.current = Date.now();
        
        return true;
      } else if (video.srcObject) {
        // Si tenemos un srcObject pero no dimensiones aún,
        // puede que el video esté cargando, intentemos forzar la reproducción
        video.play()
          .then(() => console.log(`Playback initiated for ${cameraType} camera`))
          .catch(e => console.error('Error forcing video playback:', e));
      }
    }
    
    // Verificar si ha pasado demasiado tiempo desde el último frame (5 segundos)
    if (lastFrameTimeRef.current && Date.now() - lastFrameTimeRef.current > 5000) {
      console.warn(`No frames received for ${cameraType} camera in 5 seconds`);
      // Restablecer el tiempo para no disparar múltiples advertencias
      lastFrameTimeRef.current = null;
      return false;
    }
    
    return false;
  };

  // Detección de fotogramas negros o congelados
  const setupBlackFrameDetection = () => {
    if (!videoRef.current || blackFrameDetectionRef.current) return;
    
    console.log(`Setting up black frame detection for ${cameraType} camera`);
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let lastImageData = null;
    let unchangedFrameCount = 0;
    
    blackFrameDetectionRef.current = setInterval(() => {
      if (video.paused || video.ended || !videoReceived) return;
      
      try {
        // Configurar el tamaño del canvas según las dimensiones del video
        const width = video.videoWidth;
        const height = video.videoHeight;
        
        if (width === 0 || height === 0) return;
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar el frame actual del video en el canvas
        ctx.drawImage(video, 0, 0, width, height);
        
        // Obtener los datos de imagen del canvas
        const imageData = ctx.getImageData(0, 0, width, height).data;
        
        // Calcular el brillo promedio (simplificado)
        let totalBrightness = 0;
        for (let i = 0; i < imageData.length; i += 16) {  // Muestrear cada 16 píxeles para rendimiento
          totalBrightness += (imageData[i] + imageData[i+1] + imageData[i+2]) / 3;
        }
        const avgBrightness = totalBrightness / (imageData.length / 16);
        
        // Detectar frames negros (brillo muy bajo)
        if (avgBrightness < 5) {  // Umbral de brillo para considerar un frame como negro
          console.warn(`Black frame detected on ${cameraType} camera`);
          unchangedFrameCount++;
        } 
        // Detectar frames congelados comparando con el frame anterior
        else if (lastImageData) {
          let diff = 0;
          for (let i = 0; i < imageData.length; i += 64) {  // Muestrear cada 64 píxeles para rendimiento
            diff += Math.abs(imageData[i] - lastImageData[i]);
          }
          
          // Si la diferencia es muy pequeña, consideramos que el frame está congelado
          if (diff < 100) {
            unchangedFrameCount++;
          } else {
            unchangedFrameCount = 0;
          }
        }
        
        // Si detectamos demasiados frames congelados o negros consecutivos, reiniciar la conexión
        if (unchangedFrameCount > 10) {
          console.warn(`Multiple frozen/black frames detected on ${cameraType} camera, reconnecting...`);
          unchangedFrameCount = 0;
          
          // Intentar reiniciar el video primero para evitar una reconexión completa
          if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
          }
          
          // Si la reconexión rápida no funciona, forzar una reconexión completa
          setTimeout(() => {
            if (!videoReceived) {
              setVideoReceived(false);
              cleanupConnections();
              setupWebRTC();
            }
          }, 1000);
        }
        
        // Almacenar los datos de imagen para comparar con el próximo frame
        lastImageData = imageData;
        
      } catch (e) {
        console.error('Error in black frame detection:', e);
      }
    }, 1000);  // Comprobar cada segundo
  };

  // Configuración de la conexión WebRTC
  const setupWebRTC = async () => {
    if (connectionState === 'connecting') {
      return;
    }
    
    setConnectionState('connecting');
    setErrorMessage('');
    
    // Incrementar el intento de reconexión para el backoff exponencial
    setReconnectAttempt(prev => prev + 1);
    
    // Limpiamos cualquier timer anterior
    if (videoCheckTimerRef.current) {
      clearInterval(videoCheckTimerRef.current);
      videoCheckTimerRef.current = null;
    }
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (blackFrameDetectionRef.current) {
      clearInterval(blackFrameDetectionRef.current);
      blackFrameDetectionRef.current = null;
    }
    
    try {
      // Cerrar cualquier conexión existente
      cleanupConnections();
      
      // Crear una nueva conexión WebRTC
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        // Añadir opciones más agresivas para mejorar la conexión
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle'
      });
      
      peerConnectionRef.current = peerConnection;
      
      // Manejar negociación ICE
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
          const message = JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          });
          webSocketRef.current.send(message);
        }
      };
      
      // Manejar cambios de estado de la conexión
      peerConnection.onconnectionstatechange = () => {
        console.log(`WebRTC connection state changed to: ${peerConnection.connectionState} for ${cameraType} camera`);
        setConnectionState(peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
          // Reiniciar el contador de intentos cuando la conexión es exitosa
          setReconnectAttempt(0);
          
          // Cuando la conexión se establece, iniciar un timer para verificar si realmente recibimos video
          videoCheckTimerRef.current = setInterval(() => {
            // Si no recibimos video después de 6 segundos, intentar reconectar
            if (!checkVideoStatus()) {
              console.log(`No video received after connection for ${cameraType} camera`);
              
              // Solo reconectar si no hemos recibido ningún frame
              if (!videoReceived && connectionState === 'connected') {
                console.log(`Reconnecting ${cameraType} camera due to no video data`);
                cleanupConnections();
                setupWebRTC();
              }
            } else {
              // Si estamos recibiendo video correctamente, configurar detección de frames negros
              if (videoReceived && !blackFrameDetectionRef.current) {
                setupBlackFrameDetection();
              }
            }
          }, 2000); // Verificar cada 2 segundos
        }
        
        if (peerConnection.connectionState === 'failed' || 
            peerConnection.connectionState === 'disconnected' ||
            peerConnection.connectionState === 'closed') {
          
          // Usar backoff exponencial para reintentos
          const delayMs = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempt - 1));
          console.log(`WebRTC connection ${peerConnection.connectionState}. Reconnecting in ${delayMs/1000}s (attempt ${reconnectAttempt})`);
          
          setVideoReceived(false);
          
          reconnectTimerRef.current = setTimeout(() => {
            setupWebRTC();
          }, delayMs);
        }
      };
      
      // Mejorar manejo de errores de conexión ICE
      peerConnection.onicecandidateerror = (event) => {
        console.error(`ICE candidate error for ${cameraType} camera:`, event);
      };
      
      // Evento cuando la conexión ICE cambia de estado
      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE connection state changed to: ${peerConnection.iceConnectionState} for ${cameraType} camera`);
        
        // Si el estado ICE indica un problema, pero la conexión general sigue activa,
        // puede que necesitemos forzar una reconexión
        if ((peerConnection.iceConnectionState === 'disconnected' || 
             peerConnection.iceConnectionState === 'failed') && 
            peerConnection.connectionState === 'connected') {
            
          console.log(`ICE connection issues detected for ${cameraType} camera while main connection still active`);
          
          // Si no hay video recibido, intentar reconectar
          if (!videoReceived) {
            console.log(`Forcing reconnection for ${cameraType} camera due to ICE issues`);
            cleanupConnections();
            setupWebRTC();
          }
        }
      };
      
      // Manejar tracks entrantes (video)
      peerConnection.ontrack = (event) => {
        console.log(`Track received for ${cameraType} camera`);
        if (videoRef.current && event.streams && event.streams[0]) {
          // Detener cualquier track anterior
          if (videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
          }
          
          videoRef.current.srcObject = event.streams[0];
          
          // Reiniciar tiempo de último frame
          lastFrameTimeRef.current = Date.now();
          
          // Verificar inmediatamente si el video está llegando
          videoRef.current.onloadedmetadata = () => {
            console.log(`Video metadata loaded for ${cameraType} camera`);
            videoRef.current.play().catch(e => console.error('Error playing video:', e));
            checkVideoStatus();
            setupBlackFrameDetection();
          };
          
          // También verificar después de un momento por si acaso
          setTimeout(checkVideoStatus, 1000);
        }
      };
      
      // Establecer conexión WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      let wsUrl;
      
      // Check if we're in development mode by looking at the port
      // Development mode: frontend on port 5173, backend on port 8000
      if (window.location.port === '5173') {
        // In development mode, connect directly to backend port
        wsUrl = `${wsProtocol}://${window.location.hostname}:8000/api/webrtc/${cameraType}`;
        console.log(`Development mode detected, connecting WebRTC to: ${wsUrl}`);
      } else {
        // In production mode, use the same host
        wsUrl = `${wsProtocol}://${window.location.host}/api/webrtc/${cameraType}`;
      }
      
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';  // Para mejorar rendimiento
      
      // Establecer un timeout para la conexión WebSocket
      const wsConnectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error(`WebSocket connection timeout for ${cameraType} camera`);
          ws.close(4000, "Connection timeout");
          setErrorMessage(`Connection timeout: Server not responding`);
          setConnectionState('disconnected');
          
          if (onError) onError('Connection timeout');
        }
      }, 10000); // 10 segundos de timeout
      
      webSocketRef.current = ws;
      
      // Manejar apertura de WebSocket
      ws.onopen = async () => {
        console.log(`WebSocket connected for ${cameraType} camera`);
        clearTimeout(wsConnectionTimeout); // Limpiar el timeout al conectar
        // Crear y enviar oferta SDP
        const offer = await createOffer(peerConnection);
        if (offer) {
          ws.send(JSON.stringify({
            type: offer.type,
            sdp: offer.sdp
          }));
        }
      };
      
      // Manejar errores de WebSocket
      ws.onerror = (error) => {
        console.error(`WebSocket error for ${cameraType} camera:`, error);
        setErrorMessage(`WebSocket error: Cannot connect to camera server`);
        setConnectionState('disconnected');
        setVideoReceived(false);
        
        if (onError) onError('Cannot connect to camera server');
      };
      
      // Manejar cierre de WebSocket
      ws.onclose = (event) => {
        console.log(`WebSocket closed for ${cameraType} camera with code ${event.code}: ${event.reason}`);
        setConnectionState('disconnected');
        setVideoReceived(false);
      };
      
      // Manejar mensajes entrantes de WebSocket
      ws.onmessage = async (event) => {
        try {
          // Comprobar si el mensaje es un string JSON o un arraybuffer
          let message;
          if (event.data instanceof ArrayBuffer) {
            // En el futuro, podríamos manejar datos binarios directamente
            console.log(`Received binary data for ${cameraType} camera: ${event.data.byteLength} bytes`);
            return;
          } else {
            message = JSON.parse(event.data);
          }
          
          if (message.type === 'answer') {
            // Corregir el SDP antes de crear la descripción de sesión
            let sdp = message.sdp;
            let sdpModified = false;
            
            // Verificar si hay secciones multimedia (m=) en el SDP
            const mediaSections = sdp.match(/m=([^\r\n]+)/g);
            
            if (!mediaSections || mediaSections.length === 0) {
              console.log("SDP inválido: No hay secciones multimedia (m=) definidas. Intentando reconstruir...");
              
              // Intento de reparación: crear una sección multimedia básica si no existe
              const sessionPart = sdp.match(/^(v=0\r\n(?:.*?)(?:t=0 0\r\n))/s);
              
              if (sessionPart) {
                const basicMediaSection = "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n" +
                  "c=IN IP4 0.0.0.0\r\n" +
                  "a=rtcp:9 IN IP4 0.0.0.0\r\n" +
                  "a=ice-ufrag:ICEUFRAG\r\n" +
                  "a=ice-pwd:ICEPWD\r\n" +
                  "a=mid:0\r\n" +
                  "a=rtpmap:96 H264/90000\r\n" +
                  "a=recvonly\r\n" +
                  "a=setup:active\r\n";
                
                // Agregar sección multimedia después de la parte de nivel de sesión
                sdp = sessionPart[0] + "a=group:BUNDLE 0\r\na=msid-semantic:WMS\r\n" + basicMediaSection;
                console.log("SDP reconstruido con una sección básica de video");
                sdpModified = true;
              } else {
                // Si no podemos encontrar una parte de nivel de sesión, crear un SDP completamente nuevo
                console.error("No se pudo encontrar la parte de nivel de sesión en el SDP. Usando fallback a HTTP");
                setErrorMessage('Error en SDP: Formato incorrecto');
                if (onError) onError('SDP format error: No media sections');
                return;
              }
            }
            
            // Ahora que tenemos un SDP con al menos una sección multimedia, continuamos con las correcciones
            
            // Re-verificar secciones multimedia después de las correcciones
            const updatedMediaSections = sdp.match(/m=([^\r\n]+)/g);
            if (!updatedMediaSections || updatedMediaSections.length === 0) {
              console.error("No se pudieron crear secciones multimedia en el SDP. Usando fallback a HTTP");
              setErrorMessage('Error en SDP: No se pudo reconstruir');
              if (onError) onError('SDP format error: Could not create media sections');
              return;
            }
            
            // Extraer todos los MIDs definidos en el SDP
            const midRegex = /a=mid:([^\r\n]+)/g;
            const midMatches = [...sdp.matchAll(midRegex)];
            const midsInSdp = midMatches.map(match => match[1]);
            
            console.log(`MIDs encontrados en el SDP: ${midsInSdp.join(', ') || 'ninguno'}`);
            
            // Verificar si hay secciones multimedia sin mid
            const mediaWithoutMid = [];
            let lastMediaIndex = 0;
            
            for (let i = 0; i < updatedMediaSections.length; i++) {
              const mediaStart = sdp.indexOf(updatedMediaSections[i], lastMediaIndex);
              
              if (mediaStart !== -1) {
                lastMediaIndex = mediaStart + updatedMediaSections[i].length;
                
                // Determinar el final de esta sección
                const nextMediaStart = i < updatedMediaSections.length - 1 ? 
                  sdp.indexOf(updatedMediaSections[i+1], lastMediaIndex) : sdp.length;
                  
                const mediaSection = sdp.substring(mediaStart, nextMediaStart);
                
                // Verificar si esta sección no tiene mid
                if (!mediaSection.includes('a=mid:')) {
                  mediaWithoutMid.push({
                    index: i,
                    start: mediaStart,
                    end: nextMediaStart,
                    text: mediaSection
                  });
                }
              }
            }
            
            // Agregar mid a las secciones que no lo tienen
            if (mediaWithoutMid.length > 0) {
              console.log(`Encontradas ${mediaWithoutMid.length} secciones multimedia sin mid`);
              
              // Procesar desde la última sección a la primera
              for (let i = mediaWithoutMid.length - 1; i >= 0; i--) {
                const section = mediaWithoutMid[i];
                const newMid = `${section.index}`;
                
                // Agregar a=mid: después de la línea m=
                const updatedSection = section.text.replace(/^(m=[^\r\n]+\r\n)/, `$1a=mid:${newMid}\r\n`);
                
                // Reemplazar la sección
                sdp = sdp.substring(0, section.start) + updatedSection + sdp.substring(section.end);
                
                // Agregar este nuevo mid al array
                midsInSdp.push(newMid);
                
                console.log(`SDP corregido: Añadido a=mid:${newMid} a sección multimedia ${section.index + 1}`);
                sdpModified = true;
              }
            }
            
            // Verificar y corregir el grupo BUNDLE
            const bundleRegex = /a=group:BUNDLE\s+(.*)/;
            const bundleMatch = sdp.match(bundleRegex);
            
            if (bundleMatch) {
              const bundleMids = bundleMatch[1].trim().split(/\s+/);
              console.log(`MIDs en grupo BUNDLE: ${bundleMids.join(', ') || 'ninguno'}`);
              
              // Verificar si hay MIDs en BUNDLE que no existen en secciones multimedia
              const invalidMids = bundleMids.filter(mid => 
                mid !== '*' && 
                !mid.startsWith('a=') && 
                !midsInSdp.includes(mid)
              );
              
              if (invalidMids.length > 0) {
                console.warn(`MIDs inválidos en BUNDLE: ${invalidMids.join(', ')}`);
                
                // Filtrar solo MIDs válidos
                const validMids = bundleMids.filter(mid => 
                  mid !== '*' && 
                  !mid.startsWith('a=') && 
                  midsInSdp.includes(mid)
                );
                
                if (validMids.length > 0) {
                  // Usar solo MIDs válidos en BUNDLE
                  sdp = sdp.replace(bundleRegex, `a=group:BUNDLE ${validMids.join(' ')}`);
                  console.log(`SDP corregido: BUNDLE actualizado con MIDs válidos: ${validMids.join(', ')}`);
                  sdpModified = true;
                } else if (midsInSdp.length > 0) {
                  // Si no hay MIDs válidos pero tenemos MIDs en secciones, usar esos
                  sdp = sdp.replace(bundleRegex, `a=group:BUNDLE ${midsInSdp.join(' ')}`);
                  console.log(`SDP corregido: BUNDLE reconstruido con todos los MIDs: ${midsInSdp.join(' ')}`);
                  sdpModified = true;
                } else {
                  // Como último recurso, quitar la línea BUNDLE
                  sdp = sdp.replace(/a=group:BUNDLE[^\r\n]*\r\n/, '');
                  console.log(`SDP corregido: Línea BUNDLE eliminada por falta de MIDs válidos`);
                  sdpModified = true;
                }
              }
            } else if (midsInSdp.length > 0) {
              // Si hay MIDs pero no hay grupo BUNDLE, añadirlo
              sdp = sdp.replace(/v=0\r\n/, `v=0\r\na=group:BUNDLE ${midsInSdp.join(' ')}\r\n`);
              console.log(`SDP corregido: Añadido grupo BUNDLE con MIDs existentes`);
              sdpModified = true;
            }
            
            if (sdpModified) {
              console.log('SDP modificado para compatibilidad con WebRTC');
            }
            
            try {
              const answer = new RTCSessionDescription({
                type: message.type,
                sdp: sdp
              });
              
              await peerConnection.setRemoteDescription(answer);
              console.log(`Remote description set for ${cameraType} camera`);
            } catch (sdpError) {
              console.error(`Error estableciendo descripción remota: ${sdpError.message}`);
              
              // Intento final: eliminar todas las líneas BUNDLE y msid-semantic
              try {
                console.log('Intentando establecer SDP sin líneas BUNDLE y msid-semantic como último recurso');
                const fallbackSdp = sdp.replace(/a=group:BUNDLE[^\r\n]*\r\n/g, '')
                                     .replace(/a=msid-semantic[^\r\n]*\r\n/g, '');
                
                const fallbackAnswer = new RTCSessionDescription({
                  type: message.type,
                  sdp: fallbackSdp
                });
                
                await peerConnection.setRemoteDescription(fallbackAnswer);
                console.log(`Remote description set for ${cameraType} camera (sin BUNDLE/msid-semantic)`);
              } catch (fallbackError) {
                console.error(`Error final en SDP: ${fallbackError.message}`);
                setErrorMessage(`Error connecting to camera: ${fallbackError.message}`);
                
                // Notificar el error para que el componente padre pueda tomar acción
                if (onError) onError(fallbackError.message);
                
                // Intentar forzar una reconexión después de un retraso
                setTimeout(() => {
                  cleanupConnections();
                  setupWebRTC();
                }, 3000);
              }
            }
          } else if (message.type === 'ice-candidate') {
            if (!peerConnectionRef.current) {
              console.warn(`Received ICE candidate but no peer connection exists for ${cameraType} camera`);
              return;
            }
            
            try {
              const candidate = new RTCIceCandidate({
                candidate: message.candidate,
                sdpMid: message.sdpMid,
                sdpMLineIndex: message.sdpMLineIndex
              });
              
              await peerConnectionRef.current.addIceCandidate(candidate);
            } catch (error) {
              console.error(`Error adding ICE candidate for ${cameraType} camera:`, error);
              // No fallamos toda la conexión por un candidato ICE fallido
            }
          } else if (message.type === 'error') {
            console.error(`Server reported error for ${cameraType} camera:`, message.message);
            setErrorMessage(`Server error: ${message.message}`);
            if (onError) onError(message.message);
          }
        } catch (error) {
          console.error(`Error handling WebSocket message for ${cameraType} camera:`, error);
          setErrorMessage(`Error processing camera data: ${error.message}`);
          
          if (onError) onError(error.message);
        }
      };
      
    } catch (error) {
      console.error(`Error setting up WebRTC for ${cameraType} camera:`, error);
      setErrorMessage(`Error setting up camera connection: ${error.message}`);
      setConnectionState('disconnected');
      setVideoReceived(false);
      
      if (onError) onError(error.message);
      
      // Intentar reconectar con backoff exponencial
      const delayMs = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempt - 1));
      console.log(`Will try to reconnect ${cameraType} camera in ${delayMs/1000}s`);
      
      reconnectTimerRef.current = setTimeout(() => {
        setupWebRTC();
      }, delayMs);
    }
  };
  
  // Limpiar conexiones al desmontar el componente
  const cleanupConnections = () => {
    if (videoCheckTimerRef.current) {
      clearInterval(videoCheckTimerRef.current);
      videoCheckTimerRef.current = null;
    }
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (blackFrameDetectionRef.current) {
      clearInterval(blackFrameDetectionRef.current);
      blackFrameDetectionRef.current = null;
    }
    
    // Limpiar el stream de video
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.error(`Error stopping track for ${cameraType} camera:`, e);
        }
      });
      videoRef.current.srcObject = null;
    }
    
    // Cerrar conexión WebRTC
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {
        console.error(`Error closing peer connection for ${cameraType} camera:`, e);
      }
      peerConnectionRef.current = null;
    }
    
    // Cerrar WebSocket
    if (webSocketRef.current) {
      try {
        if (webSocketRef.current.readyState === WebSocket.OPEN || 
            webSocketRef.current.readyState === WebSocket.CONNECTING) {
          webSocketRef.current.close(1000, "Normal closure");
        }
      } catch (e) {
        console.error(`Error closing WebSocket for ${cameraType} camera:`, e);
      }
      webSocketRef.current = null;
    }
  };
  
  // Efecto para configurar la conexión WebRTC cuando el componente se monta
  useEffect(() => {
    // Iniciar con un retraso aleatorio para evitar que múltiples cámaras inicien simultáneamente
    const startupDelay = Math.random() * 500; // Retraso aleatorio de hasta 500ms
    const timeoutId = setTimeout(() => {
      setupWebRTC();
    }, startupDelay);
    
    // Función de limpieza al desmontar
    return () => {
      clearTimeout(timeoutId);
      cleanupConnections();
    };
  }, [cameraType]); // Reconectar si cambia el tipo de cámara
  
  // Detectar cambios en la orientación del dispositivo
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setOrientation(isLandscape ? 'landscape' : 'portrait');
    };
    
    window.addEventListener('resize', handleOrientationChange);
    return () => window.removeEventListener('resize', handleOrientationChange);
  }, []);
  
  // Ajustar tamaño y aspecto del video cuando cambia la orientación
  useEffect(() => {
    if (videoRef.current && videoRef.current.videoWidth && videoRef.current.videoHeight) {
      const videoAspect = videoRef.current.videoWidth / videoRef.current.videoHeight;
      setAspectRatio(videoAspect);
    }
  }, [orientation, videoReceived]);
  
  // Función para intentar reconexión manual
  const handleReconnect = () => {
    cleanupConnections();
    setupWebRTC();
  };
  
  // Renderizar el componente
  return (
    <div 
      className={`webrtc-camera relative ${className}`} 
      style={{ 
        width, 
        height,
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center', 
        alignItems: 'center'
      }}
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: orientation === 'portrait' ? 'contain' : 'cover',
          display: 'block' // Siempre mostrar el video, incluso si no hay señal
        }}
        onLoadedMetadata={(e) => {
          console.log(`Video metadata loaded for ${cameraType} camera: ${e.target.videoWidth}x${e.target.videoHeight}`);
          if (e.target.videoWidth && e.target.videoHeight) {
            setAspectRatio(e.target.videoWidth / e.target.videoHeight);
          }
          checkVideoStatus();
          videoRef.current.play().catch(e => console.error('Error playing video on metadata loaded:', e));
        }}
        onResize={(e) => {
          if (e.target.videoWidth && e.target.videoHeight) {
            setAspectRatio(e.target.videoWidth / e.target.videoHeight);
          }
        }}
        onPlaying={() => {
          console.log(`Video started playing for ${cameraType} camera`);
          setVideoReceived(true);
          lastFrameTimeRef.current = Date.now();
        }}
        onStalled={() => {
          console.warn(`Video stalled for ${cameraType} camera`);
        }}
        onError={(e) => {
          console.error(`Video error for ${cameraType} camera:`, e);
        }}
      />
      
      {/* Mostrar estado de conexión y errores */}
      {!videoReceived && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 text-white text-center p-4 z-10"
        >
          <div className="w-full max-w-sm">
            {connectionState === 'connecting' || connectionState === 'connected' ? (
              <>
                <div className="animate-spin h-8 w-8 border-4 border-t-transparent border-white rounded-full mx-auto mb-2"></div>
                <p className="text-sm sm:text-base">Conectando a cámara {cameraType}...</p>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-base sm:text-lg font-medium">Cámara desconectada</p>
                {errorMessage && <p className="text-red-400 text-xs sm:text-sm mt-2">{errorMessage}</p>}
                <button 
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm sm:text-base"
                  onClick={handleReconnect}
                  style={{ pointerEvents: 'auto' }}
                >
                  Reconectar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

WebRTCCamera.propTypes = {
  cameraType: PropTypes.oneOf(['road', 'interior']).isRequired,
  width: PropTypes.string,
  height: PropTypes.string,
  className: PropTypes.string,
  onError: PropTypes.func
};

export default WebRTCCamera;