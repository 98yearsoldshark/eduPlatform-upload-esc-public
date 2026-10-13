import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Empty, Button, Spin, Typography, Segmented } from 'antd';
import { AppstoreOutlined, BarsOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import LazyImage from './LazyImage';
import ImageViewer from './ImageViewer';

const { Title } = Typography;

interface ImageFile {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface ImageBrowserProps {
  path?: string;
  title?: string;
}

const ImageBrowser: React.FC<ImageBrowserProps> = ({
  path = '',
  title = '图片浏览器',
}) => {
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
  const [, setCurrentPath] = useState(path);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPath, setPreviewPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 判断文件是否为图片
  const isImageFile = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext || '');
  };

  // 获取文件列表
  const fetchFiles = async (dirPath: string = '') => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('正在请求文件列表，路径:', dirPath);
      const response = await axios.get(`http://localhost:3001/api/test-function/files?path=${dirPath}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
      });
      
      // 过滤出图片文件
      const files = response.data.files.filter((file: ImageFile) => 
        !file.isDirectory && isImageFile(file.name)
      );
      
      console.log('获取图片文件列表成功:', files);
      setImageFiles(files);
      setCurrentPath(dirPath);
    } catch (error) {
      console.error('获取文件列表失败:', error);
      setError('获取图片列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(path);
  }, [path]);

  // 预览图片
  const handlePreview = (imagePath: string) => {
    setPreviewPath(imagePath);
    setPreviewVisible(true);
  };

  // 构建缩略图URL
  const getThumbUrl = (imagePath: string) => {
    return `http://localhost:3001/api/test-function/image-thumbnail?path=${encodeURIComponent(imagePath)}&width=200&height=200`;
  };

  // 构建完整图片URL
  const getImageUrl = (imagePath: string) => {
    return `http://localhost:3001/api/test-function/image?path=${encodeURIComponent(imagePath)}`;
  };

  // 渲染网格模式
  const renderGridView = () => {
    if (imageFiles.length === 0) {
      return <Empty description="没有图片文件" />;
    }

    return (
      <Row gutter={[16, 16]}>
        {imageFiles.map((file, index) => (
          <Col key={index} xs={24} sm={12} md={8} lg={6} xl={4}>
            <Card
              hoverable
              cover={
                <LazyImage
                  src={getImageUrl(file.path)}
                  thumbSrc={getThumbUrl(file.path)}
                  alt={file.name}
                  height={150}
                  placeholderHeight={150}
                  onClick={() => handlePreview(file.path)}
                />
              }
              size="small"
              actions={[
                <Button 
                  key="preview" 
                  type="link" 
                  icon={<EyeOutlined />} 
                  onClick={() => handlePreview(file.path)}
                >
                  预览
                </Button>
              ]}
            >
              <Card.Meta 
                title={file.name} 
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
              />
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  // 渲染列表模式
  const renderListView = () => {
    if (imageFiles.length === 0) {
      return <Empty description="没有图片文件" />;
    }

    return (
      <div>
        {imageFiles.map((file, index) => (
          <Card 
            key={index} 
            style={{ marginBottom: 8 }}
            size="small"
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ marginRight: 16, width: 60, height: 60 }}>
                <LazyImage
                  src={getImageUrl(file.path)}
                  thumbSrc={getThumbUrl(file.path)}
                  alt={file.name}
                  width={60}
                  height={60}
                  onClick={() => handlePreview(file.path)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {file.path}
                </div>
              </div>
              <Button 
                type="primary" 
                size="small" 
                icon={<EyeOutlined />}
                onClick={() => handlePreview(file.path)}
              >
                预览
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5}>{title}</Title>
        <Segmented
          options={[
            {
              value: 'grid',
              icon: <AppstoreOutlined />,
              label: '网格'
            },
            {
              value: 'list',
              icon: <BarsOutlined />,
              label: '列表'
            }
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as 'grid' | 'list')}
        />
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <Spin spinning={loading}>
        <div style={{ height: 'calc(100% - 50px)', overflow: 'auto' }}>
          {viewMode === 'grid' ? renderGridView() : renderListView()}
        </div>
      </Spin>

      <ImageViewer
        path={previewPath}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        paths={imageFiles.map(file => file.path)}
      />
    </div>
  );
};

export default ImageBrowser; 