import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Select, Button, Table, Card, Tabs, Spin, Empty, message, Tooltip, Tag, Pagination, Radio } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { DownloadOutlined, FileTextOutlined, LinkOutlined, BarChartOutlined, ClockCircleOutlined, BookOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs from 'dayjs';
import './Records.css';

const { RangePicker } = DatePicker;
const { Option } = Select;
// const { TabPane } = Tabs;

// 题目路径字段类型
interface QuestionPathInfo {
  type: string;       // 例如: "prtsc"
  subject: string;    // 例如: "线性代数"
  grade: string;      // 例如: "大一"
  year: string;       // 例如: "2019"
  examType: string;   // 例如: "A卷"
  timeId: string;     // 例如: "20250320T115848"
}

interface AnswerRecord {
  id: number;
  question_path: string;
  attempt_count: number;
  answer_content: string;
  correctness: 'correct' | 'partially_correct' | 'incorrect';
  answer_time: string;
  pathInfo?: QuestionPathInfo; // 修改为可选属性，不使用 null
}

interface QuestionStats {
  question_path: string;
  total_attempts: number;
  correct_count: number;
  incorrect_count: number;
  partially_correct_count: number;
  error_rate: number;
  last_attempt_time: string;
  pathInfo?: QuestionPathInfo; // 添加 pathInfo 属性
}

interface DateStat {
  date: string;
  total: number;
  correct: number;
  incorrect: number;
  partially_correct: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// 日志记录函数
const logAction = (action: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    details,
  };
  
  // 获取现有日志
  let logs = [];
  try {
    const storedLogs = localStorage.getItem('records_activity_logs');
    if (storedLogs) {
      logs = JSON.parse(storedLogs);
    }
  } catch (error) {
    console.error('Error parsing logs:', error);
  }
  
  // 添加新日志条目
  logs.push(logEntry);
  
  // 如果日志太长，只保留最近1000条
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }
  
  // 保存日志到 localStorage
  localStorage.setItem('records_activity_logs', JSON.stringify(logs));
  
  // 同时将日志输出到控制台
  console.log(`[LOG] ${timestamp} - ${action}`, details);
};

// 导出日志为文件
const exportLogs = () => {
  try {
    const storedLogs = localStorage.getItem('records_activity_logs');
    if (!storedLogs) {
      message.info('没有日志记录可导出');
      return;
    }
    
    const logs = JSON.parse(storedLogs);
    const logText = logs.map((log: any) => {
      return `${log.timestamp} - ${log.action} - ${log.details ? JSON.stringify(log.details) : ''}`;
    }).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = `activity_logs_${dayjs().format('YYYY-MM-DD')}.txt`;
    
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('日志导出成功');
    logAction('日志导出', { count: logs.length });
  } catch (error) {
    console.error('Error exporting logs:', error);
    message.error('日志导出失败');
  }
};

// 构建题目URL
const buildQuestionUrl = (path: string): string => {
  // 确保路径格式正确
  if (!path) return '#';
  
  console.log('原始路径:', path);
  
  // 新的路径处理方式，根据Exams.tsx的逻辑
  let processedPath = path;
  let questionType = 'image'; // 默认类型
  
  // 解析路径组件
  const parts = path.split('/').filter(p => p.length > 0);
  console.log('路径部分:', parts);
  
  // 智能判断题目类型
  // 某些学科的题目通常是latex格式
  const latexSubjects = ['电磁场', '量子力学', '理论力学', '数学分析', '高等代数'];
  if (parts.length >= 2 && latexSubjects.includes(parts[1])) {
    console.log('检测到可能的latex题目学科:', parts[1]);
    questionType = 'latex';
  }
  
  if (parts.length >= 6) {
    // 路径具有完整的结构：[类型, 学科, 年级, 年份, 试卷类型, 题目ID]
    const pathType = parts[0];
    
    // 始终将路径类型替换为 prtsc，因为服务器只接受这种类型
    if (pathType !== 'prtsc') {
      // 保留其他所有部分，但替换类型部分
      const otherParts = parts.slice(1).join('/');
      processedPath = `/prtsc/${otherParts}`;
      console.log('替换类型前缀后的路径:', processedPath);
    }
  } else {
    // 如果路径结构不完整，尝试保持原样但确保有prtsc前缀
    if (!path.includes('/prtsc/')) {
      // 如果路径不包含/prtsc/，添加前缀
      processedPath = path.startsWith('/') 
        ? `/prtsc${path}` 
        : `/prtsc/${path}`;
      console.log('添加prtsc前缀后的路径:', processedPath);
    }
  }
  
  // 尝试从路径中提取Id（Latex类型可能需要）
  let questionId = null;
  if (questionType === 'latex' && parts.length >= 6) {
    // 从路径的最后一部分提取时间戳ID
    const folderName = parts[5] || '';
    // 生成数字ID
    questionId = generateQuestionId(folderName);
    console.log('为latex题目生成ID:', questionId);
  }
  
  // 创建URL对象并添加参数
  const url = new URL('/question', window.location.origin);
  
  // 确保processedPath以/开头
  if (!processedPath.startsWith('/')) {
    processedPath = `/${processedPath}`;
  }
  
  url.searchParams.append('path', processedPath);
  url.searchParams.append('type', questionType);
  
  // 如果有ID，添加到URL
  if (questionId) {
    url.searchParams.append('id', questionId.toString());
  }
  
  console.log('生成URL对象:', url);
  console.log('生成URL字符串:', url.toString());
  console.log('生成pathname+search:', url.pathname + url.search);
  
  // 返回访问QuestionView组件的URL，不包括域名部分
  return url.pathname + url.search;
};

// 生成题目ID
const generateQuestionId = (folderName: string): number => {
  // 使用文件夹名称的哈希值作为ID
  let hash = 0;
  for (let i = 0; i < folderName.length; i++) {
    const char = folderName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 确保ID为正数
  return Math.abs(hash);
};

const Records = () => {
  const navigate = useNavigate();
  const [answerRecords, setAnswerRecords] = useState<AnswerRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [errorRateFilter, setErrorRateFilter] = useState<string | null>(null);
  const [attemptCountFilter, setAttemptCountFilter] = useState<number | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const [dateStats, setDateStats] = useState<DateStat[]>([]);
  const [activeTab, setActiveTab] = useState('records');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [examTypeFilter, setExamTypeFilter] = useState<string | null>(null);
  
  // 用于存储所有可能的筛选选项
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [examTypeOptions, setExamTypeOptions] = useState<string[]>([]);
  const [tablePageSize, setTablePageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [statsTabType, setStatsTabType] = useState<string>('all');

  // 解析题目路径，提取关键信息
  const parseQuestionPath = (path: string): QuestionPathInfo | null => {
    // 期望格式: "prtsc/线性代数/大一/2019/A卷/20250320T115848"
    const parts = path.split('/').filter(p => p.length > 0);
    
    if (parts.length >= 6) {
      return {
        type: parts[0] || '',
        subject: parts[1] || '',
        grade: parts[2] || '',
        year: parts[3] || '',
        examType: parts[4] || '',
        timeId: parts[5] || ''
      };
    }
    
    return null;
  };

  // 处理记录数据，解析路径信息
  const processRecords = (records: AnswerRecord[]): AnswerRecord[] => {
    // 提取所有可能的选项，用于筛选下拉框
    const subjects = new Set<string>();
    const grades = new Set<string>();
    const years = new Set<string>();
    const examTypes = new Set<string>();
    
    const processedRecords = records.map(record => {
      const pathInfo = parseQuestionPath(record.question_path);
      
      if (pathInfo) {
        // 收集筛选选项
        subjects.add(pathInfo.subject);
        grades.add(pathInfo.grade);
        years.add(pathInfo.year);
        examTypes.add(pathInfo.examType);
      }
      
      return {
        ...record,
        pathInfo: pathInfo || undefined // 明确使用 undefined 而非 null
      };
    });
    
    // 更新筛选选项
    setSubjectOptions(Array.from(subjects).sort());
    setGradeOptions(Array.from(grades).sort());
    setYearOptions(Array.from(years).sort((a, b) => Number(b) - Number(a))); // 年份降序
    setExamTypeOptions(Array.from(examTypes).sort());
    
    return processedRecords;
  };

  // 获取答题记录
  const handleViewRecords = async () => {
    try {
      setLoading(true);
      const tokenStr = localStorage.getItem('token');
      if (!tokenStr) {
        message.error('请先登录');
        navigate('/login');
        return;
      }
      
      // 添加对token的安全解析处理
      let userId = null;
      
      try {
        // 首先尝试作为JSON解析
        const tokenData = JSON.parse(tokenStr);
        if (tokenData && tokenData.user && tokenData.user.id) {
          userId = tokenData.user.id;
          console.log('从JSON格式token获取到userId:', userId);
        }
      } catch (parseError) {
        // 如果无法作为JSON解析，可能是JWT格式
        console.log('Token不是JSON格式，可能是JWT格式:', tokenStr.substring(0, 20) + '...');
      }
      
      // 如果通过JSON解析方式没有获取到userId，尝试其他方式
      if (!userId) {
        // 尝试从localStorage单独获取userId
        userId = localStorage.getItem('userId');
        
        if (userId) {
          console.log('从localStorage直接获取userId:', userId);
        } else {
          // 后备方案：尝试解析JWT token
          try {
            // 简单解析JWT的payload部分（不做验证）
            const jwtParts = tokenStr.split('.');
            if (jwtParts.length === 3) {
              const payload = JSON.parse(atob(jwtParts[1]));
              if (payload && payload.userId) {
                userId = payload.userId;
                console.log('从JWT payload解析userId:', userId);
              } else if (payload && payload.id) {
                userId = payload.id;
                console.log('从JWT payload解析id作为userId:', userId);
              } else if (payload && payload.sub) {
                userId = payload.sub;
                console.log('从JWT payload解析sub作为userId:', userId);
              }
            }
          } catch (jwtError) {
            console.error('解析JWT失败:', jwtError);
          }
        }
      }
      
      // 如果仍然无法获取userId，则提示用户登录
      if (!userId) {
        console.error('无法获取用户ID，用户信息不完整');
        message.error('用户信息不完整，请重新登录');
        navigate('/login');
        return;
      }
      
      console.log('使用的用户ID:', userId);
      logAction('开始获取答题记录', { userId });
      
      // 首先尝试API请求
      let data = [];
      let apiSuccess = false;
      
      try {
        const response = await fetch(`http://localhost:3001/user-answers/${userId}`);
        if (response.ok) {
          data = await response.json();
          apiSuccess = true;
          logAction('从API获取答题记录成功', { count: data.length });
        } else {
          console.error('API请求返回错误状态码:', response.status);
        }
      } catch (apiError) {
        console.error('API请求失败:', apiError);
      }
      
      // 如果API失败，尝试从localStorage获取
      if (!apiSuccess) {
        console.log('API请求失败，尝试从localStorage获取记录');
        const storedRecords = localStorage.getItem('currentQuestionRecords');
        
        if (storedRecords) {
          try {
            const localData = JSON.parse(storedRecords);
            
            if (Array.isArray(localData) && localData.length > 0) {
              data = localData;
              logAction('从localStorage获取答题记录成功', { count: data.length });
              message.warning('使用本地缓存记录，可能不是最新数据');
            }
          } catch (parseError) {
            console.error('解析localStorage数据失败:', parseError);
          }
        }
      }
      
      // 如果没有数据，显示提示
      if (data.length === 0) {
        message.info('没有找到答题记录');
      } else {
        // 处理记录数据，解析路径信息
        const processedData = processRecords(data);
        
        setAnswerRecords(processedData);
        setFilteredRecords(processedData);
        calculateStats(processedData);
        
        // 如果成功从API获取了数据，更新localStorage
        if (apiSuccess) {
          localStorage.setItem('currentQuestionRecords', JSON.stringify(data));
          console.log('更新localStorage数据存储');
        }
      }
    } catch (error: any) { // 显式声明 error 为 any 类型
      console.error('Error fetching answer records:', error);
      message.error('获取答题记录失败');
      logAction('获取答题记录失败', { error: error?.message || '未知错误' });
      
      // 兜底方案：尝试从localStorage读取记录
      const storedRecords = localStorage.getItem('currentQuestionRecords');
      if (storedRecords) {
        try {
          const localData = JSON.parse(storedRecords);
          
          if (Array.isArray(localData) && localData.length > 0) {
            const processedData = processRecords(localData);
            setAnswerRecords(processedData);
            setFilteredRecords(processedData);
            calculateStats(processedData);
            message.warning('系统错误，显示本地缓存数据');
          }
        } catch (localError) {
          console.error('解析本地存储数据失败:', localError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时自动获取记录
  useEffect(() => {
    handleViewRecords();
  }, []);

  // 计算各种统计数据
  const calculateStats = (records: AnswerRecord[]) => {
    // 按题目路径分组统计
    const questionMap = new Map<string, QuestionStats>();
    
    records.forEach(record => {
      const key = record.question_path;
      const current = questionMap.get(key) || {
        question_path: key,
        total_attempts: 0,
        correct_count: 0,
        incorrect_count: 0,
        partially_correct_count: 0,
        error_rate: 0,
        last_attempt_time: '',
        pathInfo: record.pathInfo,
      };
      
      current.total_attempts += 1;
      
      if (record.correctness === 'correct') {
        current.correct_count += 1;
      } else if (record.correctness === 'incorrect') {
        current.incorrect_count += 1;
      } else if (record.correctness === 'partially_correct') {
        current.partially_correct_count += 1;
      }
      
      // 记录最新的尝试时间
      const recordTime = new Date(record.answer_time).getTime();
      const currentLastTime = current.last_attempt_time ? new Date(current.last_attempt_time).getTime() : 0;
      
      if (!current.last_attempt_time || recordTime > currentLastTime) {
        current.last_attempt_time = record.answer_time;
      }
      
      questionMap.set(key, current);
    });
    
    // 计算错误率
    const statsArray = Array.from(questionMap.values()).map(stat => {
      const errorRate = (stat.incorrect_count + stat.partially_correct_count * 0.5) / stat.total_attempts;
      return {
        ...stat,
        error_rate: parseFloat(errorRate.toFixed(2)),
      };
    });
    
    setQuestionStats(statsArray);
    
    // 按日期分组统计
    const dateMap = new Map<string, DateStat>();
    
    records.forEach(record => {
      // 使用本地时区处理日期，确保日期比较正确
      const recordDate = new Date(record.answer_time);
      const date = recordDate.toISOString().split('T')[0];
      
      // 检查是否为今天的记录
      const today = new Date();
      const isToday = recordDate.getDate() === today.getDate() &&
                    recordDate.getMonth() === today.getMonth() &&
                    recordDate.getFullYear() === today.getFullYear();
      
      // 使用实际日期或Today标记
      const dateKey = isToday ? 'Today' : date;
      
      const current = dateMap.get(dateKey) || {
        date: isToday ? '今天' : date,
        total: 0,
        correct: 0,
        incorrect: 0,
        partially_correct: 0,
      };
      
      current.total += 1;
      
      if (record.correctness === 'correct') {
        current.correct += 1;
      } else if (record.correctness === 'incorrect') {
        current.incorrect += 1;
      } else if (record.correctness === 'partially_correct') {
        current.partially_correct += 1;
      }
      
      dateMap.set(dateKey, current);
      
      // 记录处理此记录的详细信息，用于调试
      if (isToday) {
        console.log('处理今日记录:', {
          时间: record.answer_time,
          本地时间: recordDate.toLocaleString(),
          正确性: record.correctness,
          当前统计: {
            总数: current.total,
            正确: current.correct,
            错误: current.incorrect,
            部分正确: current.partially_correct,
            正确率: ((current.correct / current.total) * 100).toFixed(1) + '%'
          }
        });
      }
    });
    
    // 对日期数组进行排序，确保"今天"显示在最后
    const datesArray = Array.from(dateMap.values())
      .sort((a, b) => {
        // 把"今天"放在最后
        if (a.date === '今天') return 1;
        if (b.date === '今天') return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    
    // 输出最终的日期统计数据，用于调试
    console.log('日期统计数据:', datesArray);
    
    setDateStats(datesArray);
  };

  // 获取最大答题次数，用于生成选择器选项
  const maxAttemptCount = Math.max(...answerRecords.map(record => record.attempt_count), 0);
  const attemptOptions = Array.from({ length: maxAttemptCount }, (_, index) => index + 1);

  // 处理学科筛选变化
  const handleSubjectChange = (value: string | null) => {
    setSubjectFilter(value);
  };
  
  // 处理年级筛选变化
  const handleGradeChange = (value: string | null) => {
    setGradeFilter(value);
  };
  
  // 处理年份筛选变化
  const handleYearChange = (value: string | null) => {
    setYearFilter(value);
  };
  
  // 处理试卷类型筛选变化
  const handleExamTypeChange = (value: string | null) => {
    setExamTypeFilter(value);
  };

  // 应用筛选器
  const applyFilters = () => {
    // 记录当前筛选条件
    logAction('应用筛选条件', {
      dateRange: dateRange,
      errorRateFilter,
      attemptCountFilter,
      subjectFilter,
      gradeFilter,
      yearFilter,
      examTypeFilter
    });

    let filtered = [...answerRecords];
    
    // 应用日期筛选
    if (dateRange[0] && dateRange[1]) {
      const startDate = dateRange[0].startOf('day');
      const endDate = dateRange[1].endOf('day');
      
      filtered = filtered.filter(record => {
        const recordDate = dayjs(record.answer_time);
        return recordDate.isAfter(startDate) && recordDate.isBefore(endDate);
      });
    }
    
    // 应用错误率筛选
    if (errorRateFilter) {
      const [minRate, maxRate] = errorRateFilter.split('-').map(Number);
      
      // 使用本地计算错误率来筛选，而不是依赖预计算的统计
      filtered = filtered.filter(record => {
        // 为每个记录的路径找到其统计信息
        const stat = questionStats.find(s => s.question_path === record.question_path);
        return stat && stat.error_rate >= minRate && stat.error_rate <= maxRate;
      });
    }
    
    // 应用答题次数筛选
    if (attemptCountFilter !== null) {
      filtered = filtered.filter(record => record.attempt_count === attemptCountFilter);
    }
    
    // 应用学科筛选
    if (subjectFilter) {
      filtered = filtered.filter(record => 
        record.pathInfo && record.pathInfo.subject === subjectFilter
      );
    }
    
    // 应用年级筛选
    if (gradeFilter) {
      filtered = filtered.filter(record => 
        record.pathInfo && record.pathInfo.grade === gradeFilter
      );
    }
    
    // 应用年份筛选
    if (yearFilter) {
      filtered = filtered.filter(record => 
        record.pathInfo && record.pathInfo.year === yearFilter
      );
    }
    
    // 应用试卷类型筛选
    if (examTypeFilter) {
      filtered = filtered.filter(record => 
        record.pathInfo && record.pathInfo.examType === examTypeFilter
      );
    }
    
    // 记录筛选结果
    logAction('筛选结果', { 
      totalRecords: answerRecords.length, 
      filteredCount: filtered.length 
    });
    
    setFilteredRecords(filtered);
  };

  // 重置筛选条件
  const resetFilters = () => {
    setDateRange([null, null]);
    setErrorRateFilter(null);
    setAttemptCountFilter(null);
    setSubjectFilter(null);
    setGradeFilter(null);
    setYearFilter(null);
    setExamTypeFilter(null);
    setFilteredRecords(answerRecords);
  };

  // 处理日期范围变化
  const handleDateRangeChange: RangePickerProps['onChange'] = (dates) => {
    setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
  };

  // 处理错误率筛选变化
  const handleErrorRateChange = (value: string) => {
    setErrorRateFilter(value);
  };

  // 处理答题次数筛选变化
  const handleAttemptCountChange = (value: number | null) => {
    setAttemptCountFilter(value);
  };

  // 导出为CSV
  const exportToCSV = (records: AnswerRecord[]) => {
    if (records.length === 0) {
      message.warning('没有可导出的记录');
      return;
    }
    
    logAction('导出CSV开始', { recordCount: records.length });
    
    // 创建CSV标题行
    const headers = ['题目路径', '答题次数', '选择答案', '正确性', '答题时间'];
    
    // 将记录转换为CSV行
    const rows = records.map(record => [
      record.question_path,
      record.attempt_count,
      record.answer_content,
      record.correctness === 'correct' 
        ? '正确' 
        : record.correctness === 'partially_correct' 
          ? '部分正确' 
          : '错误',
      new Date(record.answer_time).toLocaleString()
    ]);
    
    // 合并所有行
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // 创建Blob并下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // 设置下载文件名（当前日期_答题记录.csv）
    const fileName = `${dayjs().format('YYYY-MM-DD')}_答题记录.csv`;
    
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success(`成功导出 ${records.length} 条记录`);
    logAction('导出CSV完成', { fileName, recordCount: records.length });
  };

  // 处理导出CSV文件
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      message.warning('没有可导出的记录');
      return;
    }
    exportToCSV(filteredRecords);
    logAction('export_csv', { count: filteredRecords.length });
  };

  // 处理查看题目点击事件
  const handleViewQuestionClick = (record: AnswerRecord) => {
    if (record.question_path) {
      logAction('view_question', { path: record.question_path });
      
      // 查找该题目的所有答题记录
      const questionRecords = answerRecords.filter(r => 
        r.question_path === record.question_path
      );
      
      // 在localStorage中临时存储该题目的所有答题记录
      if (questionRecords.length > 0) {
        localStorage.setItem('currentQuestionRecords', JSON.stringify(questionRecords));
      }
      
      // 使用buildQuestionUrl生成URL而不是直接使用路径
      const url = buildQuestionUrl(record.question_path);
      navigate(url);
    } else {
      message.warning('无法查看此题目，路径不存在');
    }
  };

  // 处理题目点击事件
  const handleQuestionClick = (path: string) => {
    logAction('click_question_path', { path });
    
    // 查找该题目的所有答题记录
    const questionRecords = answerRecords.filter(r => 
      r.question_path === path
    );
    
    // 在localStorage中临时存储该题目的所有答题记录
    if (questionRecords.length > 0) {
      localStorage.setItem('currentQuestionRecords', JSON.stringify(questionRecords));
    }
    
    // 使用buildQuestionUrl生成URL而不是直接使用路径
    const url = buildQuestionUrl(path);
    navigate(url);
  };

  // 处理表格页面大小变化
  const handlePageSizeChange = (_current: number, size: number) => {
    setTablePageSize(size);
    setCurrentPage(1); // 重置为第一页
    logAction('更改每页显示记录数', { newSize: size });
  };

  // 处理页码变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setCurrentPage(page);
    if (pageSize && pageSize !== tablePageSize) {
      setTablePageSize(pageSize);
    }
    logAction('切换页码', { page, pageSize });
  };

  // 获取当前页数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * tablePageSize;
    const endIndex = startIndex + tablePageSize;
    return filteredRecords.slice(startIndex, endIndex);
  };

  // 表格列定义
  const columns: ColumnsType<AnswerRecord> = [
    {
      title: '题目信息',
      key: 'question_info',
      width: 250,
      render: (_, record) => {
        if (record.pathInfo) {
          return (
            <div className="question-info-container" onClick={() => handleQuestionClick(record.question_path)}>
              <div className="question-title">
                <LinkOutlined className="link-icon" />
                <span className="path-highlight">{record.pathInfo.subject}</span>
              </div>
              <div className="question-details">
                <Tag color="blue">{record.pathInfo.grade}</Tag>
                <Tag color="purple">{record.pathInfo.year}</Tag>
                <Tag color="cyan">{record.pathInfo.examType}</Tag>
              </div>
            </div>
          );
        }
        return (
          <div className="question-path-link" onClick={() => handleQuestionClick(record.question_path)}>
            <LinkOutlined className="link-icon" />
            {record.question_path}
          </div>
        );
      }
    },
    {
      title: '原始路径',
      dataIndex: 'question_path',
      key: 'question_path',
      width: 250,
      ellipsis: true,
    },
    {
      title: '答题次数（第n次）',
      dataIndex: 'attempt_count',
      key: 'attempt_count',
      width: 150,
      sorter: (a, b) => a.attempt_count - b.attempt_count,
      render: (count) => <Tag color="geekblue">{`第 ${count} 次`}</Tag>
    },
    {
      title: '选择答案',
      dataIndex: 'answer_content',
      key: 'answer_content',
      width: 150,
      ellipsis: true,
    },
    {
      title: '正确性',
      dataIndex: 'correctness',
      key: 'correctness',
      width: 120,
      filters: [
        { text: '正确', value: 'correct' },
        { text: '部分正确', value: 'partially_correct' },
        { text: '错误', value: 'incorrect' },
      ],
      onFilter: (value, record) => record.correctness === value,
      render: (correctness) => {
        let text = '';
        let color = '';
        
        switch (correctness) {
          case 'correct':
            text = '正确';
            color = 'success';
            break;
          case 'partially_correct':
            text = '部分正确';
            color = 'warning';
            break;
          case 'incorrect':
            text = '错误';
            color = 'error';
            break;
          default:
            text = correctness;
        }
        
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '答题时间',
      dataIndex: 'answer_time',
      key: 'answer_time',
      width: 180,
      sorter: (a, b) => new Date(a.answer_time).getTime() - new Date(b.answer_time).getTime(),
      render: (text) => {
        const date = new Date(text);
        return (
          <div className="time-container">
            <div>{date.toLocaleDateString()}</div>
            <div className="time-detail">{date.toLocaleTimeString()}</div>
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small" 
          icon={<EyeOutlined />} 
          onClick={() => handleViewQuestionClick(record)}
        >
          查看题目
        </Button>
      )
    }
  ];

  // 统计图表数据
  const correctnessData = [
    { 
      name: '正确', 
      value: filteredRecords.filter(r => r.correctness === 'correct').length
    },
    { 
      name: '部分正确', 
      value: filteredRecords.filter(r => r.correctness === 'partially_correct').length
    },
    { 
      name: '错误', 
      value: filteredRecords.filter(r => r.correctness === 'incorrect').length
    }
  ];

  return (
    <div className="records-container" style={{ padding: '20px' }}>
      <Card
        title={<h2 style={{ margin: 0 }}>答题记录分析</h2>}
        extra={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button 
              type="primary" 
              onClick={handleViewRecords} 
              loading={loading}
            >
              刷新数据
            </Button>
            <Button 
              icon={<FileTextOutlined />} 
              onClick={exportLogs}
              title="导出操作日志"
            >
              导出日志
            </Button>
          </div>
        }
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          type="card"
          style={{ marginBottom: '20px' }}
          className="records-tabs"
          items={[
            {
              key: "records",
              label: "答题记录",
              children: (
                <>
                  <div className="filter-group">
                    <div className="filter-item">
                      <span className="filter-label">日期范围：</span>
                      <RangePicker 
                        value={dateRange}
                        onChange={handleDateRangeChange} 
                        style={{ width: '280px' }} 
                      />
                    </div>
                    
                    <div className="filter-item">
                      <span className="filter-label">学科：</span>
                      <Select
                        style={{ width: '120px' }}
                        value={subjectFilter}
                        onChange={handleSubjectChange}
                        allowClear
                        placeholder="选择学科"
                      >
                        {subjectOptions.map(subject => (
                          <Option key={subject} value={subject}>{subject}</Option>
                        ))}
                      </Select>
                    </div>
                    
                    <div className="filter-item">
                      <span className="filter-label">年级：</span>
                      <Select
                        style={{ width: '100px' }}
                        value={gradeFilter}
                        onChange={handleGradeChange}
                        allowClear
                        placeholder="选择年级"
                      >
                        {gradeOptions.map(grade => (
                          <Option key={grade} value={grade}>{grade}</Option>
                        ))}
                      </Select>
                    </div>
                    
                    <div className="filter-item">
                      <span className="filter-label">年份：</span>
                      <Select
                        style={{ width: '100px' }}
                        value={yearFilter}
                        onChange={handleYearChange}
                        allowClear
                        placeholder="选择年份"
                      >
                        {yearOptions.map(year => (
                          <Option key={year} value={year}>{year}</Option>
                        ))}
                      </Select>
                    </div>
                    
                    <div className="filter-item">
                      <span className="filter-label">试卷类型：</span>
                      <Select
                        style={{ width: '100px' }}
                        value={examTypeFilter}
                        onChange={handleExamTypeChange}
                        allowClear
                        placeholder="选择试卷"
                      >
                        {examTypeOptions.map(type => (
                          <Option key={type} value={type}>{type}</Option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  
                  <div className="filter-group">
                    <div className="filter-item">
                      <span className="filter-label">错误率：</span>
                      <Select
                        style={{ width: '180px' }}
                        value={errorRateFilter}
                        onChange={handleErrorRateChange}
                        allowClear
                        placeholder="选择错误率范围"
                      >
                        <Option value="0-0.3">低错误率 (0-30%)</Option>
                        <Option value="0.3-0.7">中错误率 (30-70%)</Option>
                        <Option value="0.7-1">高错误率 (70-100%)</Option>
                      </Select>
                    </div>
                    
                    <div className="filter-item">
                      <span className="filter-label">答题次数：</span>
                      <Select
                        style={{ width: '120px' }}
                        value={attemptCountFilter}
                        onChange={handleAttemptCountChange}
                        allowClear
                        placeholder="选择次数"
                      >
                        {attemptOptions.map(count => (
                          <Option key={count} value={count}>第 {count} 次</Option>
                        ))}
                      </Select>
                    </div>
                    
                    <div>
                      <Button type="primary" onClick={applyFilters} style={{ marginRight: '8px' }}>
                        应用筛选
                      </Button>
                      <Button onClick={resetFilters} style={{ marginRight: '8px' }}>
                        重置
                      </Button>
                      <Tooltip title="导出筛选后的记录">
                        <Button 
                          icon={<DownloadOutlined />} 
                          onClick={handleExportCSV}
                          disabled={filteredRecords.length === 0}
                        >
                          导出CSV
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
      
                  {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                      <Spin size="large" />
                    </div>
                  ) : filteredRecords.length > 0 ? (
                    <div className="table-container">
                      <Table 
                        columns={columns}
                        dataSource={getCurrentPageData().map(record => ({ ...record, key: record.id }))}
                        pagination={false}
                        bordered
                        size="middle"
                        className="records-table"
                        scroll={{ x: 'max-content' }}
                      />
                      <div className="pagination-container">
                        <Pagination
                          current={currentPage}
                          pageSize={tablePageSize}
                          total={filteredRecords.length}
                          showSizeChanger
                          onChange={handlePageChange}
                          onShowSizeChange={handlePageSizeChange}
                          pageSizeOptions={['10', '20', '50', '100']}
                          showTotal={(total) => `共 ${total} 条记录`}
                        />
                      </div>
                    </div>
                  ) : (
                    <Empty 
                      description="暂无答题记录" 
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      className="empty-container"
                    />
                  )}
                </>
              )
            },
            {
              key: "stats",
              label: "统计图表",
              children: (
                <>
                  {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                      <Spin size="large" />
                    </div>
                  ) : (
                    <div>
                      <div className="stats-tabs-container">
                        <Radio.Group 
                          value={statsTabType} 
                          onChange={(e) => setStatsTabType(e.target.value)}
                          className="stats-radio-group"
                        >
                          <Radio.Button value="all">
                            <BarChartOutlined /> 全部统计
                          </Radio.Button>
                          <Radio.Button value="subject">
                            <BookOutlined /> 按学科统计
                          </Radio.Button>
                          <Radio.Button value="time">
                            <ClockCircleOutlined /> 按时间统计
                          </Radio.Button>
                        </Radio.Group>
                      </div>
                      
                      {statsTabType === 'all' && (
                        <div className="stats-container">
                          {/* 左侧：正确率分布饼图 */}
                          <Card title="正确率分布" className="chart-card animate-card" style={{ width: '45%', minWidth: '300px' }}>
                            {correctnessData.some(d => d.value > 0) ? (
                              <div className="chart-container">
                                <PieChart width={280} height={280}>
                                  <Pie
                                    data={correctnessData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={true}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                  >
                                    {correctnessData.map((_entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip formatter={(value: number) => [`${value}题`, '数量']} />
                                  <Legend />
                                </PieChart>
                              </div>
                            ) : (
                              <Empty description="暂无数据" />
                            )}
                          </Card>
                          
                          {/* 右侧：错误率排名 */}
                          <Card title="错误率排名（前5题）" className="chart-card animate-card" style={{ width: '45%', minWidth: '300px' }}>
                            {questionStats.length > 0 ? (
                              <div className="chart-container">
                                <BarChart
                                  width={350}
                                  height={280}
                                  data={questionStats
                                    .sort((a, b) => b.error_rate - a.error_rate)
                                    .slice(0, 5)
                                    .map(item => {
                                      // 获取题目显示名称
                                      let displayName = item.question_path.split('/').pop() || item.question_path;
                                      
                                      // 如果有解析的路径信息，则使用更友好的格式
                                      if (item.pathInfo) {
                                        displayName = `${item.pathInfo.subject}-${item.pathInfo.year}-${item.pathInfo.examType}`;
                                      }
                                      
                                      return {
                                        name: displayName,
                                        错误率: item.error_rate * 100
                                      };
                                    })}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                  layout="vertical"
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" domain={[0, 100]} />
                                  <YAxis dataKey="name" type="category" width={150} />
                                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '错误率']} />
                                  <Bar dataKey="错误率" fill="#ff7875" />
                                </BarChart>
                              </div>
                            ) : (
                              <Empty description="暂无数据" />
                            )}
                          </Card>
                        </div>
                      )}
                      
                      {statsTabType === 'subject' && (
                        <div>
                          {/* 学科错误率统计 */}
                          <Card title="学科错误率统计" className="chart-card animate-card" style={{ width: '100%', marginBottom: '20px' }}>
                            {questionStats.length > 0 ? (
                              <div className="chart-container">
                                <BarChart
                                  width={500}
                                  height={300}
                                  data={(() => {
                                    // 按学科分组统计
                                    const subjectMap = new Map<string, {
                                      subject: string;
                                      total: number;
                                      incorrect: number;
                                      errorRate: number;
                                    }>();
                                    
                                    // 遍历所有题目统计
                                    questionStats.forEach(stat => {
                                      if (stat.pathInfo) {
                                        const subject = stat.pathInfo.subject;
                                        const current = subjectMap.get(subject) || { 
                                          subject, 
                                          total: 0, 
                                          incorrect: 0,
                                          errorRate: 0 
                                        };
                                        
                                        current.total += stat.total_attempts;
                                        current.incorrect += stat.incorrect_count + (stat.partially_correct_count * 0.5);
                                        subjectMap.set(subject, current);
                                      }
                                    });
                                    
                                    // 计算各学科的错误率
                                    return Array.from(subjectMap.values())
                                      .map(item => ({
                                        ...item,
                                        errorRate: (item.incorrect / item.total) * 100
                                      }))
                                      .sort((a, b) => b.errorRate - a.errorRate);
                                  })()}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                  layout="vertical"
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" domain={[0, 100]} />
                                  <YAxis dataKey="subject" type="category" width={80} />
                                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '错误率']} />
                                  <Bar dataKey="errorRate" name="错误率" fill="#ff7875" />
                                </BarChart>
                              </div>
                            ) : (
                              <Empty description="暂无数据" />
                            )}
                          </Card>
                          
                          {/* 学科正确率分布 */}
                          <Card title="学科正确率分布" className="chart-card animate-card" style={{ width: '100%' }}>
                            {questionStats.length > 0 ? (
                              <div className="chart-container">
                                <BarChart
                                  width={500}
                                  height={300}
                                  data={(() => {
                                    // 按学科分组统计
                                    const subjectMap = new Map<string, {
                                      subject: string;
                                      correct: number;
                                      partial: number;
                                      incorrect: number;
                                      total: number;
                                    }>();
                                    
                                    questionStats.forEach(stat => {
                                      if (stat.pathInfo) {
                                        const subject = stat.pathInfo.subject;
                                        const current = subjectMap.get(subject) || { 
                                          subject, 
                                          correct: 0,
                                          partial: 0,
                                          incorrect: 0,
                                          total: 0
                                        };
                                        
                                        current.correct += stat.correct_count;
                                        current.partial += stat.partially_correct_count;
                                        current.incorrect += stat.incorrect_count;
                                        current.total += stat.total_attempts;
                                        subjectMap.set(subject, current);
                                      }
                                    });
                                    
                                    return Array.from(subjectMap.values())
                                      .sort((a, b) => b.total - a.total)
                                      .map(item => ({
                                        subject: item.subject,
                                        正确: (item.correct / item.total) * 100,
                                        部分正确: (item.partial / item.total) * 100,
                                        错误: (item.incorrect / item.total) * 100
                                      }));
                                  })()}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="subject" />
                                  <YAxis label={{ value: '百分比(%)', angle: -90, position: 'insideLeft' }} />
                                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                                  <Legend />
                                  <Bar dataKey="正确" stackId="a" fill="#52c41a" />
                                  <Bar dataKey="部分正确" stackId="a" fill="#faad14" />
                                  <Bar dataKey="错误" stackId="a" fill="#ff4d4f" />
                                </BarChart>
                              </div>
                            ) : (
                              <Empty description="暂无数据" />
                            )}
                          </Card>
                        </div>
                      )}
                      
                      {statsTabType === 'time' && (
                        <div>
                          {/* 日期统计趋势图 */}
                          <Card title="日期答题统计" className="chart-card animate-card" style={{ width: '100%', marginBottom: '20px' }}>
                            {dateStats.length > 0 ? (
                              <div className="chart-container">
                                <BarChart
                                  width={Math.min(Math.max(dateStats.length * 80, 500), 1000)}
                                  height={300}
                                  data={dateStats}
                                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" />
                                  <YAxis label={{ value: '答题数量', angle: -90, position: 'insideLeft' }} />
                                  <RechartsTooltip />
                                  <Legend />
                                  <Bar dataKey="correct" name="正确" stackId="a" fill="#52c41a" />
                                  <Bar dataKey="partially_correct" name="部分正确" stackId="a" fill="#faad14" />
                                  <Bar dataKey="incorrect" name="错误" stackId="a" fill="#ff4d4f" />
                                </BarChart>
                              </div>
                            ) : (
                              <Empty description="暂无数据" />
                            )}
                          </Card>
                          
                          {/* 时间段正确率分布 */}
                          <Card title="每日正确率趋势" className="chart-card animate-card" style={{ width: '100%' }}>
                            {dateStats.length > 0 ? (
                              <div className="chart-container">
                                <BarChart
                                  width={Math.min(Math.max(dateStats.length * 80, 500), 1000)}
                                  height={300}
                                  data={dateStats.map(item => {
                                    const total = item.total;
                                    return {
                                      date: item.date,
                                      正确率: (item.correct / total) * 100,
                                      错误率: (item.incorrect / total) * 100,
                                      部分正确率: (item.partially_correct / total) * 100
                                    };
                                  })}
                                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" />
                                  <YAxis label={{ value: '百分比(%)', angle: -90, position: 'insideLeft' }} />
                                  <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                                  <Legend />
                                  <Bar dataKey="正确率" fill="#52c41a" />
                                  <Bar dataKey="部分正确率" fill="#faad14" />
                                  <Bar dataKey="错误率" fill="#ff4d4f" />
                                </BarChart>
                              </div>
                            ) : (
                              <Empty description="暂无数据" />
                            )}
                          </Card>
                        </div>
                      )}
        </div>
      )}
                </>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default Records;