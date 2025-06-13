import React from 'react'

// Componente Button unificado
export const Button = ({ 
  children,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const baseClasses = 'btn'
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary', 
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-error',
    danger: 'btn-error' // Alias for error variant
  }
  
  const sizeClasses = {
    sm: 'btn-sm',
    default: '',
    lg: 'btn-lg'
  }

  const buttonClass = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${loading ? 'loading' : ''} ${className}`

  return (
    <button
      type={type}
      className={buttonClass}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {leftIcon && !loading && <span className="btn-icon">{leftIcon}</span>}
      {children}
      {rightIcon && !loading && <span className="btn-icon">{rightIcon}</span>}
    </button>
  )
}

// Componente Card unificado
export const Card = ({ 
  children,
  header,
  footer,
  title,
  subtitle,
  actions,
  compact = false,
  hoverable = false,
  className = '',
  onClick,
  ...props
}) => {
  const cardClasses = `card ${compact ? 'card-compact' : ''} ${hoverable ? 'hover:shadow-lg' : ''} ${className}`

  return (
    <div 
      className={cardClasses}
      onClick={onClick}
      {...props}
    >
      {(header || title || actions) && (
        <div className="card-header">
          {header || (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="heading-4 mb-0">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="body-small text-muted mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card-body">
        {children}
      </div>

      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  )
}

// Componente Input unificado
export const Input = ({ 
  label,
  error,
  help,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        
        <input
          id={inputId}
          className={`input ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
      
      {help && !error && (
        <p className="form-help">
          {help}
        </p>
      )}
    </div>
  )
}

// Componente Textarea unificado
export const Textarea = ({ 
  label,
  error,
  help,
  className = '',
  id,
  rows = 3,
  ...props
}) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={textareaId} className="form-label">
          {label}
        </label>
      )}
      
      <textarea
        id={textareaId}
        rows={rows}
        className={`textarea ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
        {...props}
      />
      
      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
      
      {help && !error && (
        <p className="form-help">
          {help}
        </p>
      )}
    </div>
  )
}

// Componente Select unificado
export const Select = ({ 
  label,
  error,
  help,
  options = [],
  placeholder,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
        </label>
      )}
      
      <select
        id={selectId}
        className={`select ${error ? 'border-error-500 focus:ring-error-500' : ''} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="form-error">
          {error}
        </p>
      )}
      
      {help && !error && (
        <p className="form-help">
          {help}
        </p>
      )}
    </div>
  )
}

// Componente Alert unificado
export const Alert = ({ 
  children,
  variant = 'info',
  icon,
  onClose,
  className = '',
  ...props
}) => {
  const variantClasses = {
    info: 'alert-info',
    success: 'alert-success', 
    warning: 'alert-warning',
    error: 'alert-error'
  }

  const defaultIcons = {
    info: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
      </svg>
    )
  }

  return (
    <div className={`alert ${variantClasses[variant]} ${className}`} {...props}>
      <div className="flex">
        <div className="flex-shrink-0">
          {icon || defaultIcons[variant]}
        </div>
        <div className="ml-3 flex-1">
          {children}
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              onClick={onClose}
              className="inline-flex text-current hover:opacity-75 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente Badge unificado
export const Badge = ({ 
  children,
  variant = 'neutral',
  size = 'default',
  className = '',
  ...props
}) => {
  const variantClasses = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning', 
    error: 'badge-error',
    neutral: 'badge-neutral'
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    default: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1 text-sm'
  }

  return (
    <span className={`badge ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
      {children}
    </span>
  )
}

// Componente Loading Spinner
export const Spinner = ({ 
  size = 'default',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <div 
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${sizeClasses[size]} ${className}`}
      {...props}
    >
      <span className="sr-only">Cargando...</span>
    </div>
  )
}

// Componente Modal/Dialog básico
export const Modal = ({ 
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'default',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    default: 'max-w-lg', 
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" {...props}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} ${className}`}>
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="heading-3 mb-0">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          <div className="p-6">
            {children}
          </div>
          
          {footer && (
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
