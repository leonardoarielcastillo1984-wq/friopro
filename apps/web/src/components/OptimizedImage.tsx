'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  sizes?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  format = 'webp',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate optimized image URL
  const getOptimizedSrc = (originalSrc: string, width?: number, height?: number, quality?: number, format?: string) => {
    // This would integrate with your CDN/image optimization service
    // For now, return the original src with simulated optimization
    const params = new URLSearchParams();
    
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    if (quality) params.append('q', quality.toString());
    if (format) params.append('f', format);
    
    const paramString = params.toString();
    return paramString ? `${originalSrc}?${paramString}` : originalSrc;
  };

  // Generate responsive srcset
  const generateSrcSet = (baseSrc: string) => {
    const widths = [320, 640, 768, 1024, 1280, 1536];
    return widths
      .map(w => `${getOptimizedSrc(baseSrc, w, undefined, quality, format)} ${w}w`)
      .join(', ');
  };

  // Generate blur placeholder
  const generateBlurPlaceholder = (src: string) => {
    if (blurDataURL) return blurDataURL;
    
    // Generate a simple blur placeholder (in production, this would be a real blur hash)
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y0ZjRmNCIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD4KPC9zdmc+';
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!priority && imgRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const optimizedSrc = getOptimizedSrc(src, width, height, quality, format);
              setCurrentSrc(optimizedSrc);
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: '50px',
          threshold: 0.01
        }
      );

      observerRef.current.observe(imgRef.current);
    } else if (priority) {
      const optimizedSrc = getOptimizedSrc(src, width, height, quality, format);
      setCurrentSrc(optimizedSrc);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, width, height, quality, format, priority]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setCurrentSrc(getOptimizedSrc(src, width, height, quality, format));
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          {placeholder === 'blur' ? (
            <img
              src={generateBlurPlaceholder(src)}
              alt=""
              className="w-full h-full object-cover blur-sm"
              aria-hidden="true"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="text-xs text-gray-500">Cargando...</span>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <AlertCircle className="w-6 h-6 text-gray-400 mb-2" />
          <span className="text-xs text-gray-500 mb-2">Error al cargar imagen</span>
          <button
            onClick={handleRetry}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main Image */}
      <img
        ref={imgRef}
        src={currentSrc}
        srcSet={currentSrc ? generateSrcSet(src) : undefined}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          objectFit: 'cover',
          aspectRatio: width && height ? `${width}/${height}` : undefined
        }}
      />

      {/* Low quality image placeholder (LQIP) */}
      {isLoading && placeholder === 'blur' && (
        <img
          src={generateBlurPlaceholder(src)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// Picture component for format fallbacks
export function Picture({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  onLoad,
  onError
}: Omit<OptimizedImageProps, 'format' | 'placeholder' | 'blurDataURL'>) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLPictureElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const getOptimizedSrc = (originalSrc: string, width?: number, height?: number, quality?: number, format?: string) => {
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    if (quality) params.append('q', quality.toString());
    if (format) params.append('f', format);
    
    const paramString = params.toString();
    return paramString ? `${originalSrc}?${paramString}` : originalSrc;
  };

  const generateSrcSet = (baseSrc: string, format: string) => {
    const widths = [320, 640, 768, 1024, 1280, 1536];
    return widths
      .map(w => `${getOptimizedSrc(baseSrc, w, undefined, quality, format)} ${w}w`)
      .join(', ');
  };

  useEffect(() => {
    if (!priority && imgRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setCurrentSrc(src);
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: '50px',
          threshold: 0.01
        }
      );

      observerRef.current.observe(imgRef.current);
    } else if (priority) {
      setCurrentSrc(src);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, priority]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Cargando...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <AlertCircle className="w-6 h-6 text-gray-400 mb-2" />
          <span className="text-xs text-gray-500 mb-2">Error al cargar imagen</span>
          <button
            onClick={() => {
              setIsLoading(true);
              setHasError(false);
              setCurrentSrc(src);
            }}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Picture Element with Format Fallbacks */}
      {currentSrc && (
        <picture>
          {/* AVIF - Best compression, modern browsers */}
          <source
            srcSet={generateSrcSet(currentSrc, 'avif')}
            type="image/avif"
            sizes={sizes}
          />
          
          {/* WebP - Good compression, wide browser support */}
          <source
            srcSet={generateSrcSet(currentSrc, 'webp')}
            type="image/webp"
            sizes={sizes}
          />
          
          {/* JPEG - Fallback for older browsers */}
          <img
            ref={imgRef as any}
            srcSet={generateSrcSet(currentSrc, 'jpg')}
            src={getOptimizedSrc(currentSrc, width, height, quality, 'jpg')}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              objectFit: 'cover',
              aspectRatio: width && height ? `${width}/${height}` : undefined
            }}
          />
        </picture>
      )}
    </div>
  );
}

// Hook for progressive image loading
export function useProgressiveImage(src: string, placeholderSrc?: string) {
  const [imageSrc, setImageSrc] = useState(placeholderSrc || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
    };
    
    img.onerror = () => {
      setIsLoading(false);
    };
  }, [src]);

  return { imageSrc, isLoading };
}

// Component for image galleries with lazy loading
export function ImageGallery({
  images,
  className = '',
  onImageClick
}: {
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
    caption?: string;
  }>;
  className?: string;
  onImageClick?: (index: number) => void;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
      {images.map((image, index) => (
        <div
          key={index}
          className="relative group cursor-pointer overflow-hidden rounded-lg"
          onClick={() => onImageClick?.(index)}
        >
          <OptimizedImage
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            className="w-full h-48 transition-transform duration-300 group-hover:scale-105"
          />
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-300 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          
          {/* Caption */}
          {image.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
              <p className="text-white text-xs truncate">{image.caption}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// CDN Configuration and utilities
export const CDNConfig = {
  baseUrl: process.env.NEXT_PUBLIC_CDN_URL || '',
  defaultQuality: 75,
  supportedFormats: ['avif', 'webp', 'jpg', 'png'],
  breakpoints: [320, 640, 768, 1024, 1280, 1536, 1920],
  placeholderSize: 32,
  blurAmount: 10
};

// Utility function to generate CDN URLs
export function generateCDNUrl(
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
    crop?: boolean;
    gravity?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  } = {}
) {
  if (!CDNConfig.baseUrl) return src;

  const params = new URLSearchParams();
  
  if (options.width) params.append('w', options.width.toString());
  if (options.height) params.append('h', options.height.toString());
  if (options.quality) params.append('q', options.quality.toString());
  if (options.format) params.append('f', options.format);
  if (options.crop) params.append('c', '1');
  if (options.gravity) params.append('g', options.gravity);
  
  const paramString = params.toString();
  const separator = src.includes('?') ? '&' : '?';
  
  return `${CDNConfig.baseUrl}${src}${paramString ? separator + paramString : ''}`;
}

// Hook for preloading critical images
export function usePreloadImages(srcs: string[], priority: 'high' | 'low' = 'low') {
  useEffect(() => {
    const links = srcs.map(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      if (priority === 'high') {
        link.setAttribute('importance', 'high');
      }
      document.head.appendChild(link);
      return link;
    });

    return () => {
      links.forEach(link => {
        document.head.removeChild(link);
      });
    };
  }, [srcs, priority]);
}
