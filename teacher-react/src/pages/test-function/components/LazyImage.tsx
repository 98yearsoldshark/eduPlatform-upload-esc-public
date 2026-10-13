import React, { useState, useEffect, useRef } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LazyImageProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  thumbSrc?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  placeholderHeight?: number | string;
  threshold?: number; // 元素与视口的交叉阈值
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '图片',
  width,
  height,
  thumbSrc,
  className,
  style,
  onClick,
  placeholderHeight = '200px',
  threshold = 0.1
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [showThumb, setShowThumb] = useState(!!thumbSrc);
  const imageRef = useRef<HTMLDivElement>(null);
  
  // 初始化Intersection Observer来检测图片是否进入视口
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      { threshold }
    );
    
    const currentRef = imageRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);
  
  // 处理图片加载完成
  const handleImageLoad = () => {
    setIsLoaded(true);
    setShowThumb(false);
  };
  
  // 处理图片加载失败
  const handleImageError = () => {
    setIsError(true);
    setIsLoaded(true);
    setShowThumb(false);
  };
  
  // 组合样式
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: width || 'auto',
    height: height || 'auto',
    ...(style || {})
  };
  
  return (
    <div
      ref={imageRef}
      className={className}
      style={containerStyle}
      onClick={onClick}
    >
      {/* 加载中状态 */}
      {!isLoaded && !isError && (
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f5f5f5',
            zIndex: showThumb ? 0 : 1
          }}
        >
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        </div>
      )}
      
      {/* 缩略图 */}
      {showThumb && thumbSrc && (
        <img
          src={thumbSrc}
          alt={alt}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(8px)',
            transform: 'scale(1.1)',
            zIndex: 0,
            opacity: isLoaded ? 0 : 1,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
      
      {/* 错误状态 */}
      {isError && (
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            width: '100%',
            height: placeholderHeight,
            backgroundColor: '#f5f5f5',
            color: 'red',
            fontSize: '14px'
          }}
        >
          图片加载失败
        </div>
      )}
      
      {/* 实际图片，只有在应该加载时才设置src */}
      {shouldLoad && !isError && (
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
            zIndex: 2,
            position: 'relative'
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}
    </div>
  );
};

export default LazyImage; 