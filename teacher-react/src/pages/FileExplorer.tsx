import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Modal, Typography, List, Breadcrumb, Spin, message, Image, Popover, Space, Upload, Input, Form, Alert, Dropdown } from 'antd';
import { FileOutlined, FolderOutlined, EyeOutlined, ArrowLeftOutlined, FileImageOutlined, EditOutlined, UploadOutlined, FileAddOutlined, SettingOutlined, DeleteOutlined, ExportOutlined, DownOutlined } from '@ant-design/icons';
import axios from 'axios';
// import type { UploadProps } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import '../styles/FileExplorer.css';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
  content?: string;
}

interface BreadcrumbItem {
  title: string;
  path: string;
}

interface DirectoryCache {
  [path: string]: {
    items: FileItem[];
    timestamp: number;
  }
}

interface PreviewData {
  loading: boolean;
  items: FileItem[];
}

const FileExplorer: React.FC = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  // 使用Map存储每个路径的预览数据
  const [previewDataMap, setPreviewDataMap] = useState<Map<string, PreviewData>>(new Map());
  
  // 编辑相关状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [currentEditFile, setCurrentEditFile] = useState<FileItem | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadNewModalVisible, setUploadNewModalVisible] = useState(false); // 新增上传图片模态框状态
  const [uploadReplaceTarget, setUploadReplaceTarget] = useState<FileItem | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [jsonContent, setJsonContent] = useState('{}');
  const [jsonFileName, setJsonFileName] = useState('');
  
  // 目录内容缓存，避免重复请求
  const directoryCacheRef = useRef<DirectoryCache>({});
  // 缓存有效期（毫秒）
  const CACHE_TTL = 30000; // 30秒

  // 判断是否为图片文件
  const isImageFile = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext || '');
  };

  // 判断是否为文本文件
  const isTextFile = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ['txt', 'json', 'md', 'log', 'js', 'jsx', 'ts', 'tsx', 'css', 'html'].includes(ext || '');
  };

  // 获取文件列表
  const fetchFileList = async (path: string = '') => {
    setLoading(true);
    try {
      console.log('正在请求文件列表，路径:', path);
      const response = await axios.get(`http://localhost:3002/api/file-explorer/files?path=${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('获取文件列表成功:', response.data);
      setFileList(response.data.files);
      setCurrentPath(path);
      
      // 更新缓存
      directoryCacheRef.current[path] = {
        items: response.data.files,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('获取文件列表失败:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取文件内容
  const fetchFileContent = async (path: string) => {
    try {
      console.log('正在请求文件内容，路径:', path);
      const response = await axios.get(`http://localhost:3002/api/file-explorer/file-content?path=${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('获取文件内容成功');
      return response.data.content;
    } catch (error) {
      console.error('获取文件内容失败:', error);
      message.error('获取文件内容失败');
      return null;
    }
  };

  // 获取目录预览内容（用于面包屑悬浮显示），使用缓存减少API请求
  const fetchDirectoryPreview = async (path: string) => {
    // 检查缓存是否有效
    const cache = directoryCacheRef.current[path];
    if (cache && (Date.now() - cache.timestamp < CACHE_TTL)) {
      console.log('使用缓存的目录预览，路径:', path);
      // 更新预览数据Map
      setPreviewDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(path, { 
          loading: false, 
          items: cache.items.slice(0, 5) 
        });
        return newMap;
      });
      return cache.items.slice(0, 5);
    }
    
    // 设置加载状态
    setPreviewDataMap(prev => {
      const newMap = new Map(prev);
      newMap.set(path, { loading: true, items: [] });
      return newMap;
    });
    
    try {
      console.log('正在请求目录预览，路径:', path);
      const response = await axios.get(`http://localhost:3002/api/file-explorer/files?path=${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('获取目录预览成功:', response.data);
      
      // 更新缓存
      directoryCacheRef.current[path] = {
        items: response.data.files,
        timestamp: Date.now()
      };
      
      // 最多显示5个项目
      const previewItems = response.data.files.slice(0, 5);
      
      // 更新预览数据Map
      setPreviewDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(path, { loading: false, items: previewItems });
        return newMap;
      });
      
      return previewItems;
    } catch (error) {
      console.error('获取目录预览失败:', error);
      
      // 更新预览数据Map，显示错误状态
      setPreviewDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(path, { loading: false, items: [] });
        return newMap;
      });
      
      return [];
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFileList();
  }, [token]); // 添加token依赖，确保令牌加载后再请求

  // 进入文件夹
  const enterDirectory = (item: FileItem) => {
    setPathHistory([...pathHistory, currentPath]);
    fetchFileList(item.path);
  };

  // 根据路径进入目录（面包屑点击）
  const navigateToPath = (path: string) => {
    // 如果点击的是当前路径，不做任何操作
    if (path === currentPath) return;
    
    // 更新路径历史
    const currentPathIndex = pathHistory.indexOf(path);
    
    // 如果点击的是历史路径中的一个
    if (currentPathIndex !== -1) {
      // 将历史中该路径之后的所有路径都保存
      setPathHistory(pathHistory.slice(0, currentPathIndex + 1));
    } else {
      // 如果是新路径，添加当前路径到历史
      setPathHistory([...pathHistory, currentPath]);
    }
    
    // 导航到选择的路径
    fetchFileList(path);
  };

  // 返回上级目录
  const goBack = () => {
    if (pathHistory.length > 0) {
      const prevPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      fetchFileList(prevPath);
    }
  };

  // 预览文件
  const previewFileContent = async (item: FileItem) => {
    // 重置预览状态
    setImagePreviewUrl(null);
    
    // 检查是否为图片文件
    if (isImageFile(item.name)) {
      // 如果是图片，设置预览图片URL - 使用公开图片访问路径，并添加token参数增强安全性
      const imageUrl = `http://localhost:3002/api/file-explorer/public-image?path=${encodeURIComponent(item.path)}&token=${encodeURIComponent(token || '')}`;
      setImagePreviewUrl(imageUrl);
      setPreviewFile(item);
      setPreviewVisible(true);
    } else {
      // 如果不是图片，获取文本内容预览
      const content = await fetchFileContent(item.path);
      if (content !== null) {
        setPreviewFile({ ...item, content });
        setPreviewVisible(true);
      }
    }
  };

  // 打开编辑文件模态框
  const openEditModal = async (file: FileItem) => {
    const content = await fetchFileContent(file.path);
    if (content !== null) {
      setEditContent(content);
      setCurrentEditFile(file);
      setEditModalVisible(true);
    }
  };

  // 打开上传替换模态框
  const openUploadModal = (file: FileItem) => {
    setUploadReplaceTarget(file);
    setUploadModalVisible(true);
  };

  // 打开上传新图片模态框
  const openUploadNewModal = () => {
    setUploadNewModalVisible(true);
  };

  // 打开创建文本文件模态框
  const openNoteModal = () => {
    setNoteContent('');
    setNoteModalVisible(true);
  };

  // 打开创建JSON文件模态框
  const openJsonModal = () => {
    setJsonContent('{\n  "key": "value"\n}');
    setJsonFileName('');
    setJsonModalVisible(true);
  };

  // 保存编辑的文件
  const handleEditSave = async () => {
    if (!currentEditFile) return;
    
    try {
      const response = await axios.post('http://localhost:3002/api/file-explorer/update-file', {
        path: currentEditFile.path,
        content: editContent
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('文件更新成功:', response.data);
      message.success('文件保存成功');
      
      // 关闭模态框
      setEditModalVisible(false);
      
      // 如果在当前目录下，刷新列表
      fetchFileList(currentPath);
      
    } catch (error) {
      console.error('文件更新失败:', error);
      message.error('文件保存失败');
    }
  };

  // 处理图片替换
  const handleImageReplace = async (options: any) => {
    if (!uploadReplaceTarget) return;
    
    const { file, onSuccess, onError } = options;
    
    // 从文件路径中获取目录部分
    const fileDir = uploadReplaceTarget.path.split('/').slice(0, -1).join('/');
    console.log('替换图片的目标目录路径:', fileDir);
    
    // 使用URLSearchParams而不是FormData，确保参数正确提交
    const params = new URLSearchParams();
    params.append('directory', fileDir);
    
    // 创建FormData用于文件上传
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // 首先发送directory参数
      console.log('发送目录参数:', fileDir);
      const directoryResponse = await axios.post(
        'http://localhost:3002/api/file-explorer/replace-image?directory=' + encodeURIComponent(fileDir),
        formData,
        {
          headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('图片替换成功:', directoryResponse.data);
      onSuccess(directoryResponse.data, file);
      
      message.success('图片已替换，并命名为A');
      setUploadModalVisible(false);
      
      // 如果在当前目录下，刷新列表
      fetchFileList(currentPath);
      
    } catch (error) {
      console.error('图片替换失败:', error);
      onError(error);
      message.error('图片替换失败');
    }
  };

  // 处理新图片上传
  const handleImageUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    
    if (!currentPath) {
      message.error('请先导航到要上传图片的目录');
      onError(new Error('未选择目录'));
      return;
    }
    
    console.log('上传新图片的目标目录路径:', currentPath);
    
    // 创建FormData用于文件上传
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // 使用URL参数传递directory
      console.log('发送目录参数:', currentPath);
      const response = await axios.post(
        'http://localhost:3002/api/file-explorer/replace-image?directory=' + encodeURIComponent(currentPath),
        formData,
        {
          headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('图片上传成功:', response.data);
      onSuccess(response.data, file);
      
      message.success('图片已上传，并命名为A');
      setUploadNewModalVisible(false);
      
      // 刷新列表
      fetchFileList(currentPath);
      
    } catch (error) {
      console.error('图片上传失败:', error);
      onError(error);
      message.error('图片上传失败');
    }
  };

  // 创建文本笔记
  const handleCreateNote = async () => {
    try {
      const filename = `note.txt`;
      
      const response = await axios.post('http://localhost:3002/api/file-explorer/create-text-file', {
        directory: currentPath,
        filename,
        content: noteContent
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('文本文件创建成功:', response.data);
      message.success('文本文件创建成功');
      
      // 关闭模态框
      setNoteModalVisible(false);
      
      // 刷新文件列表
      fetchFileList(currentPath);
      
    } catch (error) {
      console.error('文本文件创建失败:', error);
      message.error('文本文件创建失败');
    }
  };

  // 创建JSON配置文件
  const handleCreateJson = async () => {
    try {
      // 如果没有指定文件名，使用默认文件名
      const filename = jsonFileName || `config_${new Date().getTime()}.json`;
      
      // 确保文件扩展名为.json
      const finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
      
      // 验证JSON格式是否有效
      try {
        JSON.parse(jsonContent);
      } catch (e) {
        message.error('JSON格式无效，请检查并修正');
        return;
      }
      
      const response = await axios.post('http://localhost:3002/api/file-explorer/create-text-file', {
        directory: currentPath,
        filename: finalFilename,
        content: jsonContent
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('JSON文件创建成功:', response.data);
      message.success('JSON文件创建成功');
      
      // 关闭模态框
      setJsonModalVisible(false);
      
      // 刷新文件列表
      fetchFileList(currentPath);
      
    } catch (error) {
      console.error('JSON文件创建失败:', error);
      message.error('JSON文件创建失败');
    }
  };

  // 生成元数据文件
  const handleGenerateMetadata = async () => {
    try {
      const response = await axios.post('http://localhost:3002/api/file-explorer/generate-metadata', {
        directory: currentPath
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('元数据文件生成成功:', response.data);
      message.success('元数据文件生成成功');
      
      // 刷新文件列表
      fetchFileList(currentPath);
      
    } catch (error) {
      console.error('元数据文件生成失败:', error);
      message.error('元数据文件生成失败');
    }
  };

  // 根据文件类型获取图标
  const getFileIcon = (file: FileItem) => {
    if (file.isDirectory) {
      return <FolderOutlined className="file-icon folder-icon" />;
    } else if (isImageFile(file.name)) {
      return <FileImageOutlined className="file-icon image-icon" />;
    } else {
      return <FileOutlined className="file-icon" />;
    }
  };

  // 定义表格列
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileItem) => (
        <Space>
          {getFileIcon(record)}
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_text: string, record: FileItem) => (
        <Space size="small">
          {record.isDirectory ? (
            <Button 
              type="primary" 
              size="small" 
              onClick={() => enterDirectory(record)}
            >
              打开
            </Button>
          ) : (
            <Button 
              type="primary" 
              size="small" 
              icon={<EyeOutlined />} 
              onClick={() => previewFileContent(record)}
            >
              预览
            </Button>
          )}
          
          {!record.isDirectory && isTextFile(record.name) && (
            <Button 
              size="small" 
              icon={<EditOutlined />} 
              onClick={() => openEditModal(record)}
            >
              编辑
            </Button>
          )}
          
          {!record.isDirectory && isImageFile(record.name) && (
            <>
              <Button 
                size="small" 
                icon={<UploadOutlined />} 
                onClick={() => openUploadModal(record)}
              >
                替换
              </Button>
              <Button 
                size="small" 
                icon={<EyeOutlined />} 
                onClick={() => openImageInNewTab(record)}
              >
                查看
              </Button>
            </>
          )}
          
          {!record.isDirectory && record.name !== 'metadata.json' && (
            <Button 
              size="small"
              danger
              icon={<DeleteOutlined />} 
              onClick={() => handleDeleteFile(record)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 在新标签页中打开图片
  const openImageInNewTab = (item: FileItem) => {
    const imageUrl = `http://localhost:3002/api/file-explorer/public-image?path=${encodeURIComponent(item.path)}&token=${encodeURIComponent(token || '')}`;
    window.open(imageUrl, '_blank');
  };

  // 生成面包屑项
  const generateBreadcrumb = (): BreadcrumbItem[] => {
    const paths = currentPath.split('/').filter(p => p);
    const breadcrumbs: BreadcrumbItem[] = [{ title: '根目录', path: '' }];
    
    let currentPathPart = '';
    for (const part of paths) {
      currentPathPart = currentPathPart ? `${currentPathPart}/${part}` : part;
      breadcrumbs.push({
        title: part,
        path: currentPathPart
      });
    }
    
    return breadcrumbs;
  };

  // 处理面包屑悬浮显示
  const handlePopoverVisibleChange = (visible: boolean, path: string) => {
    if (visible && !previewDataMap.has(path)) {
      fetchDirectoryPreview(path);
    }
  };

  // 渲染目录预览内容
  const renderDirectoryPreview = (path: string) => {
    const previewData = previewDataMap.get(path);
    
    if (!previewData) {
      return <Spin size="small" />;
    }
    
    if (previewData.loading) {
      return <Spin size="small" />;
    }
    
    return (
      <List
        size="small"
        bordered
        dataSource={previewData.items}
        renderItem={item => (
          <List.Item>
            <Space>
              {getFileIcon(item)}
              <Text>{item.name}</Text>
            </Space>
          </List.Item>
        )}
        footer={previewData.items.length > 0 ? <div>点击查看完整内容</div> : <div>目录为空</div>}
      />
    );
  };

  // 带预览功能的面包屑
  const renderBreadcrumbWithPreview = () => {
    const breadcrumbItems = generateBreadcrumb();
    
    return (
      <Breadcrumb className="breadcrumb-with-preview">
        {breadcrumbItems.map((item, index) => (
          <Breadcrumb.Item key={index}>
            <Popover
              content={renderDirectoryPreview(item.path)}
              title={`${item.title || '根目录'}的内容`}
              trigger="hover"
              placement="bottom"
              onOpenChange={(visible) => handlePopoverVisibleChange(visible, item.path)}
            >
              <a 
                onClick={() => navigateToPath(item.path)}
                style={{ cursor: 'pointer' }}
              >
                {item.title || '根目录'}
              </a>
            </Popover>
          </Breadcrumb.Item>
        ))}
      </Breadcrumb>
    );
  };

  // 渲染预览内容
  const renderPreviewContent = () => {
    if (!previewFile) return null;
    
    if (imagePreviewUrl) {
      return (
        <div className="file-preview-content">
          <Image
            alt={previewFile.name}
            src={imagePreviewUrl}
            className="file-preview-image"
          />
        </div>
      );
    } else if (previewFile.content) {
      return (
        <div className="text-preview">
          <pre>
            {previewFile.content}
          </pre>
        </div>
      );
    }
    
    return <div>无法预览此文件</div>;
  };

  // 删除文件
  const handleDeleteFile = async (item: FileItem) => {
    if (item.isDirectory) {
      message.error('不能删除目录，仅支持删除文件');
      return;
    }

    confirm({
      title: '确认删除',
      content: `确定要删除文件 "${item.name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      className: 'delete-confirm-modal',
      icon: <DeleteOutlined />,
      onOk: async () => {
        try {
          console.log('正在删除文件:', item.path);
          const response = await axios.post('http://localhost:3002/api/file-explorer/delete-file', {
            path: item.path
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('文件删除成功:', response.data);
          message.success('文件已删除');
          
          // 刷新文件列表
          fetchFileList(currentPath);
          
        } catch (error) {
          console.error('删除文件失败:', error);
          message.error('删除文件失败');
        }
      }
    });
  };
  
  // 一键导出数据
  const handleExportData = async (type: 'all' | 'basic') => {
    try {
      const endpoint = type === 'all' ? 'all-data' : 'basic-data';
      
      message.loading({ content: '正在导出数据...', key: 'export' });
      
      const response = await axios.get(`http://localhost:3002/api/export/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'json'
      });
      
      const data = response.data;
      console.log('导出数据成功:', data);
      
      // 将导出数据转换为JSON字符串并下载
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接
      const a = document.createElement('a');
      a.href = url;
      a.download = `prtsc-export-${type}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success({ content: `成功导出${data.total}个题目数据`, key: 'export' });
    } catch (error) {
      console.error('导出数据失败:', error);
      message.error({ content: '导出数据失败', key: 'export' });
    }
  };

  return (
    <div className="file-explorer-container">
      <div className="file-explorer-header">
        <div>
          <Title level={4} className="file-explorer-title">题目资源文件浏览器</Title>
          <Paragraph className="file-explorer-description">
            浏览并管理题目相关资源文件，包括LaTeX源文件、图片和元数据
          </Paragraph>
        </div>
        <div className="file-explorer-actions">
          <Space>
            <Button 
              onClick={openNoteModal}
              icon={<FileAddOutlined />}
            >
              新建文本文件
            </Button>
            <Button 
              onClick={openJsonModal}
              icon={<FileAddOutlined />}
            >
              新建JSON配置
            </Button>
            <Button 
              onClick={openUploadNewModal}
              icon={<UploadOutlined />}
            >
              上传图片
            </Button>
            <Button 
              onClick={handleGenerateMetadata}
              icon={<SettingOutlined />}
            >
              生成元数据
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'basic',
                    label: '导出基础数据',
                    onClick: () => handleExportData('basic')
                  },
                  {
                    key: 'all',
                    label: '导出完整数据',
                    onClick: () => handleExportData('all')
                  }
                ]
              }}
            >
              <Button icon={<ExportOutlined />}>
                一键导出 <DownOutlined />
              </Button>
            </Dropdown>
          </Space>
        </div>
      </div>
      
      <div className="file-explorer-breadcrumb">
        <Button 
          icon={<ArrowLeftOutlined />}
          onClick={goBack}
          disabled={pathHistory.length === 0}
          className="back-button"
        >
          返回上级
        </Button>
        
        {renderBreadcrumbWithPreview()}
      </div>
      
      <Table 
        dataSource={fileList} 
        columns={columns} 
        rowKey="path" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        onRow={(record) => ({
          onDoubleClick: () => {
            if (record.isDirectory) {
              enterDirectory(record);
            } else {
              previewFileContent(record);
            }
          }
        })}
      />
      
      {/* 文件预览模态框 */}
      <Modal
        title={previewFile?.name}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          isImageFile(previewFile?.name || '') && (
            <Button 
              key="openImage" 
              type="primary" 
              onClick={() => {
                if (previewFile) {
                  openImageInNewTab(previewFile);
                }
              }}
            >
              查看大图
            </Button>
          ),
          !isImageFile(previewFile?.name || '') && isTextFile(previewFile?.name || '') && (
            <Button 
              key="edit" 
              type="primary" 
              onClick={() => {
                setPreviewVisible(false);
                if (previewFile) {
                  openEditModal(previewFile);
                }
              }}
            >
              编辑
            </Button>
          )
        ]}
        width={800}
      >
        {renderPreviewContent()}
      </Modal>
      
      {/* 文件编辑模态框 */}
      <Modal
        title={`编辑文件: ${currentEditFile?.name}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditSave}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <TextArea 
          value={editContent} 
          onChange={(e) => setEditContent(e.target.value)} 
          autoSize={{ minRows: 20, maxRows: 30 }}
          className="modal-textarea"
        />
      </Modal>
      
      {/* 图片替换模态框 */}
      <Modal
        title={`替换图片: ${uploadReplaceTarget?.name}`}
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
      >
        <Alert 
          message="注意" 
          description="替换后的图片将自动命名为'A'，原有图片将被删除。同一目录下只能保留一张图片。" 
          type="warning" 
          showIcon 
          style={{ marginBottom: 16 }}
        />
        <Upload.Dragger
          name="file"
          customRequest={handleImageReplace}
          showUploadList={false}
          accept="image/*"
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined className="upload-icon" />
          </p>
          <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
          <p className="ant-upload-hint">替换当前图片，新图片将命名为"A"</p>
        </Upload.Dragger>
      </Modal>
      
      {/* 上传新图片模态框 */}
      <Modal
        title={`上传图片到当前目录: ${currentPath || '根目录'}`}
        open={uploadNewModalVisible}
        onCancel={() => setUploadNewModalVisible(false)}
        footer={null}
      >
        <Alert 
          message="注意" 
          description="上传的图片将自动命名为'A'。如果目录中已有其他图片文件，将被自动删除。一个目录只能有一张图片。" 
          type="warning" 
          showIcon 
          style={{ marginBottom: 16 }}
        />
        <Upload.Dragger
          name="file"
          customRequest={handleImageUpload}
          showUploadList={false}
          accept="image/*"
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined className="upload-icon" />
          </p>
          <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
          <p className="ant-upload-hint">上传新图片，将自动命名为"A"</p>
        </Upload.Dragger>
      </Modal>
      
      {/* 创建文本文件模态框 */}
      <Modal
        title="创建文本文件"
        open={noteModalVisible}
        onCancel={() => setNoteModalVisible(false)}
        onOk={handleCreateNote}
      >
        <TextArea 
          value={noteContent} 
          onChange={(e) => setNoteContent(e.target.value)} 
          placeholder="请输入文本内容"
          autoSize={{ minRows: 10, maxRows: 20 }}
        />
      </Modal>
      
      {/* 创建JSON配置文件模态框 */}
      <Modal
        title="创建JSON配置文件"
        open={jsonModalVisible}
        onCancel={() => setJsonModalVisible(false)}
        onOk={handleCreateJson}
        okText="创建"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="文件名称">
            <Input 
              value={jsonFileName} 
              onChange={(e) => setJsonFileName(e.target.value)}
              placeholder="例如: config.json"
              suffix=".json" 
            />
          </Form.Item>
          <Form.Item label="JSON内容">
            <TextArea 
              value={jsonContent} 
              onChange={(e) => setJsonContent(e.target.value)} 
              placeholder="请输入JSON格式的内容"
              autoSize={{ minRows: 10, maxRows: 20 }}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FileExplorer; 