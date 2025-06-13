/**
 * Este archivo implementa la funcionalidad de auto-reproducción al desplazarse por la línea de tiempo
 * al estilo de la aplicación Nest Doorbell
 */

// Clase auxiliar para manejar la auto-reproducción basada en la posición de desplazamiento
export class AutoplayTimelineManager {
  constructor() {
    this.timelineElement = null;
    this.videoEventElements = [];
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.currentPlayingElement = null;
    this.onClipSelectCallback = null;
  }

  // Inicializar el manager con los elementos DOM y la función de callback
  init(timelineSelector, videoEventSelector, onClipSelectCallback) {
    this.timelineElement = document.querySelector(timelineSelector);
    if (!this.timelineElement) {
      console.error('No se encontró el elemento de la línea de tiempo');
      return;
    }

    this.videoEventElements = this.timelineElement.querySelectorAll(videoEventSelector);
    this.onClipSelectCallback = onClipSelectCallback;

    this.setupIntersectionObserver();
    this.setupScrollListener();
  }

  // Configurar el observer para detectar cuándo un elemento está visible en el viewport
  setupIntersectionObserver() {
    const options = {
      root: this.timelineElement,
      rootMargin: '0px',
      threshold: 0.6, // El elemento es visible cuando está al menos 60% en el viewport
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isScrolling) {
          this.handleElementInView(entry.target);
        }
      });
    }, options);

    // Observar todos los elementos de video
    this.videoEventElements.forEach(element => {
      this.observer.observe(element);
    });
  }

  // Configurar el listener de scroll
  setupScrollListener() {
    if (!this.timelineElement) return;

    this.timelineElement.addEventListener('scroll', () => {
      this.isScrolling = true;
      
      // Limpiar el timeout existente
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      
      // Establecer un nuevo timeout
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
        this.checkVisibleElements();
      }, 150); // Esperar 150ms después de que el usuario dejó de desplazarse
    });
  }

  // Verificar qué elementos están visibles después del desplazamiento
  checkVisibleElements() {
    const entries = Array.from(this.videoEventElements).map(element => {
      const rect = element.getBoundingClientRect();
      const timelineRect = this.timelineElement.getBoundingClientRect();
      
      // Calcular la visibilidad relativa al contenedor de la línea de tiempo
      const isVisible = 
        rect.top >= timelineRect.top &&
        rect.bottom <= timelineRect.bottom;
      
      return {
        element,
        isVisible,
        visiblePercentage: this.calculateVisiblePercentage(element)
      };
    });

    // Ordenar por porcentaje de visibilidad y tomar el más visible
    const mostVisible = entries
      .filter(entry => entry.isVisible)
      .sort((a, b) => b.visiblePercentage - a.visiblePercentage)[0];

    if (mostVisible) {
      this.handleElementInView(mostVisible.element);
    }
  }

  // Calcular qué porcentaje del elemento está visible
  calculateVisiblePercentage(element) {
    const rect = element.getBoundingClientRect();
    const timelineRect = this.timelineElement.getBoundingClientRect();
    
    const visibleTop = Math.max(rect.top, timelineRect.top);
    const visibleBottom = Math.min(rect.bottom, timelineRect.bottom);
    const visibleHeight = visibleBottom - visibleTop;
    
    return (visibleHeight / rect.height) * 100;
  }

  // Manejar cuando un elemento está en vista
  handleElementInView(element) {
    if (this.currentPlayingElement === element) {
      return; // Ya estamos reproduciendo este elemento
    }

    // Obtener el índice del clip de los atributos de datos
    const clipIndex = element.dataset.clipIndex;
    if (clipIndex !== undefined) {
      this.currentPlayingElement = element;
      
      // Añadir clase visual para indicar el elemento activo
      this.videoEventElements.forEach(el => {
        el.classList.remove('nest-event-playing');
      });
      element.classList.add('nest-event-playing');

      // Llamar al callback para reproducir el clip
      if (this.onClipSelectCallback) {
        this.onClipSelectCallback(parseInt(clipIndex, 10));
      }
    }
  }

  // Destruir el manager y limpiar los listeners
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    if (this.timelineElement) {
      this.timelineElement.removeEventListener('scroll', this.scrollListener);
    }
    
    this.videoEventElements = [];
    this.currentPlayingElement = null;
  }
}

export default AutoplayTimelineManager;
