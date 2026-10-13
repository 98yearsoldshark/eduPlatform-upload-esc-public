import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Modal, Typography, List, Breadcrumb, Spin, message, Image, Popover, Space, Upload, Input, Form } from 'antd';
import { FileOutlined, FolderOutlined, EyeOutlined, ArrowLeftOutlined, FileImageOutlined, EditOutlined, UploadOutlined, FileAddOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';
// import type { UploadProps } from 'antd';

const { Title, Paragraph} = Typography;
const { TextArea } = Input;

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
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  // 使用Map存储每个路径的预览数据
  const [previewDataMap, setPreviewDataMap] = useState<Map<string, PreviewData>>(new Map());
  
  // 新增状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [currentEditFile, setCurrentEditFile] = useState<FileItem | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
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

  // 判断是否为JSON文件
  const isJsonFile = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ['json'].includes(ext || '');
  };

  // 获取文件列表
  const fetchFileList = async (path: string = '') => {
    setLoading(true);
    try {
      console.log('正在请求文件列表，路径:', path);
      const response = await axios.get(`http://localhost:3001/api/test-function/files?path=${path}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
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
      const response = await axios.get(`http://localhost:3001/api/test-function/file-content?path=${path}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
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
      const response = await axios.get(`http://localhost:3001/api/test-function/files?path=${path}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
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
  }, []);

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
      // 如果是图片，设置预览图片URL
      const imageUrl = `http://localhost:3001/api/test-function/image?path=${encodeURIComponent(item.path)}`;
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
      setCurrentEditFile(file);
      setEditContent(content);
      setEditModalVisible(true);
    }
  };

  // 打开上传替换模态框
  const openUploadModal = (file: FileItem) => {
    setUploadReplaceTarget(file);
    setUploadModalVisible(true);
  };

  // 打开创建笔记模态框
  const openNoteModal = () => {
    setNoteContent('');
    setNoteModalVisible(true);
  };

  // 打开创建JSON模态框
  const openJsonModal = () => {
    setJsonContent('{\n  \n}');
    setJsonFileName('');
    setJsonModalVisible(true);
  };

  // 编辑文件内容
  const handleEditSave = async () => {
    if (!currentEditFile) return;
    
    try {
      console.log('正在保存文件:', currentEditFile.path);
      const response = await axios.post(
        'http://localhost:3001/api/test-function/update-file', 
        {
          path: currentEditFile.path,
          content: editContent
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
        }
      );
      
      console.log('文件保存成功:', response.data);
      message.success('文件内容已保存');
      setEditModalVisible(false);
      
      // 重新加载文件列表
      fetchFileList(currentPath);
    } catch (error) {
      console.error('保存文件内容失败:', error);
      message.error('保存文件内容失败');
    }
  };
  
  // 处理图片替换上传
  const handleImageReplace = async (options: any) => {
    const { file, onSuccess, onError } = options;
    
    if (!uploadReplaceTarget) {
      message.error('缺少目标文件信息');
      onError(new Error('缺少目标文件信息'));
      return;
    }
    
    try {
      console.log('正在替换图片:', uploadReplaceTarget.path);
      
      // 构建FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetPath', uploadReplaceTarget.path);
      
      const response = await axios.post(
        'http://localhost:3001/api/test-function/replace-image',
        formData,
        {
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('teacherToken')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      console.log('图片替换成功:', response.data);
      message.success('图片已替换');
      onSuccess(response.data);
      setUploadModalVisible(false);
      
      // 重新加载文件列表
      fetchFileList(currentPath);
    } catch (error) {
      console.error('替换图片失败:', error);
      message.error('替换图片失败');
      onError(new Error('替换图片失败'));
    }
  };
  
  // 创建笔记文件
  const handleCreateNote = async () => {
    try {
      console.log('正在创建笔记文件');
      const response = await axios.post(
        'http://localhost:3001/api/test-function/create-text-file',
        {
          directory: currentPath,
          filename: 'note.txt',
          content: noteContent
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
        }
      );
      
      console.log('笔记文件创建成功:', response.data);
      message.success('笔记文件已创建');
      setNoteModalVisible(false);
      
      // 重新加载文件列表
      fetchFileList(currentPath);
    } catch (error) {
      console.error('创建笔记文件失败:', error);
      message.error('创建笔记文件失败');
    }
  };
  
  // 创建JSON文件
  const handleCreateJson = async () => {
    if (!jsonFileName) {
      message.error('请输入文件名');
      return;
    }
    
    // 确保文件名以.json结尾
    const filename = jsonFileName.endsWith('.json') 
      ? jsonFileName 
      : `${jsonFileName}.json`;
    
    try {
      console.log('正在创建JSON文件:', filename);
      
      // 验证JSON格式
      let jsonObj;
      try {
        jsonObj = JSON.parse(jsonContent);
      } catch (e) {
        message.error('JSON格式不正确');
        return;
      }
      
      // 美化JSON
      const formattedJson = JSON.stringify(jsonObj, null, 2);
      
      const response = await axios.post(
        'http://localhost:3001/api/test-function/create-text-file',
        {
          directory: currentPath,
          filename: filename,
          content: formattedJson
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
        }
      );
      
      console.log('JSON文件创建成功:', response.data);
      message.success('JSON文件已创建');
      setJsonModalVisible(false);
      
      // 重新加载文件列表
      fetchFileList(currentPath);
    } catch (error) {
      console.error('创建JSON文件失败:', error);
      message.error('创建JSON文件失败');
    }
  };
  
  // 生成元数据文件
  const handleGenerateMetadata = async () => {
    try {
      console.log('正在生成元数据文件');
      const response = await axios.post(
        'http://localhost:3001/api/test-function/generate-metadata',
        {
          directory: currentPath
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }
        }
      );
      
      console.log('元数据文件生成成功:', response.data);
      message.success('元数据文件已生成');
      
      // 重新加载文件列表
      fetchFileList(currentPath);
    } catch (error) {
      console.error('生成元数据文件失败:', error);
      message.error('生成元数据文件失败');
    }
  };

  // 获取文件图标
  const getFileIcon = (file: FileItem) => {
    if (file.isDirectory) {
      return <FolderOutlined style={{ marginRight: 8, color: '#1890ff' }} />;
    } else if (isImageFile(file.name)) {
      return <FileImageOutlined style={{ marginRight: 8, color: '#13c2c2' }} />;
    } else {
      return <FileOutlined style={{ marginRight: 8 }} />;
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileItem) => (
        <span>
          {getFileIcon(record)}
          {text}
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'isDirectory',
      key: 'type',
      render: (isDirectory: boolean, record: FileItem) => {
        if (isDirectory) return '文件夹';
        if (isImageFile(record.name)) return '图片';
        if (isJsonFile(record.name)) return 'JSON';
        if (isTextFile(record.name)) return '文本';
        return '文件';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (record: FileItem) => (
        <Space>
          {record.isDirectory ? (
            <Button type="link" onClick={() => enterDirectory(record)}>进入</Button>
          ) : (
            <>
              <Button 
                type="link" 
                icon={<EyeOutlined />} 
                onClick={() => previewFileContent(record)}
              >
                预览
              </Button>
              {isTextFile(record.name) && (
                <Button 
                  type="link" 
                  icon={<EditOutlined />} 
                  onClick={() => openEditModal(record)}
                >
                  编辑
                </Button>
              )}
              {isImageFile(record.name) && (
                <Button 
                  type="link" 
                  icon={<UploadOutlined />} 
                  onClick={() => openUploadModal(record)}
                >
                  替换
                </Button>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  // 生成面包屑导航
  const generateBreadcrumb = (): BreadcrumbItem[] => {
    if (!currentPath) return [{ title: '根目录', path: '' }];
    
    const paths = currentPath.split('/').filter(Boolean);
    return [
      { title: '根目录', path: '' },
      ...paths.map((part, index) => {
        const path = paths.slice(0, index + 1).join('/');
        return { title: part, path };
      })
    ];
  };

  // 处理Popover显示事件
  const handlePopoverVisibleChange = (visible: boolean, path: string) => {
    if (visible) {
      // 当悬停在面包屑上时，获取该目录的预览内容
      fetchDirectoryPreview(path);
    }
  };

  // 渲染目录预览内容
  const renderDirectoryPreview = (path: string) => {
    const previewData = previewDataMap.get(path) || { loading: true, items: [] };
    
    return (
      <List
        size="small"
        loading={previewData.loading}
        dataSource={previewData.items}
        renderItem={item => (
          <List.Item>
            {getFileIcon(item)}
            <span>{item.name}</span>
          </List.Item>
        )}
        footer={previewData.items.length === 5 ? <div style={{ textAlign: 'center' }}>...</div> : null}
        locale={{ emptyText: previewData.loading ? '加载中...' : '目录为空' }}
      />
    );
  };

  // 渲染带悬浮预览的面包屑
  const renderBreadcrumbWithPreview = () => {
    const items = generateBreadcrumb();
    
    return (
      <Breadcrumb separator=">">
        {items.map((item, index) => (
          <Breadcrumb.Item key={index}>
            <Popover 
              content={renderDirectoryPreview(item.path)}
              title={`${item.title} 目录内容`}
              trigger="hover"
              placement="bottom"
              onOpenChange={(visible) => handlePopoverVisibleChange(visible, item.path)}
              destroyTooltipOnHide
            >
              <Button 
                type="link" 
                onClick={() => navigateToPath(item.path)}
                style={{ padding: 0, margin: 0 }}
              >
                {item.title}
              </Button>
            </Popover>
          </Breadcrumb.Item>
        ))}
      </Breadcrumb>
    );
  };

  // 渲染预览内容
  const renderPreviewContent = () => {
    if (imagePreviewUrl) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Image 
            src={imagePreviewUrl} 
            alt={previewFile?.name || '图片'} 
            style={{ maxWidth: '100%' }}
            preview={false}
          />
        </div>
      );
    } else if (previewFile?.content) {
      return (
        <div style={{ maxHeight: '500px', overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {previewFile.content}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <Title level={4}>文件浏览器</Title>
      <Paragraph>
        浏览后端 prtsc 目录下的文件和文件夹内容。
      </Paragraph>
      
      <div style={{ marginBottom: 16 }}>
        {renderBreadcrumbWithPreview()}
      </div>
      
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          {pathHistory.length > 0 && (
            <Button 
              type="link" 
              icon={<ArrowLeftOutlined />} 
              onClick={goBack}
            >
              返回上级
            </Button>
          )}
        </div>
        
        <div>
          <Space>
            <Button 
              type="primary" 
              icon={<FileAddOutlined />} 
              onClick={openNoteModal}
            >
              创建Note
            </Button>
            <Button 
              icon={<FileAddOutlined />} 
              onClick={openJsonModal}
            >
              创建JSON
            </Button>
            <Button 
              icon={<SettingOutlined />} 
              onClick={handleGenerateMetadata}
            >
              生成Metadata
            </Button>
          </Space>
        </div>
      </div>
      
      <Spin spinning={loading}>
        <Table 
          columns={columns} 
          dataSource={fileList.map((item, index) => ({ ...item, key: index }))}
          pagination={false}
        />
      </Spin>
      
      {/* 文件预览模态框 */}
      <Modal
        title={
          previewFile?.name ? 
            <span>
              {imagePreviewUrl ? <FileImageOutlined style={{ marginRight: 8, color: '#13c2c2' }} /> : <FileOutlined style={{ marginRight: 8 }} />}
              {previewFile.name}
            </span> : 
            '文件预览'
        }
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={800}
      >
        {renderPreviewContent()}
      </Modal>
      
      {/* 文件编辑模态框 */}
      <Modal
        title={currentEditFile ? `编辑 ${currentEditFile.name}` : '编辑文件'}
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={800}
      >
        <TextArea 
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          rows={15}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>
      
      {/* 图片替换上传模态框 */}
      <Modal
        title={uploadReplaceTarget ? `替换图片 ${uploadReplaceTarget.name}` : '替换图片'}
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
      >
        <Upload.Dragger
          name="file"
          multiple={false}
          customRequest={handleImageReplace}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            只能上传图片文件，且名称将保持为 {uploadReplaceTarget?.name}
          </p>
        </Upload.Dragger>
      </Modal>
      
      {/* 创建Note模态框 */}
      <Modal
        title="创建 note.txt 文件"
        open={noteModalVisible}
        onOk={handleCreateNote}
        onCancel={() => setNoteModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <TextArea 
          value={noteContent}
          onChange={e => setNoteContent(e.target.value)}
          rows={8}
          placeholder="请输入笔记内容..."
        />
      </Modal>
      
      {/* 创建JSON模态框 */}
      <Modal
        title="创建 JSON 文件"
        open={jsonModalVisible}
        onOk={handleCreateJson}
        onCancel={() => setJsonModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="文件名" rules={[{ required: true }]}>
            <Input 
              value={jsonFileName} 
              onChange={e => setJsonFileName(e.target.value)}
              placeholder="请输入文件名，例如：config"
              suffix=".json"
            />
          </Form.Item>
          <Form.Item label="JSON内容">
            <TextArea 
              value={jsonContent}
              onChange={e => setJsonContent(e.target.value)}
              rows={8}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FileExplorer; 