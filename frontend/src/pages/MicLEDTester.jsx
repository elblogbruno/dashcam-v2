import { useState, useEffect } from 'react'
import { FaCircle, FaPlay, FaStop, FaSyncAlt, FaLightbulb, FaPowerOff, FaSun } from 'react-icons/fa'
import axios from 'axios'

function MicLEDTester() {
  const [initialized, setInitialized] = useState(false)
  const [status, setStatus] = useState({
    initialized: false,
    animation_running: false,
    animation_type: null,
    leds_count: 3
  })
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [selectedLED, setSelectedLED] = useState('all') // 'all', '0', '1', '2'
  
  // Color picking
  const [customColor, setCustomColor] = useState({
    r: 255,
    g: 0,
    b: 0
  })
  
  // Preset colors
  const presetColors = [
    { name: 'red', color: '#FF0000', rgb: {r: 255, g: 0, b: 0} },
    { name: 'green', color: '#00FF00', rgb: {r: 0, g: 255, b: 0} },
    { name: 'blue', color: '#0000FF', rgb: {r: 0, g: 0, b: 255} },
    { name: 'yellow', color: '#FFFF00', rgb: {r: 255, g: 255, b: 0} },
    { name: 'white', color: '#FFFFFF', rgb: {r: 255, g: 255, b: 255} },
    { name: 'purple', color: '#800080', rgb: {r: 128, g: 0, b: 128} },
    { name: 'orange', color: '#FFA500', rgb: {r: 255, g: 165, b: 0} },
    { name: 'teal', color: '#008080', rgb: {r: 0, g: 128, b: 128} }
  ]
  
  // Animation settings
  const [brightness, setBrightness] = useState(31)
  const [animationSettings, setAnimationSettings] = useState({
    type: 'rotate',
    delay: 0.2,
    colors: [
      {r: 255, g: 0, b: 0},
      {r: 0, g: 255, b: 0},
      {r: 0, g: 0, b: 255}
    ]
  })
  
  // Initialize controller and fetch status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/mic-leds/status')
        setStatus(response.data)
        
        if (!response.data.initialized) {
          await initLEDs(brightness)
        } else {
          setInitialized(true)
        }
      } catch (error) {
        console.error('Error fetching LED status:', error)
        setMessage({
          type: 'error',
          text: 'Error al obtener estado de LEDs: ' + (error.response?.data?.detail || error.message)
        })
      }
    }
    
    fetchStatus()
    
    // Poll status every 3 seconds
    const interval = setInterval(fetchStatus, 3000)
    
    return () => {
      clearInterval(interval)
      // Cleanup LEDs when component unmounts
      axios.post('/api/mic-leds/cleanup', null).catch(console.error)
    }
  }, [])
  
  // Initialize LEDs
  const initLEDs = async (brightness = 31) => {
    setLoading(true)
    try {
      console.log('Initializing LEDs with brightness:', brightness)
      await axios.post('/api/mic-leds/init', null, { params: { brightness } })
      setInitialized(true)
      setMessage({
        type: 'success',
        text: 'LEDs inicializados correctamente'
      })
    } catch (error) {
      console.error('Error initializing LEDs:', error)
      setMessage({
        type: 'error',
        text: 'Error al inicializar LEDs: ' + (error.response?.data?.detail || error.message)
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Set custom color
  const setColor = async () => {
    if (!initialized) return
    
    setLoading(true)
    try {
      const { r, g, b } = customColor
      const params = { r, g, b }
      
      // Add led_index if not 'all'
      if (selectedLED !== 'all') {
        params.led_index = parseInt(selectedLED)
      }
      
      await axios.post('/api/mic-leds/color', null, { params })
      
      setMessage({
        type: 'success',
        text: `Color establecido para LED ${selectedLED}`
      })
    } catch (error) {
      console.error('Error setting color:', error)
      setMessage({
        type: 'error',
        text: 'Error al establecer color: ' + (error.response?.data?.detail || error.message)
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Set preset color
  const setPresetColor = async (colorName) => {
    if (!initialized) return
    
    setLoading(true)
    try {
      const params = { color_name: colorName }
      
      // Add led_index if not 'all'
      if (selectedLED !== 'all') {
        params.led_index = parseInt(selectedLED)
      }
      
      await axios.post('/api/mic-leds/preset', null, { params })
      
      setMessage({
        type: 'success',
        text: `Color ${colorName} establecido para LED ${selectedLED}`
      })
    } catch (error) {
      console.error('Error setting preset color:', error)
      setMessage({
        type: 'error',
        text: 'Error al establecer color: ' + (error.response?.data?.detail || error.message)
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Turn off LEDs
  const turnOffLEDs = async () => {
    if (!initialized) return
    
    setLoading(true)
    try {
      await axios.post('/api/mic-leds/off', null)
      
      setMessage({
        type: 'success',
        text: 'LEDs apagados'
      })
    } catch (error) {
      console.error('Error turning off LEDs:', error)
      setMessage({
        type: 'error',
        text: 'Error al apagar LEDs: ' + (error.response?.data?.detail || error.message)
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Start animation
  const startAnimation = async () => {
    if (!initialized) return
    
    setLoading(true)
    try {
      const { type, delay, colors } = animationSettings
      
      await axios.post('/api/mic-leds/animation', null, { 
        params: {
          animation_type: type,
          delay
        }
      })
      
      setMessage({
        type: 'success',
        text: `Animación ${type} iniciada`
      })
    } catch (error) {
      console.error('Error starting animation:', error)
      setMessage({
        type: 'error',
        text: 'Error al iniciar animación: ' + (error.response?.data?.detail || error.message)
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Stop animation
  const stopAnimation = async () => {
    if (!initialized) return
    
    setLoading(true)
    try {
      await axios.post('/api/mic-leds/stop', null)
      
      setMessage({
        type: 'success',
        text: 'Animación detenida'
      })
    } catch (error) {
      console.error('Error stopping animation:', error)
      setMessage({
        type: 'error',
        text: 'Error al detener animación: ' + (error.response?.data?.detail || error.message)
      })
    } finally {
      setLoading(false)
    }
  }
  
  // Handle animation type change
  const handleAnimationTypeChange = (e) => {
    setAnimationSettings(prev => ({
      ...prev,
      type: e.target.value
    }))
  }
  
  // Handle animation delay change
  const handleAnimationDelayChange = (e) => {
    setAnimationSettings(prev => ({
      ...prev,
      delay: parseFloat(e.target.value)
    }))
  }
  
  // Convert RGB object to hex color string
  const rgbToHex = (rgb) => {
    return '#' + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)
  }
  
  // Convert hex color string to RGB object
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }
  
  // Handle brightness slider change
  const handleBrightnessChange = async (e) => {
    const newBrightness = parseInt(e.target.value)
    setBrightness(newBrightness)
    await initLEDs(newBrightness)
  }
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-medium flex items-center">
          <FaLightbulb className="mr-2" /> Control de LEDs del Micrófono ReSpeaker
        </h1>
        <a href="/settings#debug-section" className="text-dashcam-600 hover:text-dashcam-800 text-sm">
          &larr; Volver a Configuración
        </a>
      </div>
      
      {message && (
        <div className={`p-3 mb-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}
      
      {/* Status Card */}
      <div className="card p-4 mb-4">
        <h2 className="text-lg font-medium mb-2">Estado</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-2">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${status.initialized ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="font-medium">
                {status.initialized ? 'LEDs Inicializados' : 'LEDs No Inicializados'}
              </span>
            </div>
            
            <div className="text-sm text-gray-600">
              <p>Número de LEDs: {status.leds_count}</p>
              <p>Animación activa: {status.animation_running ? status.animation_type : 'Ninguna'}</p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => initLEDs(brightness)}
              disabled={loading}
              className="btn btn-primary flex items-center"
            >
              <FaPowerOff className="mr-1" /> {status.initialized ? 'Reinicializar' : 'Inicializar'} LEDs
            </button>
          </div>
        </div>
        
        {/* Brightness slider */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2 flex items-center">
            <FaSun className="mr-2" /> Brillo ({brightness}/31)
          </label>
          <input
            type="range"
            min="1"
            max="31"
            value={brightness}
            onChange={handleBrightnessChange}
            className="w-full"
          />
        </div>
      </div>
      
      {/* LED Select */}
      <div className="card p-4 mb-4">
        <h2 className="text-lg font-medium mb-3">LED a controlar</h2>
        
        <div className="flex space-x-4">
          <button
            className={`px-3 py-2 rounded-md flex items-center ${selectedLED === 'all' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setSelectedLED('all')}
          >
            <FaCircle className="mr-2" /> Todos
          </button>
          
          {Array.from({length: status.leds_count}, (_, i) => (
            <button
              key={i}
              className={`px-3 py-2 rounded-md flex items-center ${selectedLED === i.toString() ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setSelectedLED(i.toString())}
            >
              <FaCircle className="mr-2" /> LED {i}
            </button>
          ))}
        </div>
      </div>
      
      {/* Color Control */}
      <div className="card p-4 mb-4">
        <h2 className="text-lg font-medium mb-3">Control de Color</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Custom color picker */}
          <div>
            <h3 className="font-medium mb-2">Color Personalizado</h3>
            
            <div className="flex items-center mb-3">
              <div
                className="w-10 h-10 rounded-md mr-3"
                style={{ backgroundColor: rgbToHex(customColor) }}
              ></div>
              
              <input
                type="color"
                value={rgbToHex(customColor)}
                onChange={(e) => setCustomColor(hexToRgb(e.target.value))}
                className="p-1 border rounded"
              />
            </div>
            
            <div className="space-y-2">
              {/* RGB sliders */}
              <div>
                <label className="block text-sm mb-1">Rojo ({customColor.r})</label>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={customColor.r}
                  onChange={(e) => setCustomColor(prev => ({ ...prev, r: parseInt(e.target.value) }))}
                  className="w-full"
                  style={{ accentColor: '#ff0000' }}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Verde ({customColor.g})</label>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={customColor.g}
                  onChange={(e) => setCustomColor(prev => ({ ...prev, g: parseInt(e.target.value) }))}
                  className="w-full"
                  style={{ accentColor: '#00ff00' }}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1">Azul ({customColor.b})</label>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={customColor.b}
                  onChange={(e) => setCustomColor(prev => ({ ...prev, b: parseInt(e.target.value) }))}
                  className="w-full"
                  style={{ accentColor: '#0000ff' }}
                />
              </div>
            </div>
            
            <div className="mt-3">
              <button
                onClick={setColor}
                disabled={loading || !initialized}
                className="btn btn-primary mr-2"
              >
                Establecer Color
              </button>
              
              <button
                onClick={turnOffLEDs}
                disabled={loading || !initialized}
                className="btn btn-gray"
              >
                Apagar LEDs
              </button>
            </div>
          </div>
          
          {/* Preset colors */}
          <div>
            <h3 className="font-medium mb-2">Colores Predefinidos</h3>
            
            <div className="grid grid-cols-4 gap-2">
              {presetColors.map(preset => (
                <button
                  key={preset.name}
                  className="flex flex-col items-center p-2 rounded-md border hover:border-gray-500"
                  onClick={() => setPresetColor(preset.name)}
                  disabled={loading || !initialized}
                >
                  <div
                    className="w-8 h-8 rounded-full mb-1"
                    style={{ backgroundColor: preset.color }}
                  ></div>
                  <span className="text-xs">{preset.name}</span>
                </button>
              ))}
            </div>
            
            {/* Add special color: black for turning off */}
            <div className="mt-3 flex justify-center">
              <button
                className="flex flex-col items-center p-2 rounded-md border hover:border-gray-500"
                onClick={() => setPresetColor('black')}
                disabled={loading || !initialized}
              >
                <div
                  className="w-8 h-8 rounded-full mb-1 border border-gray-400"
                  style={{ backgroundColor: '#000000' }}
                ></div>
                <span className="text-xs">off (black)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Animations */}
      <div className="card p-4 mb-4">
        <h2 className="text-lg font-medium mb-3">Animaciones</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {/* Animation type selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Tipo de animación</label>
              <select
                value={animationSettings.type}
                onChange={handleAnimationTypeChange}
                className="w-full p-2 border rounded-md"
                disabled={loading || !initialized}
              >
                <option value="rotate">Rotación de colores</option>
                <option value="pulse">Pulsación</option>
                <option value="rainbow">Arcoíris</option>
                <option value="blink">Parpadeo</option>
              </select>
            </div>
            
            {/* Animation delay control */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Velocidad (retardo: {animationSettings.delay}s)
              </label>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={animationSettings.delay}
                onChange={handleAnimationDelayChange}
                className="w-full"
                disabled={loading || !initialized}
              />
            </div>
            
            {/* Animation control buttons */}
            <div className="flex space-x-2">
              <button
                onClick={startAnimation}
                disabled={loading || !initialized || status.animation_running}
                className="btn btn-primary flex items-center"
              >
                <FaPlay className="mr-2" /> Iniciar
              </button>
              
              <button
                onClick={stopAnimation}
                disabled={loading || !initialized || !status.animation_running}
                className="btn btn-danger flex items-center"
              >
                <FaStop className="mr-2" /> Detener
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Ejemplos de animaciones</h3>
            
            <div className="space-y-2 text-sm">
              <p className="flex items-center">
                <FaSyncAlt className="mr-2 text-blue-500" /> 
                <strong>Rotación:</strong> Los colores se mueven alrededor de los LEDs
              </p>
              
              <p className="flex items-center">
                <FaSyncAlt className="mr-2 text-blue-500" /> 
                <strong>Pulsación:</strong> Los LEDs aumentan y disminuyen su brillo
              </p>
              
              <p className="flex items-center">
                <FaSyncAlt className="mr-2 text-blue-500" /> 
                <strong>Arcoíris:</strong> Transición de colores del arcoíris
              </p>
              
              <p className="flex items-center">
                <FaSyncAlt className="mr-2 text-blue-500" /> 
                <strong>Parpadeo:</strong> Los LEDs se encienden y apagan alternativamente
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Wyoming Integration */}
      <div className="card p-4">
        <h2 className="text-lg font-medium mb-3">Integración con Wyoming</h2>
        
        <p className="text-sm text-gray-600 mb-3">
          Este controlador permite probar los LEDs del ReSpeaker 2mic HAT. El código 
          original proviene del proyecto Wyoming y puede integrarse con él para indicar
          estados de detección de voz, transcripción, etc.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="border rounded-md p-3 text-center">
            <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: '#FFFF00' }}></div>
            <span className="text-sm font-medium">Amarillo</span>
            <p className="text-xs text-gray-500">Escuchando / Procesando</p>
          </div>
          
          <div className="border rounded-md p-3 text-center">
            <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: '#0000FF' }}></div>
            <span className="text-sm font-medium">Azul</span>
            <p className="text-xs text-gray-500">Detección activada</p>
          </div>
          
          <div className="border rounded-md p-3 text-center">
            <div className="w-4 h-4 rounded-full mx-auto mb-2" style={{ backgroundColor: '#00FF00' }}></div>
            <span className="text-sm font-medium">Verde</span>
            <p className="text-xs text-gray-500">Transcripción completada</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MicLEDTester
