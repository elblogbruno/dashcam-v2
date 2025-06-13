/**
 * WebSocket Manager - Gestión centralizada de conexiones WebSocket
 * Evita múltiples conexiones y proporciona una interfaz unificada
 */

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000;
    this.reconnectTimeout = null;
    this.isConnecting = false;
    this.connectionId = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.pingInterval = 15000; // Send ping every 15 seconds (más frecuente que servidor)
    this.pongTimeout = 10000; // Wait 10 seconds for pong (más tiempo para respuesta)
    
    // Bind methods to preserve context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
    this.send = this.send.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
  }

  /**
   * Conectar al WebSocket si no está ya conectado
   */
  connect() {
    // Si ya está conectado o conectando, no hacer nada
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('WebSocket ya está conectado o conectando');
      return Promise.resolve();
    }

    this.isConnecting = true;
    
    return new Promise((resolve, reject) => {
      try {
        // Limpiar timeout anterior si existe
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }

        // Crear nueva conexión
        const wsUrl = `ws://${window.location.hostname}:8000/ws`;
        console.log('Conectando a WebSocket:', wsUrl);
        
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          console.log('WebSocket conectado correctamente');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Iniciar heartbeat
          this.startHeartbeat();
          
          // Notificar a todos los listeners del cambio de estado
          this.notifyListeners('connected');
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            // Handle text messages
            if (typeof event.data === 'string') {
              // Handle heartbeat pong from server
              if (event.data === 'pong') {
                // Clear timeout - connection is alive
                if (this.heartbeatTimeout) {
                  clearTimeout(this.heartbeatTimeout);
                  this.heartbeatTimeout = null;
                }
                console.log('Recibido pong del servidor');
                return;
              }
              
              // Handle heartbeat ping from server
              if (event.data === 'ping') {
                // Responder con pong al servidor
                this.socket.send('pong');
                console.log('Recibido ping del servidor, enviando pong');
                return;
              }
              
              // Try to parse as JSON
              const data = JSON.parse(event.data);
              console.log('Mensaje WebSocket recibido:', data);
              
              // Notificar a todos los listeners del mensaje
              this.notifyListeners('message', data);
            }
            
          } catch (e) {
            console.error('Error al procesar mensaje WebSocket:', e);
          }
        };

        this.socket.onclose = (event) => {
          console.log(`WebSocket desconectado con código: ${event.code}, razón: ${event.reason}`);
          this.isConnecting = false;
          
          // Detener heartbeat
          this.stopHeartbeat();
          
          // Notificar a todos los listeners del cambio de estado
          this.notifyListeners('disconnected');
          
          // No intentar reconectar si el cierre fue limpio (código 1000)
          if (event.code === 1000) {
            console.log('Cierre limpio del WebSocket, no se intentará reconectar');
            return;
          }

          // Intentar reconectar con backoff exponencial
          this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
          console.error('Error en WebSocket:', error);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.notifyListeners('error', error);
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        console.error('Error creando WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Intentar reconectar con backoff exponencial
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Se alcanzó el máximo de intentos de reconexión (${this.maxReconnectAttempts})`);
      this.notifyListeners('maxReconnectAttemptsReached');
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    console.log(`Intentando reconexión ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} en ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        console.error('Error en reconexión:', error);
      });
    }, delay);
  }

  /**
   * Desconectar WebSocket
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Detener heartbeat
    this.stopHeartbeat();

    if (this.socket) {
      // Cerrar con código 1000 (normal closure) para evitar reconexión
      this.socket.close(1000, 'Disconnected by client');
      this.socket = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.connectionId = null;
  }

  /**
   * Agregar listener para eventos WebSocket
   * @param {string} id - ID único del listener
   * @param {function} callback - Función callback que recibe (eventType, data)
   */
  addListener(id, callback) {
    this.listeners.set(id, callback);
    console.log(`Listener agregado: ${id}. Total listeners: ${this.listeners.size}`);
  }

  /**
   * Remover listener
   * @param {string} id - ID del listener a remover
   */
  removeListener(id) {
    if (this.listeners.delete(id)) {
      console.log(`Listener removido: ${id}. Total listeners: ${this.listeners.size}`);
    }
  }

  /**
   * Notificar a todos los listeners de un evento
   * @param {string} eventType - Tipo de evento
   * @param {*} data - Datos del evento
   */
  notifyListeners(eventType, data) {
    this.listeners.forEach((callback, id) => {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error(`Error en listener ${id}:`, error);
      }
    });
  }

  /**
   * Enviar mensaje por WebSocket
   * @param {Object} message - Mensaje a enviar
   */
  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('No se puede enviar mensaje: WebSocket no está conectado');
      return false;
    }
  }

  /**
   * Obtener estado de la conexión
   */
  getConnectionState() {
    if (!this.socket) return 'disconnected';
    
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'disconnecting';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  /**
   * Verificar si está conectado
   */
  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Iniciar heartbeat para mantener la conexión activa
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Limpiar cualquier heartbeat previo
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        // Enviar ping
        console.log('Cliente enviando ping al servidor');
        this.socket.send('ping');
        
        // Establecer timeout para pong
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('No se recibió pong del servidor dentro del timeout, cerrando conexión');
          this.socket.close(1000, 'Heartbeat timeout');
        }, this.pongTimeout);
      }
    }, this.pingInterval);
    
    console.log(`Heartbeat iniciado: ping cada ${this.pingInterval/1000}s, timeout de pong: ${this.pongTimeout/1000}s`);
  }

  /**
   * Detener heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    
    console.log('Heartbeat detenido');
  }
}

// Crear instancia singleton
const webSocketManager = new WebSocketManager();

export default webSocketManager;
