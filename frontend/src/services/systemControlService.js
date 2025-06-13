// Servicio para controlar funciones del sistema (apagado, reinicio, etc.)

class SystemControlService {
  constructor() {
    this.baseUrl = '/api/system';
  }

  // Realizar apagado ordenado del sistema
  async gracefulShutdown() {
    try {
      const response = await fetch(`${this.baseUrl}/shutdown/graceful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error en apagado ordenado:', error);
      throw error;
    }
  }

  // Forzar apagado inmediato del sistema
  async forceShutdown() {
    try {
      const response = await fetch(`${this.baseUrl}/shutdown/force`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error en apagado forzado:', error);
      throw error;
    }
  }

  // Reiniciar el sistema
  async rebootSystem() {
    try {
      const response = await fetch(`${this.baseUrl}/reboot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error en reinicio del sistema:', error);
      throw error;
    }
  }

  // Obtener estado del sistema de apagado
  async getShutdownStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/shutdown/status`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error obteniendo estado de apagado:', error);
      throw error;
    }
  }

  // Probar secuencia de apagado (sin apagar realmente)
  async testShutdownSequence() {
    try {
      const response = await fetch(`${this.baseUrl}/test/shutdown-sequence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error en prueba de secuencia:', error);
      throw error;
    }
  }
}

// Crear instancia singleton del servicio
const systemControlService = new SystemControlService();

export default systemControlService;
