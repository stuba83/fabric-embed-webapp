import React from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Loading Spinner Component
 * Reusable loading indicator with multiple sizes and styles
 */
const LoadingSpinner = ({
  size = 'md',
  variant = 'default',
  className = '',
  text = null,
  fullScreen = false,
  color = 'blue'
}) => {
  // Size mapping
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
    '2xl': 'h-16 w-16'
  }

  // Color mapping
  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    white: 'text-white'
  }

  // Variant styles
  const variantClasses = {
    default: '',
    dots: 'opacity-75',
    pulse: 'animate-pulse',
    bounce: 'animate-bounce'
  }

  const spinnerClasses = [
    'animate-spin',
    sizeClasses[size] || sizeClasses.md,
    colorClasses[color] || colorClasses.blue,
    variantClasses[variant] || variantClasses.default,
    className
  ].join(' ')

  // Full screen wrapper
  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        <div className="loading-content">
          <Loader2 className={spinnerClasses} />
          {text && <p className="loading-text">{text}</p>}
        </div>
        
        <style jsx>{`
          .loading-fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 50;
          }

          .loading-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }

          .loading-text {
            @apply text-gray-600 text-lg font-medium;
            margin: 0;
          }
        `}</style>
      </div>
    )
  }

  // Inline spinner
  if (variant === 'dots') {
    return (
      <div className={`loading-dots ${className}`}>
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
        
        <style jsx>{`
          .loading-dots {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .dot {
            width: 8px;
            height: 8px;
            background-color: currentColor;
            border-radius: 50%;
            animation: dotPulse 1.4s ease-in-out infinite both;
          }

          .dot:nth-child(1) { animation-delay: -0.32s; }
          .dot:nth-child(2) { animation-delay: -0.16s; }

          @keyframes dotPulse {
            0%, 80%, 100% {
              opacity: 0.3;
              transform: scale(0.8);
            }
            40% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`loading-spinner ${text ? 'with-text' : ''}`}>
      <Loader2 className={spinnerClasses} />
      {text && <span className="loading-label">{text}</span>}
      
      <style jsx>{`
        .loading-spinner {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .loading-spinner.with-text {
          flex-direction: column;
          gap: 12px;
        }

        .loading-label {
          @apply text-gray-600 text-sm font-medium;
        }
      `}</style>
    </div>
  )
}

export default LoadingSpinner