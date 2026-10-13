import React, { useState, useEffect, useRef } from 'react';
import { Modal, Spin, Button, Tooltip, message } from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  DownloadOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';

interface ImageViewerProps {
  path: string;
  visible: boolean;
  onClose: () => void;
  paths?: string[]; // 图片路径数组，用于预览模式下的上一张/下一张
}

interface ImageMetadata {
  name: string;
  size: number;
  width: number;
  height: number;
  format: string;
  created: string;
  modified: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ path, visible, onClose, paths = [] }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [preloadedImages, setPreloadedImages] = useState<string[]>([]);
  
  const imageRef = useRef<HTMLImageElement>(null);
  
  // 设置初始索引
  useEffect(() => {
    if (paths.length > 0 && path) {
      const index = paths.indexOf(path);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [path, paths]);
  
  // 加载当前图片
  useEffect(() => {
    if (visible) {
      loadImage(path);
    }
  }, [visible, path]);
  
  // 预加载前后图片
  useEffect(() => {
    if (paths.length > 0 && visible) {
      const preloadImages = [];
      
      // 预加载下一张图片
      if (currentIndex < paths.length - 1) {
        const nextPath = paths[currentIndex + 1];
        preloadImages.push(nextPath);
      }
      
      // 预加载上一张图片
      if (currentIndex > 0) {
        const prevPath = paths[currentIndex - 1];
        preloadImages.push(prevPath);
      }
      
      setPreloadedImages(preloadImages);
    }
  }, [currentIndex, paths, visible]);
  
  // 预加载指定的图片
  useEffect(() => {
    preloadedImages.forEach(imagePath => {
      const img = new Image();
      img.src = `http://localhost:3001/api/test-function/image?path=${encodeURIComponent(imagePath)}`;
    });
  }, [preloadedImages]);
  
  // 加载图片
  const loadImage = async (imagePath: string) => {
    if (!imagePath) return;
    
    setLoading(true);
    setError(null);
    setZoom(100);
    
    try {
      // 加载图片元数据
      const metadataResponse = await axios.get(
        `http://localhost:3001/api/test-function/image-metadata?path=${encodeURIComponent(imagePath)}`, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` } }
      );
      
      setMetadata(metadataResponse.data);
      
      // 设置图片URL
      const imageUrl = `http://localhost:3001/api/test-function/image?path=${encodeURIComponent(imagePath)}`;
      setImageUrl(imageUrl);
      
    } catch (err) {
      console.error('加载图片失败:', err);
      setError('加载图片失败，请稍后重试');
      message.error('加载图片失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理图片加载完成
  const handleImageLoaded = () => {
    setLoading(false);
  };
  
  // 处理图片加载错误
  const handleImageError = () => {
    setLoading(false);
    setError('图片加载失败');
    message.error('图片加载失败');
  };
  
  // 显示下一张图片
  const showNextImage = () => {
    if (currentIndex < paths.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      loadImage(paths[nextIndex]);
    }
  };
  
  // 显示上一张图片
  const showPrevImage = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      loadImage(paths[prevIndex]);
    }
  };
  
  // 放大图片
  const zoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom + 20, 300));
  };
  
  // 缩小图片
  const zoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom - 20, 20));
  };
  
  // 下载图片
  const downloadImage = () => {
    if (!imageUrl) return;
    
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = metadata?.name || 'image';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <Modal
      title={metadata?.name || '图片预览'}
      open={visible}
      onCancel={onClose}
      footer={null}
      width="80%"
      style={{ top: 20 }}
      destroyOnClose
      centered
    >
      <div style={{ position: 'relative', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} tip="加载中..." />
          </div>
        )}
        
        {error && (
          <div style={{ textAlign: 'center', color: 'red' }}>
            {error}
          </div>
        )}
        
        {imageUrl && (
          <div style={{ maxHeight: '70vh', overflow: 'auto', textAlign: 'center' }}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt={metadata?.name || '图片'}
              style={{ 
                maxWidth: '100%', 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center center',
                transition: 'transform 0.3s ease'
              }}
              onLoad={handleImageLoaded}
              onError={handleImageError}
            />
          </div>
        )}
        
        {/* 导航按钮 */}
        {paths.length > 1 && (
          <>
            <Button
              disabled={currentIndex === 0}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }}
              icon={<LeftOutlined />}
              onClick={showPrevImage}
              shape="circle"
            />
            <Button
              disabled={currentIndex === paths.length - 1}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }}
              icon={<RightOutlined />}
              onClick={showNextImage}
              shape="circle"
            />
          </>
        )}
      </div>
      
      {/* 底部工具栏 */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
        <Tooltip title="缩小">
          <Button icon={<ZoomOutOutlined />} onClick={zoomOut} disabled={!imageUrl || zoom <= 20} />
        </Tooltip>
        <Tooltip title="放大">
          <Button icon={<ZoomInOutlined />} onClick={zoomIn} disabled={!imageUrl || zoom >= 300} />
        </Tooltip>
        <Tooltip title="下载">
          <Button icon={<DownloadOutlined />} onClick={downloadImage} disabled={!imageUrl} />
        </Tooltip>
        <Tooltip title={showMetadata ? "隐藏信息" : "显示信息"}>
          <Button 
            icon={<InfoCircleOutlined />} 
            onClick={() => setShowMetadata(!showMetadata)}
            disabled={!metadata}
            type={showMetadata ? "primary" : "default"}
          />
        </Tooltip>
      </div>
      
      {/* 图片元数据 */}
      {showMetadata && metadata && (
        <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
          <h4>图片信息</h4>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: '120px', padding: '4px 0' }}>文件名:</td>
                <td>{metadata.name}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>尺寸:</td>
                <td>{metadata.width} x {metadata.height} 像素</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>格式:</td>
                <td>{metadata.format?.toUpperCase()}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>大小:</td>
                <td>{formatFileSize(metadata.size)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>创建时间:</td>
                <td>{formatDate(metadata.created)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0' }}>修改时间:</td>
                <td>{formatDate(metadata.modified)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      
      {/* 图片计数器 */}
      {paths.length > 1 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {currentIndex + 1} / {paths.length}
        </div>
      )}
    </Modal>
  );
};

export default ImageViewer; 