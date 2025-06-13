import React from 'react'
import { useLocation } from 'react-router-dom'

// Layout wrapper que proporciona estructura consistente para todas las páginas
export const PageLayout = ({ 
  children, 
  title, 
  subtitle,
  icon,
  actions,
  className = '',
  containerSize = 'default', // 'default', 'wide', 'full'
  showBackButton = false,
  onBack
}) => {
  const location = useLocation()
  const isMapPage = location.pathname === '/map'

  // Clases de contenedor según el tamaño
  const containerClasses = {
    default: 'max-w-4xl mx-auto',
    wide: 'max-w-6xl mx-auto', 
    full: 'w-full'
  }

  const containerClass = containerClasses[containerSize] || containerClasses.default

  // Para páginas de mapa, usar layout especial
  if (isMapPage) {
    return (
      <div className="map-page h-screen w-screen relative">
        {children}
      </div>
    )
  }

  return (
    <div className={`page-container ${className}`}>
      <div className={containerClass}>
        {/* Header de página */}
        {(title || actions) && (
          <div className="page-header mb-6 md:mb-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {showBackButton && (
                  <button
                    onClick={onBack}
                    className="btn btn-ghost btn-sm mb-3 -ml-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver
                  </button>
                )}
                
                {title && (
                  <div className="flex items-center gap-3 mb-0">
                    {icon && (
                      <div className="flex-shrink-0 p-2.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl">
                        {icon}
                      </div>
                    )}
                    <h1 className="heading-1 mb-0">
                      {title}
                    </h1>
                  </div>
                )}
                
                {subtitle && (
                  <p className="body-small text-muted mt-2">
                    {subtitle}
                  </p>
                )}
              </div>
              
              {actions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {actions}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contenido principal */}
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  )
}

// Layout para secciones dentro de una página
export const Section = ({ 
  children, 
  title, 
  subtitle,
  actions,
  className = '',
  variant = 'default', // 'default', 'card', 'bordered'
  id // Agregar prop id
}) => {
  const baseClasses = 'section mb-8'
  
  const variantClasses = {
    default: '',
    card: 'card',
    bordered: 'border border-gray-200 rounded-lg p-6'
  }

  const sectionClass = `${baseClasses} ${variantClasses[variant]} ${className}`

  return (
    <section id={id} className={sectionClass}>
      {(title || actions) && (
        <div className="section-header mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="heading-3 mb-0">
                  {title}
                </h2>
              )}
              
              {subtitle && (
                <p className="body-small text-muted mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            
            {actions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="section-content">
        {children}
      </div>
    </section>
  )
}

// Grid layout responsive para contenido
export const Grid = ({ 
  children, 
  cols = 1, 
  gap = 4,
  className = '' 
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  const gapClasses = {
    2: 'gap-2',
    3: 'gap-3', 
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8'
  }

  return (
    <div className={`grid ${gridClasses[cols]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  )
}

// Stack layout para contenido vertical
export const Stack = ({ 
  children, 
  gap = 4,
  className = '' 
}) => {
  const gapClasses = {
    1: 'space-y-1',
    2: 'space-y-2',
    3: 'space-y-3',
    4: 'space-y-4',
    6: 'space-y-6',
    8: 'space-y-8'
  }

  return (
    <div className={`${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  )
}

// Flexbox layout horizontal
export const Flex = ({ 
  children, 
  align = 'center',
  justify = 'start',
  gap = 2,
  wrap = false,
  className = '' 
}) => {
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  }

  const gapClasses = {
    1: 'gap-1',
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8'
  }

  return (
    <div className={`flex ${alignClasses[align]} ${justifyClasses[justify]} ${gapClasses[gap]} ${wrap ? 'flex-wrap' : ''} ${className}`}>
      {children}
    </div>
  )
}

// Componente de estado vacío
export const EmptyState = ({ 
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && (
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 text-gray-400">
            {icon}
          </div>
        </div>
      )}
      
      {title && (
        <h3 className="heading-4 text-gray-900 mb-2">
          {title}
        </h3>
      )}
      
      {description && (
        <p className="body-base text-muted max-w-sm mx-auto mb-6">
          {description}
        </p>
      )}
      
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  )
}

export default PageLayout
