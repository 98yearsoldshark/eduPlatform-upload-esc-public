import React, { useState, useRef, useEffect, useCallback } from 'react';
import './AiDialog.css'; // 添加样式文件引用
import { CommunicationService } from '../../services/communication';

// 引入图标组件
const MinimizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// const MaximizeIcon = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"/>
//   </svg>
// );

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 14L10 14L10 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 10L14 10L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 14L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 10L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ShrinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 20L14 14M14 20L20 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EmbeddedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="8" height="8" stroke="currentColor" strokeWidth="2" fill="none"/>
    <rect x="12" y="12" width="8" height="8" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

const AssistantIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M16 4V20" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const NormalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

/**
 * AI对话组件
 * 
 * 提供三种交互模式:
 * - embedded: 嵌入式悬浮窗口，可拖拽、调整大小
 * - assistant: 右侧固定助手栏
 * - normal: 全屏对话页面
 * 
 * 使用方法:
 * ```jsx
 * // 方式1: 组件内部处理模式切换 (自定义事件)
 * <AiDialog 
 *   mode={currentMode}
 *   onClose={() => setCurrentMode(null)}
 * />
 * 
 * // 方式2: 父组件处理模式切换 (通过回调)
 * <AiDialog 
 *   mode={currentMode}
 *   onClose={() => setCurrentMode(null)}
 *   onModeChange={(newMode) => setCurrentMode(newMode)}
 * />
 * ```
 * 
 * 注意: 如果不提供onModeChange回调，组件会使用自定义事件通知父组件模式变化
 */
interface AiDialogProps {
  mode: string | null;
  onClose: () => void;
  onModeChange?: (mode: string) => void;
  initialSize?: { width: number, height: number };
  initialPosition?: { x: number, y: number };
}

const AiDialog: React.FC<AiDialogProps> = ({ 
  mode: propsMode, 
  onClose, 
  onModeChange,
  initialSize = { width: 350, height: 500 },
  initialPosition = { x: 20, y: 100 }
}) => {
  // 添加内部模式状态，用于在没有提供onModeChange时内部控制模式
  const [internalMode, setInternalMode] = useState<string | null>(propsMode);
  // 使用计算后的模式，优先使用props中的模式，如果没有提供onModeChange则使用内部模式
  const mode = onModeChange ? propsMode : internalMode;
  
  // 基础状态
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  
  // 窗口位置和大小状态
  const [dialogPosition, setDialogPosition] = useState(initialPosition);
  const [dialogSize, setDialogSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [initialSizeState, setInitialSizeState] = useState(initialSize);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 窗口前置状态
  const [zIndex, setZIndex] = useState(1000);

  // iframe引用和URL状态
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [iframeUrl, _setIframeUrl] = useState("http://localhost:5011");
  
  // 鼠标位置状态 - 添加鼠标移动追踪
  const [_lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
  
  // 显示隐藏的悬浮按钮
  const FloatingButton = () => {
    if (!isMinimized || !mode) return null;
    return (
      <div 
        className="ai-dialog-floating-button"
        onClick={() => setIsMinimized(false)}
        title="打开AI助手"
      >
        AI
      </div>
    );
  };

  // 设置窗口前置
  const bringToFront = () => {
    setZIndex(1010); // 设置为更高的z-index
  };

  // 拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (mode !== 'embedded' || isResizing) return;
    
    // 确保拖拽事件不是从按钮元素或其容器触发的
    if ((e.target as Element).closest('.ai-dialog-action-button') || 
        (e.target as Element).closest('.ai-dialog-actions')) {
      return;
    }
    
    setIsDragging(true);
    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      // 使用相对于窗口的坐标
      const offsetX = e.clientX - (dialogPosition.x || rect.left);
      const offsetY = e.clientY - (dialogPosition.y || rect.top);
      
      setDragOffset({
        x: offsetX,
        y: offsetY
      });
      
      // 记录开始拖拽时的鼠标位置
      setLastMousePosition({ x: e.clientX, y: e.clientY });
    }
    bringToFront();
    // 防止文本选择
    e.preventDefault();
  }, [mode, isResizing, dialogPosition]);

  // 创建一个遮罩层，在拖拽时覆盖整个屏幕
  const createDragOverlay = () => {
    const overlay = document.createElement('div');
    overlay.id = 'ai-dialog-drag-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '9999';
    overlay.style.cursor = 'move';
    overlay.style.backgroundColor = 'transparent';
    document.body.appendChild(overlay);
    return overlay;
  };

  // 移除拖拽遮罩层
  const removeDragOverlay = () => {
    const overlay = document.getElementById('ai-dialog-drag-overlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }
  };

  // 拖拽过程 - 使用useCallback优化性能
  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    // 更新最后鼠标位置
    setLastMousePosition({ x: e.clientX, y: e.clientY });
    
    // 使用更高效的状态更新方式，减少不必要的渲染
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // 直接修改DOM以获得更好的性能
    if (dialogRef.current) {
      // 使用requestAnimationFrame避免卡顿
      requestAnimationFrame(() => {
        if (dialogRef.current) {
          dialogRef.current.style.left = `${newX}px`;
          dialogRef.current.style.top = `${newY}px`;
        }
      });
    }
  }, [isDragging, dragOffset]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    
    // 拖拽结束时更新实际状态
    if (dialogRef.current) {
      const style = window.getComputedStyle(dialogRef.current);
      const left = parseInt(style.left, 10);
      const top = parseInt(style.top, 10);
      
      setDialogPosition({
        x: left,
        y: top
      });
    }
    
    // 移除遮罩层
    removeDragOverlay();
    setIsDragging(false);
  }, [isDragging]);

  // 处理调整大小开始
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    if (mode !== 'embedded') return;
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setInitialSizeState({ ...dialogSize });
    // 防止文本选择
    e.preventDefault();
    e.stopPropagation(); // 阻止冒泡，防止触发拖拽
  }, [mode, dialogSize]);

  // 处理调整大小过程 - 使用useCallback优化性能
  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing || mode !== 'embedded') return;

    requestAnimationFrame(() => {
      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;
      
      let newWidth = initialSizeState.width;
      let newHeight = initialSizeState.height;
      
      if (resizeDirection.includes('right')) {
        // 设置最小宽度，但不设置最大限制
        newWidth = Math.max(250, initialSizeState.width + deltaX);
      }
      if (resizeDirection.includes('bottom')) {
        // 设置最小高度，但不设置最大限制
        newHeight = Math.max(300, initialSizeState.height + deltaY);
      }
      
      setDialogSize({ width: newWidth, height: newHeight });
    });
  }, [isResizing, mode, resizeStartPos, initialSizeState, resizeDirection]);

  // 处理调整大小结束
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 切换展开/缩小状态
  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡，防止触发拖拽
    
    if (!isExpanded) {
      // 保存当前尺寸和位置
      setInitialSizeState(dialogSize);
      
      // 设置为扩展模式
      setDialogSize({ width: window.innerWidth * 0.8, height: window.innerHeight * 0.8 });
      setDialogPosition({ 
        x: (window.innerWidth - window.innerWidth * 0.8) / 2,
        y: (window.innerHeight - window.innerHeight * 0.8) / 2
      });
      setIsExpanded(true);
    } else {
      // 恢复原始尺寸和位置
      setDialogSize(initialSizeState);
      setIsExpanded(false);
    }
  }, [isExpanded, dialogSize, initialSizeState]);

  // 切换AI对话模式
  const switchMode = useCallback((newMode: string, e?: React.MouseEvent) => {
    // 确保每次都阻止冒泡和默认行为
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // 只有当模式不同时才执行切换
    if (newMode !== mode) {
      // 如果提供了回调函数，优先使用回调
      if (onModeChange) {
        onModeChange(newMode);
      } else {
        // 使用内部状态控制模式
        setInternalMode(newMode);
      }
      
      // 如果切换到嵌入式模式，取消最小化状态
      if (newMode === 'embedded') {
        setIsMinimized(false);
      }
    }
  }, [mode, onModeChange]);
  
  // 最小化事件处理
  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡，防止触发拖拽
    setIsMinimized(true);
  }, []);

  // 处理关闭按钮点击
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡，防止触发拖拽
    onClose();
  }, [onClose]);
  
  // 初始化通信服务
  useEffect(() => {
      CommunicationService.getInstance();
  }, []);

  // 同步props的mode到内部状态
  useEffect(() => {
    if (!onModeChange) {
      setInternalMode(propsMode);
    }
  }, [propsMode, onModeChange]);

  // 添加和移除拖拽和调整大小事件监听器
  useEffect(() => {
    let overlay: HTMLElement | null = null;
    
    if (isDragging) {
      // 创建遮罩层
      overlay = createDragOverlay();
      
      // 为遮罩层添加事件处理
      overlay.addEventListener('mousemove', handleDrag);
      overlay.addEventListener('mouseup', handleDragEnd);
      overlay.addEventListener('mouseleave', handleDragEnd);
    }
    
    const resizeHandler = (e: MouseEvent) => {
      if (isResizing) handleResize(e);
    };
    const resizeEndHandler = () => handleResizeEnd();
    
    if (isResizing) {
      document.addEventListener('mousemove', resizeHandler);
      document.addEventListener('mouseup', resizeEndHandler);
      document.addEventListener('mouseleave', resizeEndHandler);
    }

    // 清理函数
    return () => {
      if (overlay) {
        overlay.removeEventListener('mousemove', handleDrag);
        overlay.removeEventListener('mouseup', handleDragEnd);
        overlay.removeEventListener('mouseleave', handleDragEnd);
        removeDragOverlay();
      }
      
      document.removeEventListener('mousemove', resizeHandler);
      document.removeEventListener('mouseup', resizeEndHandler);
      document.removeEventListener('mouseleave', resizeEndHandler);
    };
  }, [isDragging, isResizing, handleDrag, handleDragEnd, handleResize, handleResizeEnd]);

  // 如果没有指定模式，不渲染任何内容
  if (!mode) {
    return null;
  }

  // 嵌入式模式 - 悬浮可拖拽
  if (mode === 'embedded') {
    if (isMinimized) {
      return <FloatingButton />;
    }
    
    return (
      <div 
        ref={dialogRef}
        className="ai-dialog ai-dialog-embedded"
        style={{
          position: 'fixed',
          left: `${dialogPosition.x}px`,
          top: `${dialogPosition.y}px`,
          width: `${dialogSize.width}px`,
          height: `${dialogSize.height}px`,
          zIndex: zIndex,
          transform: 'translate3d(0,0,0)',
          willChange: 'transform',
          userSelect: 'none', // 防止文本选择
        }}
        onClick={bringToFront}
      >
        <div 
          ref={dragRef}
          className="ai-dialog-header"
          onMouseDown={handleDragStart}
        >
          <span>嵌入式AI助手</span>
          <div className="ai-dialog-actions">
            <button 
              className="ai-dialog-action-button" 
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(e);
              }}
              title={isExpanded ? "还原大小" : "最大化"}
            >
              {isExpanded ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
            <button 
              className="ai-dialog-action-button mode-button" 
              onClick={(e) => switchMode('assistant', e)}
              title="切换到阅读助手模式"
            >
              <AssistantIcon />
            </button>
            <button 
              className="ai-dialog-action-button mode-button" 
              onClick={(e) => switchMode('normal', e)}
              title="切换到全屏模式"
            >
              <NormalIcon />
            </button>
            <button 
              className="ai-dialog-action-button" 
              onClick={(e) => {
                e.stopPropagation();
                handleMinimize(e);
              }}
              title="最小化"
            >
              <MinimizeIcon />
            </button>
            <button 
              className="ai-dialog-action-button" 
              onClick={(e) => {
                e.stopPropagation();
                handleClose(e);
              }}
              title="关闭"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <iframe 
          ref={iframeRef}
          src={iframeUrl}
          className="ai-dialog-content"
          title="嵌入式AI助手"
          style={{ 
            pointerEvents: isDragging ? 'none' : 'auto' // 拖拽时禁用iframe交互，防止干扰拖拽
          }}
        />
        {/* 调整大小的手柄 */}
        <div
          className="ai-dialog-resize-handle ai-dialog-resize-handle-right"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
        <div
          className="ai-dialog-resize-handle ai-dialog-resize-handle-bottom"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        />
        <div
          className="ai-dialog-resize-handle ai-dialog-resize-handle-corner"
          onMouseDown={(e) => handleResizeStart(e, 'right-bottom')}
        />
      </div>
    );
  }

  // 助手式模式 - 固定在右侧
  if (mode === 'assistant') {
    return (
      <div className="ai-dialog ai-dialog-assistant">
        <div className="ai-dialog-header">
          <span>阅读助手AI</span>
          <div className="ai-dialog-actions">
            <button 
              className="ai-dialog-action-button mode-button" 
              onClick={(e) => switchMode('embedded', e)}
              title="切换到嵌入式模式"
            >
              <EmbeddedIcon />
            </button>
            <button 
              className="ai-dialog-action-button mode-button" 
              onClick={(e) => switchMode('normal', e)}
              title="切换到全屏模式"
            >
              <NormalIcon />
            </button>
            <button 
              className="ai-dialog-action-button" 
              onClick={(e) => {
                e.stopPropagation();
                handleClose(e);
              }}
              title="关闭"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <iframe 
          ref={iframeRef}
          src={iframeUrl}
          className="ai-dialog-content"
          title="阅读助手AI"
        />
      </div>
    );
  }

  // 正常式模式 - 全页面
  if (mode === 'normal') {
    return (
      <div className="ai-dialog ai-dialog-normal">
        <div className="ai-dialog-header">
          <span>AI对话页面</span>
          <div className="ai-dialog-actions">
            <button 
              className="ai-dialog-action-button mode-button" 
              onClick={(e) => switchMode('embedded', e)}
              title="切换到嵌入式模式"
            >
              <EmbeddedIcon />
            </button>
            <button 
              className="ai-dialog-action-button mode-button" 
              onClick={(e) => switchMode('assistant', e)}
              title="切换到阅读助手模式"
            >
              <AssistantIcon />
            </button>
            <button 
              className="ai-dialog-action-button" 
              onClick={(e) => {
                e.stopPropagation();
                handleClose(e);
              }}
              title="返回应用页面"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <iframe 
          ref={iframeRef}
          src={iframeUrl}
          className="ai-dialog-content"
          title="AI对话页面"
        />
      </div>
    );
  }

  return null;
};

export default AiDialog; 