import React, { useState, useEffect, useRef } from 'react';
import { Layout, message, Modal, notification } from 'antd';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionContext';
import '../../styles/QuestionManagement.css';
import FileExplorer from '../FileExplorer';
import LatexBrowser from '../LatexBrowser';

// 导入子组件
import FilterSidebar from './components/FilterSidebar';
import NavigationSidebar from './components/NavigationSidebar';
import QuestionList from './components/QuestionList';
import QuestionDetail from './components/QuestionDetail';

// 导入类型和工具函数
import { QuestionItem, QuestionStats } from './types';
import { safeParseInt, safeParseFloat } from './utils';

const { Content } = Layout;

const QuestionManagement: React.FC = () => {
  const { teacher, token } = useAuth();
  const { permissions } = usePermissions();
  
  // 筛选条件状态
  const [subject, setSubject] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [questionType, setQuestionType] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [selectionStatus, setSelectionStatus] = useState<'all' | 'selected' | 'unselected'>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // 数据状态
  const [loading, setLoading] = useState<boolean>(false);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<QuestionItem[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
  const [recentlySelectedIds, setRecentlySelectedIds] = useState<number[]>([]);
  const [recentlyCanceledIds, _setRecentlyCanceledIds] = useState<number[]>([]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [pageSize, _setPageSize] = useState<number>(10);
  
  // 模式切换状态
  const [activeTab, setActiveTab] = useState<string>('all');
  
  // 调试模式状态
  const [debugMode, setDebugMode] = useState<boolean>(true);
  
  // 右侧导航状态
  const [rightTabActive, setRightTabActive] = useState<string>('selection');
  const [selectedDetailQuestion, setSelectedDetailQuestion] = useState<QuestionItem | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // 定时器引用
  const recentlySelectedTimeoutRef = useRef<number | null>(null);
  const recentlyCanceledTimeoutRef = useRef<number | null>(null);
  
  // 添加文件浏览器相关状态
  const [_showFileExplorer, _setShowFileExplorer] = useState<boolean>(false);
  
  // 初始化加载
  useEffect(() => {
    if (teacher?.id) {
      fetchQuestions();
    }
  }, [teacher, subject, year, questionType, grade, selectionStatus, currentPage, activeTab]);
  
  // 搜索关键词变化时过滤题目
  useEffect(() => {
    if (searchKeyword.trim() === '') {
      setFilteredQuestions(questions);
      return;
    }
    
    const keyword = searchKeyword.toLowerCase();
    const filtered = questions.filter(question => 
      (question.folder_name && question.folder_name.toLowerCase().includes(keyword)) ||
      question.subject.toLowerCase().includes(keyword) ||
      question.grade.toLowerCase().includes(keyword) ||
      question.year.toLowerCase().includes(keyword) ||
      question.question_type.toLowerCase().includes(keyword)
    );
    
    setFilteredQuestions(filtered);
  }, [searchKeyword, questions]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (recentlySelectedTimeoutRef.current) {
        window.clearTimeout(recentlySelectedTimeoutRef.current);
      }
      if (recentlyCanceledTimeoutRef.current) {
        window.clearTimeout(recentlyCanceledTimeoutRef.current);
      }
    };
  }, []);
  
  // 获取题目数据
  const fetchQuestions = async () => {
    if (!teacher?.id) return;
    
    setLoading(true);
    try {
      // 先获取题目的select状态，这样可以确保我们有准确的选中状态信息
      let selectStatusMap: Record<string, {
        question_id: number;
        question_type: string;
        select: string;
        is_selected: boolean;
      }> = {};
      
      try {
        const selectStatusResponse = await axios.get('http://localhost:3003/api/questions/select-status', {
          params: { teacherId: teacher.id },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (debugMode) {
          console.log('数据库select状态信息:', selectStatusResponse.data);
        }
        
        selectStatusMap = selectStatusResponse.data.statusMap || {};
      } catch (error) {
        console.error('获取select状态失败:', error);
      }
      
      // 构建API请求参数，现在使用后端筛选
      const url = 'http://localhost:3003/api/questions';
      const params = {
        teacherId: teacher.id,
        subject,
        year,
        type: questionType,
        grade,
        selectionStatus, // 这个参数在后端用于筛选已选入/未选入的题目
        page: currentPage,
        limit: pageSize,
        tab: activeTab,
        // 添加随机参数，避免缓存
        _t: new Date().getTime()
      };
      
      if (debugMode) {
        console.log('获取题目, 参数:', params);
      }
      
      // 然后获取题目列表
      const response = await axios.get(url, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (debugMode) {
        console.log('题目数据响应:', response.data);
      }
      
      // 处理题目数据
      if (response.data.questions) {
        // 确保服务器返回的is_selected字段被正确解析为布尔值
        // 通过与selectStatusMap对比，确定真实的选中状态
        const processedQuestions = response.data.questions.map((q: any) => {
          const key = `${q.type}-${q.id}`;
          
          // 优先使用selectStatusMap中的select字段来决定选中状态
          const statusFromDB = selectStatusMap[key];
          
          // 只有当select字段为'1'时才视为已选入
          const isSelectedFromDB = statusFromDB && statusFromDB.select === '1';
          
          // 现在我们严格只使用数据库中的select字段
          // 如果没有找到对应的记录，则默认为未选入状态
          const finalIsSelected = isSelectedFromDB || false;
          
          if (debugMode) {
            console.log(`题目ID: ${q.id}, 类型: ${q.type}, 原始is_selected值: ${JSON.stringify(q.is_selected)}, 数据库select值: ${statusFromDB?.select}, 最终选中状态: ${finalIsSelected}`);
          }
          
          return {
            ...q,
            is_selected: finalIsSelected
          };
        });
        
        if (debugMode) {
          console.log('处理后的题目数据:', processedQuestions);
        }
        
        // 应用前端筛选（作为后端筛选的补充）
        let filteredBySelectStatus = processedQuestions;
        
        // 使用processedQuestions中的is_selected进行筛选
        if (selectionStatus === 'selected') {
          filteredBySelectStatus = processedQuestions.filter((q: any) => q.is_selected);
        } else if (selectionStatus === 'unselected') {
          filteredBySelectStatus = processedQuestions.filter((q: any) => !q.is_selected);
        }
        
        if (debugMode && filteredBySelectStatus.length !== processedQuestions.length) {
          console.log(`前端筛选: 从 ${processedQuestions.length} 条记录中筛选出 ${filteredBySelectStatus.length} 条`);
        }
        
        setQuestions(filteredBySelectStatus);
        setFilteredQuestions(filteredBySelectStatus);
        setTotalQuestions(response.data.total || processedQuestions.length);
        
        // 更新已选择的题目IDs (仅临时选择状态)
        // 这里只包含数据库中标记为已选入的题目ID
        const selectedIds = filteredBySelectStatus
          .filter((q: QuestionItem) => q.is_selected)
          .map((q: QuestionItem) => q.id);
        setSelectedQuestionIds(selectedIds);
      } else {
        setQuestions([]);
        setFilteredQuestions([]);
        setTotalQuestions(0);
        setSelectedQuestionIds([]);
      }
    } catch (error) {
      console.error('获取题目失败:', error);
      notification.error({
        message: '获取失败',
        description: '获取题目数据失败，请刷新页面重试',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 处理筛选条件变更
  const handleFilterChange = () => {
    // 重置为第一页并重新获取题目
    setCurrentPage(1);
    
    if (debugMode) {
      console.log('筛选条件变更:', {
        subject,
        year,
        questionType,
        grade,
        selectionStatus
      });
    }
    
    fetchQuestions();
  };
  
  // 修改处理题目选择状态变更的函数
  const handleQuestionSelect = (questionId: number, checked: boolean) => {
    // 如果题目已经被选入，不允许通过复选框取消选择
    // 已选中的题目需要通过"取消选入"按钮来操作
    if (questions.find(q => q.id === questionId)?.is_selected) {
      return;
    }

    if (checked) {
      // 添加到已选择列表
      setSelectedQuestionIds(prev => [...prev, questionId]);
      
      // 添加到最近选择的列表，用于视觉反馈
      setRecentlySelectedIds(prev => [...prev, questionId]);
      
      // 设置定时器清除视觉反馈
      if (recentlySelectedTimeoutRef.current) {
        window.clearTimeout(recentlySelectedTimeoutRef.current);
      }
      recentlySelectedTimeoutRef.current = window.setTimeout(() => {
        setRecentlySelectedIds([]);
      }, 2000);
    } else {
      // 从已选择列表中移除
      setSelectedQuestionIds(prev => prev.filter(id => id !== questionId));
    }
    
    // 检查是否所有可选择的题目都已选中
    const selectableQuestions = filteredQuestions.filter(q => !q.is_selected);
    const newSelectedIds = checked 
      ? [...selectedQuestionIds, questionId]
      : selectedQuestionIds.filter(id => id !== questionId);
    
    setIsAllSelected(
      selectableQuestions.length > 0 && 
      selectableQuestions.every(q => newSelectedIds.includes(q.id))
    );
  };
  
  // 全选/取消全选当前页面的题目
  const handleSelectAllQuestions = (checked: boolean) => {
    if (checked) {
      // 获取当前页面显示的所有未选入的题目的ID
      const selectableQuestionIds = filteredQuestions
        .filter(q => !q.is_selected)
        .map(q => q.id);
      
      if (selectableQuestionIds.length === 0) {
        // 使用Modal替代message，避免React 19兼容性问题
        Modal.info({
          title: '提示',
          content: '当前页面没有可选择的题目',
          okText: '确定'
        });
        return;
      }
      
      // 将这些ID全部添加到已选择列表中
      setSelectedQuestionIds(prev => {
        const uniqueIds = new Set([...prev, ...selectableQuestionIds]);
        return Array.from(uniqueIds);
      });
      
      // 添加到最近选择的列表，用于视觉反馈
      setRecentlySelectedIds(selectableQuestionIds);
      
      // 设置定时器清除视觉反馈
      if (recentlySelectedTimeoutRef.current) {
        window.clearTimeout(recentlySelectedTimeoutRef.current);
      }
      recentlySelectedTimeoutRef.current = window.setTimeout(() => {
        setRecentlySelectedIds([]);
      }, 2000);
      
      setIsAllSelected(true);
      
      // 使用notification替代message，避免React 19兼容性问题
      notification.success({
        message: '批量选择成功',
        description: `已选择 ${selectableQuestionIds.length} 道题目`,
        placement: 'topRight'
      });
    } else {
      // 获取当前页面显示的所有未正式选入但被临时选中的题目的ID
      const currentPageQuestionIds = filteredQuestions
        .filter(q => !q.is_selected && selectedQuestionIds.includes(q.id))
        .map(q => q.id);
      
      if (currentPageQuestionIds.length === 0) {
        // 使用Modal替代message，避免React 19兼容性问题
        Modal.info({
          title: '提示',
          content: '没有可取消的临时选择',
          okText: '确定'
        });
        return;
      }
      
      // 从已选择列表中移除这些ID
      setSelectedQuestionIds(prev => 
        prev.filter(id => !currentPageQuestionIds.includes(id))
      );
      
      setIsAllSelected(false);
      
      // 使用notification替代message，避免React 19兼容性问题
      notification.info({
        message: '取消选择',
        description: `已取消选择 ${currentPageQuestionIds.length} 道题目`,
        placement: 'topRight'
      });
    }
  };
  
  // 批量选入题目
  const handleBatchSelect = () => {
    console.log('【按钮调试】批量选入按钮被点击');

    // 检查权限
    if (!permissions.canModifyQuestions) {
      notification.error({
        message: '权限不足',
        description: '您没有修改题库的权限',
        placement: 'topRight'
      });
      return;
    }

    if (!selectedQuestionIds.length) {
      notification.warning({
        message: '无法选入',
        description: '请至少选择一道题目',
        placement: 'topRight'
      });
      return;
    }
    
    console.log('【按钮调试】selectedQuestionIds:', selectedQuestionIds);
    
    // 获取所有"已临时选择"但未在数据库中标记为"已选入"的题目
    const tempSelectedQuestions = questions.filter(q => selectedQuestionIds.includes(q.id));
    console.log('【按钮调试】临时选择的题目:', tempSelectedQuestions.map(q => ({id: q.id, is_selected: q.is_selected, type: q.type})));
    
    const newQuestionIds = tempSelectedQuestions
      .filter(q => !q.is_selected)
      .map(q => q.id);
    
    console.log('【按钮调试】计算出需要选入的题目IDs:', newQuestionIds);
    
    if (newQuestionIds.length === 0) {
      notification.info({
        message: '提示',
        description: '所选题目已全部选入',
        placement: 'topRight'
      });
      return;
    }
    
    // 跳过确认对话框，直接调用提交函数进行测试
    console.log('【按钮调试】直接调用submitBatchSelect进行测试，不使用对话框');
    submitBatchSelect(newQuestionIds);
  };
  
  // 单独的提交函数，与UI交互分离
  const submitBatchSelect = async (questionIds: number[]): Promise<boolean> => {
    console.log('【提交调试】开始提交批量选入请求, questionIds:', questionIds);
    
    if (!questionIds.length || !teacher?.id) {
      console.log('【提交调试】参数无效:', { questionIds, teacherId: teacher?.id });
      notification.error({
        message: '操作失败',
        description: questionIds.length ? '教师信息未加载，请刷新页面重试' : '请至少选择一道题目',
        placement: 'topRight'
      });
      return false;
    }
    
    setLoading(true);
    console.log('【提交调试】设置loading状态为true');
    
    try {
      // 为每个ID找到对应的题目类型
      const questionDetails = questionIds.map(id => {
        const question = questions.find(q => q.id === id);
        return {
          id,
          type: question?.type || 'unknown'
        };
      });
      
      console.log('【提交调试】题目详情:', questionDetails);
      
      // 筛选出类型已知的题目
      const validQuestions = questionDetails.filter(q => q.type !== 'unknown');
      
      if (validQuestions.length === 0) {
        notification.error({
          message: '操作失败',
          description: '无法确定题目类型，请刷新页面重试',
          placement: 'topRight'
        });
        setLoading(false);
        return false;
      }
      
      // 准备请求数据，包含题目类型信息
      const requestData = {
        teacherId: teacher.id,
        questionIds, // 保留简单的ID数组格式
        questionTypes: validQuestions.map(q => q.type) // 添加类型信息数组
      };
      
      console.log('【提交调试】请求数据:', requestData);
      
      // 最简单的方式发送请求
      console.log('【提交调试】发送请求到:', 'http://localhost:3003/api/questions/select');
      const response = await axios.post(
        'http://localhost:3003/api/questions/select',
        requestData,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('【提交调试】收到响应:', response.data);
      
      if (response.data.selectedCount > 0) {
        notification.success({
          message: '选入成功',
          description: `已成功选入 ${response.data.selectedCount} 道题目`,
          placement: 'topRight'
        });
        
        // 清除临时选择状态
        console.log('【提交调试】清除临时选择状态');
        setSelectedQuestionIds([]);
        setIsAllSelected(false);
        
        // 优化：在重新获取数据前，先更新本地状态以提供即时反馈
        console.log('【提交调试】更新本地状态');
        setQuestions(prev => {
          const updated = prev.map(q => 
            questionIds.includes(q.id) 
              ? { ...q, is_selected: true } 
              : q
          );
          console.log('【提交调试】更新后的题目状态示例:', updated.slice(0, 3));
          return updated;
        });
        
        // 更新临时筛选的题目
        setFilteredQuestions(prev => 
          prev.map(q => 
            questionIds.includes(q.id) 
              ? { ...q, is_selected: true } 
              : q
          )
        );
        
        // 强制刷新页面，确保显示最新状态
        console.log('【提交调试】设置延迟重新获取数据');
        setTimeout(() => {
          console.log('【提交调试】开始重新获取数据');
          fetchQuestions();
        }, 1500); // 增加延迟时间，确保后端数据已更新
        
        return true;
      } else {
        notification.info({
          message: '选入结果',
          description: `已选入 ${response.data.selectedCount}/${response.data.totalCount} 道题目`,
          placement: 'topRight'
        });
        console.log('【提交调试】选入结果为0，可能是题目已经选入或后端处理错误');
        return false;
      }
    } catch (error: any) {
      console.error('【提交调试】批量选入失败:', error);
      
      let errorMessage = '未知错误';
      if (error.response) {
        console.error('【提交调试】响应错误:', {
          status: error.response.status,
          data: error.response.data
        });
        errorMessage = error.response.data?.message || `服务器响应错误(${error.response.status})`;
      } else if (error.request) {
        console.error('【提交调试】请求错误 - 未收到响应');
        errorMessage = '服务器未响应，请检查网络连接';
      } else {
        console.error('【提交调试】其他错误:', error.message);
        errorMessage = error.message;
      }
      
      notification.error({
        message: '选入失败',
        description: `操作未完成: ${errorMessage}`,
        placement: 'topRight'
      });
      return false;
    } finally {
      console.log('【提交调试】设置loading状态为false');
      setLoading(false);
    }
  };
  
  // 取消选入题目
  const handleDeselectQuestion = (question: any) => {
    console.log('===================================');
    console.log('【前端】开始取消选择题目');
    console.log('【前端】时间:', new Date().toISOString());
    console.log('【前端】题目数据:', question);
    
    // 检查权限
    if (!permissions.canModifyQuestions) {
      notification.error({
        message: '权限不足',
        description: '您没有修改题库的权限',
        placement: 'topRight'
      });
      return;
    }
    
    // 由于已选入的题目卡片上只会显示"取消选入"按钮，所以不需要再次检查选中状态
    // 直接处理取消选入操作
    
    // 确认题目类型
    const questionType = question.type || question.question_type;
    if (!questionType) {
      console.log('【前端】获取题目类型失败，类型未定义');
      message.error('获取题目类型失败，请刷新页面重试');
      return;
    }

    console.log('【前端】处理题目信息：', {
      id: question.id,
      type: questionType,
      teacherId: teacher?.id
    });
    
    // 直接执行取消选入操作，不显示确认对话框
    submitDeselect(question.id, questionType);
  };

  // 提交取消选择请求
  const submitDeselect = async (questionId: string | number, questionType: string) => {
    try {
      // 确保teacherId存在
      if (!teacher?.id) {
        console.error('【前端】teacherId不存在，无法发送取消选择请求');
        message.error('教师ID不存在，请重新登录');
        return;
      }
      
      console.log('【前端】发送取消选择请求:', {
        teacherId: teacher?.id,
        questionId,
        questionType
      });
      
      setLoading(true);
      const response = await axios.post('http://localhost:3003/api/questions/deselect', {
        teacherId: teacher?.id,
        questionId,
        questionType
      },{
      headers: { Authorization: `Bearer ${token}` }
    });
      
      console.log('【前端】取消选择请求成功:', response.data);
      
      // 刷新题目列表
      message.success('取消选择成功');
      fetchQuestions(); // 重新获取题目列表
    } catch (error: any) {
      console.error('【前端】取消选择请求失败:', error);
      message.error(`取消选择失败: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
      console.log('===================================');
    }
  };

  // 批量取消选择题目
  const handleBatchDeselect = () => {
    console.log('===================================');
    console.log('【前端】开始批量取消选择题目');
    console.log('【前端】时间:', new Date().toISOString());
    
    // 检查权限
    if (!permissions.canModifyQuestions) {
      notification.error({
        message: '权限不足',
        description: '您没有修改题库的权限',
        placement: 'topRight'
      });
      return;
    }
    
    // 确保teacherId存在
    if (!teacher?.id) {
      console.error('【前端】teacherId不存在，无法执行批量取消选择');
      message.error('教师ID不存在，请重新登录');
      return;
    }
    
    // 获取已选入的题目ID列表
    const selectedQuestions = questions.filter(q => q.is_selected);
    
    if (selectedQuestions.length === 0) {
      console.log('【前端】没有已选入的题目，无法执行批量取消选择');
      message.warning('没有已选入的题目，无法执行批量取消选择');
      return;
    }
    
    console.log('【前端】已选入的题目:', selectedQuestions);
    
    // 构建questionIds和对应的questionTypes
    const questionIds = selectedQuestions.map(question => question.id);
    const questionTypes = selectedQuestions.map(question => {
      // 尝试获取类型，考虑多种可能的属性名
      const type = question.type || question.question_type;
      
      if (!type) {
        console.log('【警告】无法获取题目类型:', question);
      }
      
      return type || 'unknown';
    });
    
    console.log('【前端】准备批量取消选择:', {
      questionIds,
      questionTypes,
      teacherId: teacher.id
    });
    
    // 使用window.confirm进行二次确认
    const isConfirmed = window.confirm(`确定要取消选入这 ${questionIds.length} 道题目吗？此操作不可撤销。`);
    
    if (isConfirmed) {
      console.log('【前端】用户确认，执行批量取消选择请求');
      setLoading(true);
      
      // 使用setTimeout确保UI更新后再发送请求
      setTimeout(async () => {
        try {
          const response = await axios.post('http://localhost:3003/api/questions/batch-deselect', {
            teacherId: teacher.id,
            questionIds,
            questionTypes
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('【前端】批量取消选择请求成功:', response.data);
          
          message.success(`成功取消选择 ${response.data.successCount}/${questionIds.length} 道题目`);
          
          // 刷新题目列表
          fetchQuestions();
        } catch (error: any) {
          console.error('【前端】批量取消选择请求失败:', error);
          message.error(`批量取消选择失败: ${error.response?.data?.message || error.message}`);
        } finally {
          setLoading(false);
          console.log('===================================');
        }
      }, 100);
    } else {
      console.log('【前端】用户取消操作');
    }
  };
  
  // 批量取消选择（临时选择的题目）
  const handleBatchCancelSelection = () => {
    // 过滤出临时选择但未正式选入的题目ID
    const cancelIds = selectedQuestionIds.filter(id => 
      !questions.find(q => q.id === id)?.is_selected
    );
    
    if (cancelIds.length === 0) {
      notification.info({
        message: '提示',
        description: '没有可取消的临时选择',
        placement: 'topRight'
      });
      return;
    }
    
    // 清空临时选择的ID
    setSelectedQuestionIds(prev => 
      prev.filter(id => questions.find(q => q.id === id)?.is_selected)
    );
    
    setIsAllSelected(false);
    
    notification.success({
      message: '操作成功',
      description: `已取消 ${cancelIds.length} 道题目的临时选择`,
      placement: 'topRight'
    });
  };
  
  // 新增: 加载题目详细统计信息
  const fetchQuestionStats = async (question: QuestionItem) => {
    if (!teacher?.id || !question) return;
    
    setStatsLoading(true);
    try {
      const response = await axios.get(`http://localhost:3003/api/questions/${question.id}/stats`, {
        params: {
          teacherId: teacher.id,
          questionType: question.type
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (debugMode) {
        console.log('题目统计数据原始响应:', response);
        console.log('题目统计数据:', response.data);
        console.log('平均评分数据类型:', typeof response.data.averageRating);
        console.log('平均评分原始值:', response.data.averageRating);
        console.log('评分学生数数据类型:', typeof response.data.studentCount);
        console.log('评分学生数原始值:', response.data.studentCount);
      }
      
      // 对返回值结构进行验证，确保数据可用
      if (!response.data || typeof response.data !== 'object') {
        if (debugMode) {
          console.error('API返回数据格式异常:', response.data);
        }
        message.error('获取题目统计数据格式异常');
        return;
      }
      
      // 处理数据，确保类型正确
      const processedData = {
        id: question.id,
        type: question.type,
        starCount: safeParseInt(response.data.starCount, 0),
        postCount: safeParseInt(response.data.postCount, 0),
        commentCount: safeParseInt(response.data.commentCount, 0),
        likeCount: safeParseInt(response.data.likeCount, 0),
        recommendCount: safeParseInt(response.data.recommendCount, 0),
        coinCount: safeParseInt(response.data.coinCount, 0),
        favoriteCount: safeParseInt(response.data.favoriteCount, 0),
        appleCount: safeParseInt(response.data.appleCount, 0),
        studentCount: safeParseInt(response.data.studentCount, 0),
        averageRating: safeParseFloat(response.data.averageRating, 0),
        lastRefreshed: response.data.lastRefreshed || new Date().toISOString(),
        relatedPosts: Array.isArray(response.data.relatedPosts) ? response.data.relatedPosts : []
      };
      
      if (debugMode) {
        console.log('处理后的统计数据:', processedData);
      }
      
      setQuestionStats(processedData);
    } catch (error) {
      console.error('获取题目统计数据失败:', error);
      message.error('获取题目统计数据失败');
      setQuestionStats(null);
    } finally {
      setStatsLoading(false);
    }
  };
  
  // 新增: 刷新题目统计信息
  const refreshQuestionStats = async () => {
    if (!selectedDetailQuestion) return;
    if (!teacher?.id) {
      message.error('未获取到教师信息，请重新登录');
      return;
    }
    
    setStatsLoading(true);
    try {
      if (debugMode) {
        console.log('刷新请求参数:', {
          teacherId: teacher.id,
          questionType: selectedDetailQuestion.type
        });
        // 记录刷新前的状态
        console.log('刷新前的统计数据:', questionStats);
      }
      
      const response = await axios.post(`http://localhost:3003/api/questions/${selectedDetailQuestion.id}/refresh-stats`, {
        teacherId: teacher.id,
        questionType: selectedDetailQuestion.type
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (debugMode) {
        console.log('刷新统计数据原始响应:', response);
        console.log('刷新统计数据:', response.data);
        console.log('刷新后平均评分数据类型:', typeof response.data.averageRating);
        console.log('刷新后平均评分原始值:', response.data.averageRating);
        console.log('刷新后评分学生数数据类型:', typeof response.data.studentCount);
        console.log('刷新后评分学生数原始值:', response.data.studentCount);
      }
      
      // 对返回值结构进行验证，确保数据可用
      if (!response.data || typeof response.data !== 'object') {
        if (debugMode) {
          console.error('刷新API返回数据格式异常:', response.data);
        }
        message.error('刷新题目统计数据格式异常');
        return;
      }
      
      // 获取当前统计数据作为基础
      const previousStats = questionStats || {
        id: selectedDetailQuestion.id,
        type: selectedDetailQuestion.type,
        starCount: 0,
        postCount: 0,
        commentCount: 0,
        likeCount: 0,
        recommendCount: 0,
        coinCount: 0,
        favoriteCount: 0,
        appleCount: 0,
        studentCount: 0,
        averageRating: 0,
        lastRefreshed: new Date().toISOString(),
        relatedPosts: []
      };
      
      // 使用与fetchQuestionStats相同的数据处理方式
      const processedData = {
        id: selectedDetailQuestion.id,
        type: selectedDetailQuestion.type,
        starCount: safeParseInt(response.data.starCount, previousStats.starCount),
        postCount: safeParseInt(response.data.postCount, previousStats.postCount),
        commentCount: safeParseInt(response.data.commentCount, previousStats.commentCount),
        likeCount: safeParseInt(response.data.likeCount, previousStats.likeCount),
        recommendCount: safeParseInt(response.data.recommendCount, previousStats.recommendCount),
        coinCount: safeParseInt(response.data.coinCount, previousStats.coinCount),
        favoriteCount: safeParseInt(response.data.favoriteCount, previousStats.favoriteCount),
        appleCount: safeParseInt(response.data.appleCount, previousStats.appleCount),
        studentCount: safeParseInt(response.data.studentCount, previousStats.studentCount),
        averageRating: safeParseFloat(response.data.averageRating, previousStats.averageRating),
        lastRefreshed: response.data.lastRefreshed || new Date().toISOString(),
        relatedPosts: Array.isArray(response.data.relatedPosts) ? response.data.relatedPosts : previousStats.relatedPosts
      };
      
      // 检查刷新后的学生人数是否与之前不同，如果不同则保留之前的数据
      if (previousStats.studentCount > 0 && processedData.studentCount !== previousStats.studentCount) {
        console.warn('【数据不一致警告】学生人数不一致', {
          题目ID: selectedDetailQuestion.id,
          题目类型: selectedDetailQuestion.type,
          之前人数: previousStats.studentCount,
          刷新后人数: processedData.studentCount,
          之前评分: previousStats.averageRating,
          刷新后评分: processedData.averageRating,
          之前总评分: previousStats.appleCount,
          刷新后总评分: processedData.appleCount,
          时间: new Date().toLocaleString()
        });
        
        // 保留之前的数据
        processedData.studentCount = previousStats.studentCount;
        processedData.averageRating = previousStats.averageRating;
        processedData.appleCount = previousStats.appleCount;
        
        // 不显示错误消息，但在控制台中标记
        console.warn('【已自动修复】保留了之前的评分数据，避免数据显示错误');
      }
      
      // 特殊逻辑：如果新数据中学生人数和评分都归零，但原来有值，则保留原来的值
      if (processedData.studentCount === 0 && previousStats.studentCount > 0 &&
          processedData.averageRating === 0 && previousStats.averageRating > 0) {
        if (debugMode) {
          console.warn('刷新后评分数据异常归零，保留原有数据:', {
            averageRating: previousStats.averageRating,
            studentCount: previousStats.studentCount
          });
        }
        processedData.averageRating = previousStats.averageRating;
        processedData.studentCount = previousStats.studentCount;
      }
      
      if (debugMode) {
        console.log('处理后的刷新统计数据:', processedData);
      }
      
      setQuestionStats(processedData);
      message.success('题目统计数据已更新');
    } catch (error) {
      console.error('刷新题目统计数据失败:', error);
      message.error('刷新题目统计数据失败');
      // 出错时不重新获取，保留原有数据
    } finally {
      setStatsLoading(false);
    }
  };
  
  // 新增: 选择要查看详情的题目
  const handleSelectDetailQuestion = (question: QuestionItem) => {
    setSelectedDetailQuestion(question);
    setRightTabActive('details');
    fetchQuestionStats(question);
  };
  
  // 切换调试模式
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };
  
  // 处理页码变更
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <FilterSidebar 
        subject={subject}
        setSubject={setSubject}
        grade={grade}
        setGrade={setGrade}
        year={year}
        setYear={setYear}
        questionType={questionType}
        setQuestionType={setQuestionType}
        selectionStatus={selectionStatus}
        setSelectionStatus={setSelectionStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleFilterChange={handleFilterChange}
        fetchQuestions={fetchQuestions}
        selectedQuestionIds={selectedQuestionIds}
        questions={questions}
        handleBatchSelect={handleBatchSelect}
        handleBatchCancelSelection={handleBatchCancelSelection}
        canModifyQuestions={permissions.canModifyQuestions}
        setCurrentPage={setCurrentPage}
      />
      
      <Content style={{ padding: '16px 24px', minWidth: '70%', minHeight: 280, display: rightTabActive === 'selection' ? 'block' : 'none' }}>
        <QuestionList 
          loading={loading}
          filteredQuestions={filteredQuestions}
          selectedQuestionIds={selectedQuestionIds}
          recentlySelectedIds={recentlySelectedIds}
          recentlyCanceledIds={recentlyCanceledIds}
          isAllSelected={isAllSelected}
          handleQuestionSelect={handleQuestionSelect}
          handleSelectAllQuestions={handleSelectAllQuestions}
          handleSelectDetailQuestion={handleSelectDetailQuestion}
          submitBatchSelect={submitBatchSelect}
          handleDeselectQuestion={handleDeselectQuestion}
          handleBatchDeselect={handleBatchDeselect}
          searchKeyword={searchKeyword}
          setSearchKeyword={setSearchKeyword}
          currentPage={currentPage}
          totalQuestions={totalQuestions}
          pageSize={pageSize}
          handlePageChange={handlePageChange}
          selectionStatus={selectionStatus}
          questions={questions}
          debugMode={debugMode}
          canModifyQuestions={permissions.canModifyQuestions}
        />
      </Content>
      
      {/* 详情内容区域 */}
      <Content style={{ padding: '16px 24px', minHeight: 280, display: rightTabActive === 'details' ? 'block' : 'none' }}>
        <QuestionDetail 
          selectedDetailQuestion={selectedDetailQuestion}
          questionStats={questionStats}
          statsLoading={statsLoading}
          refreshQuestionStats={refreshQuestionStats}
        />
      </Content>
      
      {/* 文件浏览器内容区域 */}
      <Content style={{ padding: '16px 24px', minHeight: 280, display: rightTabActive === 'files' ? 'block' : 'none' }}>
        <FileExplorer />
      </Content>
      
      {/* LaTeX浏览器内容区域 */}
      <Content style={{ padding: '16px 24px', minHeight: 280, display: rightTabActive === 'latex' ? 'block' : 'none' }}>
        <LatexBrowser />
      </Content>
      
      {/* 右侧导航栏 */}
      <NavigationSidebar 
        rightTabActive={rightTabActive}
        setRightTabActive={setRightTabActive}
        selectedDetailQuestion={selectedDetailQuestion}
      />
      
      {/* 调试模式开关 */}
      {debugMode && (
        <div 
          style={{ 
            position: 'fixed', 
            bottom: '10px', 
            right: '10px', 
            background: '#f0f0f0', 
            padding: '4px 8px', 
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 1000
          }}
          onClick={toggleDebugMode}
        >
          调试模式: 开启
        </div>
      )}
    </Layout>
  );
};

export default QuestionManagement; 