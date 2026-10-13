import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Image, Radio, Button, Input, Rate, message, Spin, Divider, Tag, Row, Col, Typography } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { MathJax, MathJaxContext } from 'better-react-mathjax';
import './QuestionView.css';
// import { Radio as RadioType } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { parseToken } from './utils/authUtils'; // 导入认证工具函数

const { Title, Text } = Typography;
const { TextArea } = Input;

interface AnswerOption {
  value: string;
  label: string;
}

interface QuestionPathInfo {
  type: string;      // 例如: "prtsc"
  subject: string;   // 例如: "线性代数"
  grade: string;     // 例如: "大一"
  year: string;      // 例如: "2019"
  examType: string;  // 例如: "A卷"
  timeId: string;    // 例如: "20250320T115848"
}

interface ImageInfo {
  name: string;
  url: string;
}

interface LatexQuestion {
  id: number;
  latex_path: string;
  subject: string;
  grade: string;
  year: string;
  type: string;
  folder_name: string;
  correct_answer: string;
  note: string;
  latex_code: string;
}

// 定义本地存储记录类型
interface StoredRecord {
  id: number;
  question_path: string;
  answer_content: string;
  correctness: string;
  answer_time: string;
  attempt_count: number;
  userId?: number;
  questionId?: number;
  pathInfo?: QuestionPathInfo;
  answer?: string; // 兼容不同格式
}

const QuestionView: React.FC = () => {
  console.log('QuestionView组件初始化渲染');
  
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [questionPath, setQuestionPath] = useState<string>('');
  const [questionLitePath, setQuestionLitePath] = useState<string>(''); // 添加轻量路径状态
  const [questionType, setQuestionType] = useState<'image' | 'latex'>('image');
  const [questionId, setQuestionId] = useState<number | null>(null);
  const [pathInfo, setPathInfo] = useState<QuestionPathInfo | null>(null);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [latexQuestion, setLatexQuestion] = useState<LatexQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState<string>('');
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string>('');
  const [userId, setUserId] = useState<number | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);
  const [showRelatedPosts, setShowRelatedPosts] = useState<boolean>(false);
  const [previousAnswers, setPreviousAnswers] = useState<any[]>([]);
  const [_userAnswer, setUserAnswer] = useState<string>('');
  const [_submitting, setSubmitting] = useState<boolean>(false);
  const [_pathDebugInfo, setPathDebugInfo] = useState<any>(null);
  const [_typeDetectionSteps, setTypeDetectionSteps] = useState<Array<{time: string, message: string, status?: 'success' | 'warning' | 'error' | 'processing'|'wait'|'finish'|'default'|'blue'|'red'|'gray'|'green'|undefined}>>([]);

  const answerOptions: AnswerOption[] = [
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
    { value: 'D', label: 'D' },
    { value: 'custom', label: '其他' }
  ];

  useEffect(() => {
    console.log('QuestionView组件已挂载');
    
    // 清理函数在组件卸载时执行
    return () => {
      console.log('QuestionView组件已卸载');
    };
  }, []);

  // 初始化流程记录
  useEffect(() => {
    // 清空之前的流程步骤
    setTypeDetectionSteps([]);
    addTypeDetectionStep('开始题目加载和类型判断流程...', 'blue');
  }, [location.search]);

  useEffect(() => {
    // 从URL中获取问题路径
    console.log('QuestionView 初始化');
    console.log('原始location:', location);
    
    let path: string | null = null;
    let type: 'image' | 'latex' = 'image'; // 设置默认值为'image'
    let id: string | null = null;
    
    // 尝试使用标准方法获取参数
    try {
      const searchParams = new URLSearchParams(location.search);
      path = searchParams.get('path');
      const typeParam = searchParams.get('type');
      // 获取URL中的类型参数，但后面会根据路径再次验证
      id = searchParams.get('id');
      
      console.log('标准方法解析参数:', { path, type: typeParam, id });
    } catch (error) {
      console.error('标准方法解析参数失败:', error);
    }
    
    // 如果标准方法失败，尝试手动解析
    if (!path) {
      console.log('尝试手动解析参数');
      const manualParams = parseUrlParams();
      path = manualParams.path;
      id = manualParams.id;
      console.log('使用手动解析结果:', { path, type: manualParams.type, id });
    }
    
    // 确保路径正确解码 - 增强版解码逻辑
    if (path) {
      try {
        // 记录解码前的路径
        console.log('解码前原始路径:', path);
        
        // 检查路径中是否包含编码字符
        const hasEncoding = /%[0-9A-F]{2}/.test(path);
        console.log('路径中包含编码字符:', hasEncoding);
        
        // 可能已经被编码了一次或多次，尝试解码
        let decodedPath = path;
        
        // 进行多次解码尝试，以处理可能的多重编码
        for (let i = 0; i < 3; i++) {
          const previousPath = decodedPath;
          try {
            decodedPath = decodeURIComponent(decodedPath);
            console.log(`解码尝试 ${i+1}:`, decodedPath);
            
            // 如果解码后没有变化，说明已经完全解码
            if (decodedPath === previousPath) {
              console.log('路径已完全解码，停止尝试');
              break;
            }
          } catch (e) {
            console.error(`解码尝试 ${i+1} 失败:`, e);
            break;
          }
        }
        
        // 记录最终解码结果
        console.log('最终解码路径:', decodedPath);
        path = decodedPath;
      } catch (error) {
        console.error('解码路径失败:', error);
      }
    }
    
    if (!path) {
      console.error('未找到题目路径参数');
      message.error('未找到题目路径');
      navigate('/records');
      return;
    }

    // 计算轻量路径
    const litePath = toLitePath(path);
    setQuestionLitePath(litePath);
    addTypeDetectionStep(`计算轻量路径: ${litePath}`, 'processing');

    // 更新类型判断逻辑：优先根据路径前缀判断类型
    const pathParts = path.split('/').filter(p => p.length > 0);
    const pathPrefix = pathParts.length > 0 ? pathParts[0].toLowerCase() : '';
    
    addTypeDetectionStep(`开始根据路径前缀判断题目类型: "${pathPrefix}"`, 'processing');
    
    if (pathPrefix === 'latex') {
      // 明确的latex前缀，直接判断为latex类型
      type = 'latex';
      console.log('路径前缀为latex，设置为latex类型题目');
      addTypeDetectionStep(`路径前缀为latex，确定为latex类型题目`, 'success');
    } else if (pathPrefix === 'prtsc') {
      // 默认为图片类型，但后续会在加载时再次验证
      type = 'image';
      console.log('路径前缀为prtsc，暂时设置为图片类型题目');
      addTypeDetectionStep(`路径前缀为prtsc，暂时设置为图片类型，后续会验证`, 'warning');
    } else if (path.toLowerCase().includes('latex')) {
      // 路径中包含latex关键字，判断为latex类型
      type = 'latex';
      console.log('路径包含latex关键字，设置为latex类型题目');
      addTypeDetectionStep(`路径包含latex关键字，设置为latex类型题目`, 'success');
    } else {
      // 其他情况默认为图片类型，但会在loadQuestionContent中再次验证
      type = 'image';
      console.log('路径不符合已知模式，默认设置为image类型，后续会验证');
      addTypeDetectionStep(`路径不符合已知模式，默认设置为image类型，后续会验证`, 'warning');
    }

    console.log('设置状态参数(经过路径验证):', { path, type, id });
    setQuestionPath(path);
    setQuestionType(type); // 现在此处的type已经经过路径验证
    
    // 暂时设置一个URL传递的ID，但这个ID可能会在后续加载过程中被更新
    if (id) {
      // 将URL中的ID标记为临时ID，后续可能会被服务器返回的ID覆盖
      const urlId = Number(id);
      console.log('从URL获取的临时ID:', urlId);
      setQuestionId(urlId);
    } else if (type === 'image') {
      // 从路径中提取文件夹名称并生成ID
      const folderName = pathParts[pathParts.length - 1] || '';
      const generatedId = generateQuestionId(folderName);
      console.log('为图片题目生成ID:', { folderName, generatedId });
      setQuestionId(generatedId);
    } else {
      // 对于latex类型，从路径最后一部分生成临时ID
      const folderName = pathParts[pathParts.length - 1] || '';
      const generatedId = generateQuestionId(folderName);
      console.log('为latex题目生成临时ID:', generatedId);
      setQuestionId(generatedId);
    }

    // 解析路径信息
    parseQuestionPath(path);

    // 获取用户信息
    console.log('获取用户信息');
    try {
      // 使用 parseToken 函数替代直接 JSON.parse
      const userData = parseToken();
      if (userData && userData.id) {
        console.log('成功获取用户ID:', userData.id);
        setUserId(userData.id);
        
        // 立即在这里尝试获取答题记录，确保在loadQuestionContent之前
        if (userData.id && (id || path)) {
          console.log('尝试在初始化期间获取答题记录');
          
          // 设置一个临时函数来获取答题记录
          const getInitialRecords = async () => {
            const storedRecords = localStorage.getItem('currentQuestionRecords');
            if (storedRecords) {
              console.log('初始化时从localStorage获取答题记录');
              const recordsData = JSON.parse(storedRecords) as StoredRecord[];
              
              // 过滤出当前题目的记录
              const filteredRecords = recordsData.filter((record: StoredRecord) => {
                return record.question_path === path;
              });
              
              if (filteredRecords.length > 0) {
                console.log('找到匹配的本地存储记录:', filteredRecords.length, '条');
                setPreviousAnswers(filteredRecords);
                
                // 查找是否有正确的答案，用于本地评分
                const correctRecord = filteredRecords.find(r => r.correctness === 'correct');
                if (correctRecord) {
                  // 如果有正确答案记录，使用它的答案作为正确答案
                  if (correctRecord.answer_content) {
                    console.log('从本地记录找到正确答案:', correctRecord.answer_content);
                    setCorrectAnswer(correctRecord.answer_content);
                  }
                }
                
                // 自动填充最后一次的答案
                const latestAnswer = filteredRecords[filteredRecords.length - 1];
                if (latestAnswer) {
                  if (latestAnswer.answer_content) {
                    setUserAnswer(latestAnswer.answer_content);
                  } else if (latestAnswer.answer) {
                    setUserAnswer(latestAnswer.answer);
                  }
                }
              }
            }
          };
          
          getInitialRecords();
        }
      } else {
        console.log('无法获取有效的用户ID');
        }
      } catch (error) {
      console.error('解析用户信息时出错:', error);
    }

    // 根据题目类型加载题目内容
    loadQuestionContent(path, type, id ? Number(id) : null);
    
  }, [location.search]);

  // 当userId改变时，获取之前的答题记录
  useEffect(() => {
    if (userId && questionId) {
      fetchPreviousAnswers();
    }
  }, [userId, questionId]);

  // 解析题目路径
  const parseQuestionPath = (path: string) => {
    console.log('正在解析题目路径:', path);
    addTypeDetectionStep(`开始解析题目路径: ${path}`, 'processing');
    
    // 预期格式: "/prtsc/线性代数/大一/2019/A卷/20250320T115848" 或 "/latex/线性代数/大一/2019/A卷/20250421T214126"
    
    // 深度解析路径，增加更多日志以帮助调试
    console.log('路径类型:', typeof path);
    console.log('原始路径长度:', path.length);
    addTypeDetectionStep(`路径类型: ${typeof path}, 长度: ${path.length}`, 'default');
    
    // 使用正则表达式匹配所有分隔符，以便更好地诊断可能的空格问题
    const delimiterPattern = /\/+/g;
    const delimiterMatches = path.match(delimiterPattern);
    console.log('分隔符匹配结果:', delimiterMatches);
    addTypeDetectionStep(`分隔符匹配结果: ${delimiterMatches ? delimiterMatches.length + '个斜杠' : '无匹配'}`, 'default');
    
    // 按照分隔符拆分，并过滤空字符串
    const parts = path.split('/').filter(p => p.length > 0);
    console.log('路径解析后的部分:', parts);
    console.log('解析得到的部分数量:', parts.length);
    addTypeDetectionStep(`路径解析得到${parts.length}个部分: ${parts.join(' / ')}`, 'processing');
    
    // 显示每个部分的字符编码，帮助识别不可见字符
    parts.forEach((part, index) => {
      console.log(`部分[${index}] "${part}" 的字符编码:`, 
        Array.from(part).map(char => char.charCodeAt(0)));
    });
    
    // 在DOM中添加调试信息展示
    const debugInfo = {
      originalPath: path,
      pathParts: parts,
      prefix: parts[0] || '未识别',
      subject: parts[1] || '未识别',
      grade: parts[2] || '未识别',
      year: parts[3] || '未识别',
      examType: parts[4] || '未识别',
      timeId: parts[5] || '未识别'
    };
    
    // 判断题目类型的步骤
    if (parts.length > 0) {
      const prefix = parts[0].toLowerCase();
      addTypeDetectionStep(`检查路径前缀: "${prefix}"`, 'processing');
      
      if (prefix === 'latex') {
        addTypeDetectionStep(`发现前缀为"latex"，判定为LaTeX类型题目`, 'success');
      } else if (prefix === 'prtsc') {
        addTypeDetectionStep(`发现前缀为"prtsc"，可能是图片类型题目`, 'warning');
        
        if (parts.length >= 2) {
          const subject = parts[1];
          addTypeDetectionStep(`检查学科: "${subject}"`, 'processing');
          
          const latexSubjects = ['电磁场', '量子力学', '理论力学', '数学分析', '高等代数', '线性代数'];
          if (latexSubjects.includes(subject)) {
            addTypeDetectionStep(`检测到特殊学科"${subject}"，可能是LaTeX题目，需进一步验证`, 'warning');
          } else {
            addTypeDetectionStep(`检测到普通学科"${subject}"，判定为图片类型题目`, 'success');
          }
        } else {
          addTypeDetectionStep(`路径中未提供学科信息，默认判定为图片类型题目`, 'default');
        }
      } else {
        addTypeDetectionStep(`路径前缀"${prefix}"不是标准前缀，进一步分析`, 'warning');
        
        if (parts.length >= 2) {
          const subject = parts[1];
          addTypeDetectionStep(`检查潜在学科: "${subject}"`, 'processing');
          
          const latexSubjects = ['电磁场', '量子力学', '理论力学', '数学分析', '高等代数', '线性代数'];
          if (latexSubjects.includes(subject)) {
            addTypeDetectionStep(`学科"${subject}"在LaTeX列表中，可能是LaTeX题目`, 'warning');
          } else {
            addTypeDetectionStep(`学科"${subject}"不在LaTeX列表中，默认判定为图片类型`, 'default');
          }
        }
      }
    } else {
      addTypeDetectionStep(`路径解析为空，无法判断题目类型`, 'error');
    }
    
    // 将解析信息存储到组件状态，以便在UI中显示
    setPathDebugInfo(debugInfo);
    
    if (parts.length >= 6) {
      const pathInfo = {
        type: parts[0] || '',
        subject: parts[1] || '',
        grade: parts[2] || '',
        year: parts[3] || '',
        examType: parts[4] || '',
        timeId: parts[5] || ''
      };
      console.log('解析出的路径信息:', pathInfo);
      setPathInfo(pathInfo);
      addTypeDetectionStep(`解析完成，获取到完整路径信息`, 'success');
    } else {
      console.warn('路径解析不完整, 部分数量:', parts.length);
      addTypeDetectionStep(`路径解析不完整，仅获取到${parts.length}个部分，尝试修复`, 'error');
      
      // 尝试修复问题 - 如果路径不完整，可能出现编码问题
      if (parts.length > 0) {
        // 尝试解码整个路径字符串再重新分割
        try {
          const decodedAgain = decodeURIComponent(path);
          console.log('二次解码路径:', decodedAgain);
          const newParts = decodedAgain.split('/').filter(p => p.length > 0);
          console.log('重新解析的路径部分:', newParts);
          addTypeDetectionStep(`尝试二次解码: ${newParts.join(' / ')}`, 'processing');
          
          if (newParts.length >= 6) {
            const pathInfo = {
              type: newParts[0] || '',
              subject: newParts[1] || '',
              grade: newParts[2] || '',
              year: newParts[3] || '',
              examType: newParts[4] || '',
              timeId: newParts[5] || ''
            };
            console.log('二次解析得到的路径信息:', pathInfo);
            setPathInfo(pathInfo);
            addTypeDetectionStep(`二次解析成功，修复了路径信息`, 'success');
            
            // 更新调试信息
            setPathDebugInfo({
              ...debugInfo,
              secondDecodeResult: decodedAgain,
              secondParseParts: newParts,
              isFixed: true
            });
            
            return;
          } else {
            addTypeDetectionStep(`二次解析仍不完整，无法修复路径问题`, 'error');
          }
        } catch (e) {
          console.error('二次解码路径失败:', e);
          addTypeDetectionStep(`二次解码失败: ${e}`, 'error');
        }
      }
    }
  };

  // 加载题目内容
  const loadQuestionContent = async (path: string, type: 'image' | 'latex', id: number | null) => {
    console.log('开始加载题目内容:', { path, type, id });
    addTypeDetectionStep(`开始加载题目内容，初始类型: ${type}, 原始路径: ${path}`, 'blue');
    setLoading(true);
    
    try {
      // 存储原始路径，确保全程使用一致的路径
      const originalPath = path;
      // 使用轻量路径
      const litePath = questionLitePath || toLitePath(path);
      
      // 提取路径部分以便日志和调试
      const pathParts = path.split('/').filter(p => p.length > 0);
      console.log('路径部分:', pathParts);
      addTypeDetectionStep(`路径包含${pathParts.length}个部分: ${pathParts.join(' / ')}`, 'default');
      addTypeDetectionStep(`使用轻量路径: ${litePath}`, 'default');
      
      if (type === 'latex') {
        // 如果已经判断为latex类型，直接加载latex题目
        addTypeDetectionStep(`按latex类型加载题目`, 'success');
        
        // 获取或生成ID
        let latexId = id;
        if (!latexId) {
          // 从路径最后部分生成ID
          const folderName = pathParts[pathParts.length - 1] || '';
          latexId = generateQuestionId(folderName);
          console.log('从路径生成临时latex ID:', latexId);
          addTypeDetectionStep(`从路径生成临时latex ID: ${latexId}`, 'processing');
        }
        
        // 加载latex题目
        const latexResult = await fetchLatexQuestion(latexId);
        
        if (latexResult) {
          console.log('成功获取到LaTeX题目:', latexResult);
          
          // 使用服务器返回的ID，但保留原始路径
          setQuestionId(latexResult.id);
          
          // 保存LaTeX题目，但使用原始路径
          const updatedLatexQuestion = {
            ...latexResult,
            latex_path: originalPath // 始终使用原始路径
          };
          
          setLatexQuestion(updatedLatexQuestion);
          addTypeDetectionStep(`成功加载LaTeX题目，ID: ${latexResult.id}，使用原始路径: ${originalPath}`, 'success');
          
          // 获取正确答案，使用服务器返回的ID和原始路径
          await fetchCorrectAnswer(originalPath, 'latex', latexResult.id);
          
          // 获取题目评分信息
          fetchQuestionRating(latexResult.id, 'latex');
          
          // 获取相关帖子
          fetchRelatedPosts('latex', latexResult.id, originalPath);
        } else {
          // 如果无法加载latex题目，尝试退化为图片题目
          console.log('无法获取LaTeX题目，尝试退化为图片题目');
          addTypeDetectionStep(`无法获取LaTeX题目，尝试退化为图片题目`, 'warning');
          
          // 更改类型并重新尝试加载
          setQuestionType('image');
          
          // 尝试加载图片，确保使用原始路径
          const imagesResult = await fetchImages(originalPath);
          
          if (imagesResult.length > 0) {
            console.log('退化为图片题目成功，获取到图片:', imagesResult.length);
            addTypeDetectionStep(`退化为图片题目成功，获取到${imagesResult.length}张图片`, 'success');
            
            // 获取图片题目的正确答案，传递原始路径
            await fetchCorrectAnswer(originalPath, 'image', id);
          } else {
            console.error('无法加载任何题目内容，路径可能无效:', originalPath);
            addTypeDetectionStep(`无法加载任何题目内容，路径可能无效`, 'error');
            message.error('无法加载题目内容，请确认路径是否正确');
          }
        }
      } else {
        // 默认图片类型，但仍需确认是否为latex题目
        addTypeDetectionStep(`初始设置为图片类型，先检查是否为latex题目`, 'processing');
        
        // 第一步：尝试查询这个题目在latex列表中是否存在
        // 从路径生成临时ID
        const folderName = pathParts[pathParts.length - 1] || '';
        const tempId = generateQuestionId(folderName);
        
        console.log('生成临时ID用于查询latex列表:', tempId);
        addTypeDetectionStep(`生成临时ID用于查询latex列表: ${tempId}`, 'processing');
        
        try {
          // 尝试在latex列表中查询，传递原始路径和litepath
          const checkLatexResponse = await axios.get(`http://localhost:3001/check-latex-exists`, {
            params: { 
              questionPath: originalPath,
              litepath: litePath,
              id: tempId
            }
          });
          
          if (checkLatexResponse.data && checkLatexResponse.data.exists) {
            // 在latex列表中找到了这个题目
            console.log('在latex列表中找到了题目，转为latex类型', checkLatexResponse.data);
            addTypeDetectionStep(`在latex列表中找到了题目，类型为latex，匹配路径: ${checkLatexResponse.data.matchedPath}`, 'success');
            
            // 更改类型为latex
            setQuestionType('latex');
            
            // 使用返回的真实ID
            const realLatexId = checkLatexResponse.data.id || tempId;
            setQuestionId(realLatexId);
            
            // 如果服务器返回了更新的litepath，使用它
            if (checkLatexResponse.data.litepath) {
              setQuestionLitePath(checkLatexResponse.data.litepath);
            }
            
            // 加载完整的latex题目内容
            const latexResult = await fetchLatexQuestion(realLatexId);
            
            if (latexResult) {
              // 保存LaTeX题目，但使用原始路径
              const updatedLatexQuestion = {
                ...latexResult,
                latex_path: originalPath // 始终使用原始路径
              };
              
              setLatexQuestion(updatedLatexQuestion);
              addTypeDetectionStep(`成功加载LaTeX题目，ID: ${latexResult.id}，使用原始路径: ${originalPath}`, 'success');
              
              // 获取正确答案，使用服务器返回的ID和原始路径
              await fetchCorrectAnswer(originalPath, 'latex', latexResult.id);
              
              // 获取题目评分信息和相关帖子
              fetchQuestionRating(latexResult.id, 'latex');
              fetchRelatedPosts('latex', latexResult.id, originalPath);
            }
          } else {
            // 在latex列表中未找到，确认为图片类型
            console.log('在latex列表中未找到题目，确认为图片类型');
            addTypeDetectionStep(`在latex列表中未找到题目，确认为图片类型`, 'default');
            
            // 加载图片，确保使用原始路径
            const imagesResult = await fetchImages(originalPath);
            
            if (imagesResult.length > 0) {
              console.log('成功加载图片题目，获取到图片:', imagesResult.length);
              addTypeDetectionStep(`成功加载图片题目，获取到${imagesResult.length}张图片`, 'success');
              
              // 获取图片题目的正确答案，传递原始路径
              await fetchCorrectAnswer(originalPath, 'image', id);
            } else {
              console.error('无法加载任何题目内容，路径可能无效:', originalPath);
              addTypeDetectionStep(`无法加载任何题目内容，路径可能无效`, 'error');
              message.error('未能找到题目图片，请确认路径是否正确');
            }
          }
        } catch (error) {
          console.error('检查latex题目存在性失败:', error);
          addTypeDetectionStep(`检查latex题目存在性失败，默认尝试加载图片`, 'error');
          
          // 如果查询失败，直接尝试加载图片，确保使用原始路径
          const imagesResult = await fetchImages(originalPath);
          
          if (imagesResult.length > 0) {
            console.log('回退到图片题目，成功获取图片:', imagesResult.length);
            addTypeDetectionStep(`回退到图片题目，成功获取${imagesResult.length}张图片`, 'warning');
            
            // 获取图片题目的正确答案，传递原始路径
            await fetchCorrectAnswer(originalPath, 'image', id);
          } else {
            // 最后尝试：强制尝试加载latex题目
            console.log('图片加载失败，最后尝试强制加载latex题目');
            addTypeDetectionStep(`图片加载失败，最后尝试强制加载latex题目`, 'warning');
            
            // 更改类型为latex再试一次
            setQuestionType('latex');
            const latexResult = await fetchLatexQuestion(tempId);
            
            if (latexResult) {
              // 成功获取到latex题目
              console.log('最后尝试成功，获取到latex题目');
              addTypeDetectionStep(`最后尝试成功，获取到latex题目`, 'success');
              
              // 使用服务器返回的ID，但保留原始路径
              setQuestionId(latexResult.id);
              
              // 保存LaTeX题目，但使用原始路径
              const updatedLatexQuestion = {
                ...latexResult,
                latex_path: originalPath
              };
              
              setLatexQuestion(updatedLatexQuestion);
              
              // 获取正确答案等信息，使用原始路径
              await fetchCorrectAnswer(originalPath, 'latex', latexResult.id);
              fetchQuestionRating(latexResult.id, 'latex');
              fetchRelatedPosts('latex', latexResult.id, originalPath);
            } else {
              console.error('所有尝试均失败，无法加载任何题目内容');
              addTypeDetectionStep(`所有尝试均失败，无法加载任何题目内容`, 'error');
              message.error('无法加载题目内容，请确认路径是否正确或联系管理员');
            }
          }
        }
      }
    } catch (error) {
      console.error('加载题目内容失败:', error);
      addTypeDetectionStep(`加载题目内容总体失败: ${error}`, 'error');
      message.error('加载题目内容失败，请查看控制台了解详细错误信息');
    } finally {
      setLoading(false);
      console.log('题目加载完成');
      addTypeDetectionStep(`题目加载完成`, 'finish');
    }
  };

  // 获取图片
  const fetchImages = async (path: string) => {
    console.log('获取图片开始, 原始路径:', path);
    addTypeDetectionStep(`开始获取图片, 原始路径: ${path}`, 'processing');
    
    // 使用轻量路径替代复杂的路径处理
    const litePath = questionLitePath || toLitePath(path);
    console.log('图片请求使用轻量路径:', litePath);
    addTypeDetectionStep(`获取图片使用轻量路径: ${litePath}`, 'processing');
    
    try {
      // 使用litePath调用API
      addTypeDetectionStep(`发送图片请求: /images?folderPath=${litePath.startsWith('/') ? litePath.substring(1) : litePath}`, 'processing');
      const response = await axios.get(`http://localhost:3001/images`, {
        params: { 
          folderPath: litePath.startsWith('/') ? litePath.substring(1) : litePath,
          originalPath: path // 添加原始路径参数
        }
      });
      
      console.log('图片API响应:', response.status, response.data ? `获取了${response.data.length}张图片` : '无数据');
      
      if (response.data && response.data.length > 0) {
        addTypeDetectionStep(`第一次请求成功，获取到${response.data.length}张图片`, 'success');
        setImages(response.data);
        return response.data;
      }
      
      // 如果第一次尝试失败，尝试添加prtsc前缀
      console.log('第一次尝试未获取到图片，尝试使用prtsc前缀');
      addTypeDetectionStep(`第一次请求未获取到图片，尝试添加prtsc前缀`, 'warning');
      const prtscPath = `prtsc/${litePath}`;
      addTypeDetectionStep(`尝试第二次请求: /images?folderPath=${prtscPath}`, 'processing');
      
      const secondResponse = await axios.get(`http://localhost:3001/images`, {
        params: { folderPath: prtscPath }
      });
      
      console.log('第二次图片API响应:', secondResponse.status, secondResponse.data ? `获取了${secondResponse.data.length}张图片` : '无数据');
      
      if (secondResponse.data && secondResponse.data.length > 0) {
        addTypeDetectionStep(`第二次请求成功，获取到${secondResponse.data.length}张图片`, 'success');
      } else {
        addTypeDetectionStep(`第二次请求未获取到图片，无法加载图片内容`, 'error');
      }
      
      setImages(secondResponse.data || []);
      return secondResponse.data || [];
    } catch (error) {
      console.error('获取图片失败:', error);
      addTypeDetectionStep(`获取图片失败: ${error}`, 'error');
      
      // 详细记录错误信息，帮助调试
      if (axios.isAxiosError(error)) {
        console.error('请求错误信息:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        addTypeDetectionStep(`请求错误: 状态=${error.response?.status}, 消息=${error.response?.statusText}`, 'error');
      }
      
      return [];
    }
  };

  // 获取LaTeX题目
  const fetchLatexQuestion = async (id: number) => {
    console.log('尝试获取LaTeX题目, ID:', id);
    addTypeDetectionStep(`尝试获取LaTeX题目, ID: ${id}`, 'processing');
    
    try {
      console.log('使用优化的方式获取LaTeX题目');
      addTypeDetectionStep(`发送请求: /latex-questions?id=${id}`, 'processing');
      const response = await axios.get(`http://localhost:3001/latex-questions`, {
        params: { id }
      });
      
      if (response.data && response.data.length > 0) {
        const latexData = response.data[0];
        console.log('成功获取LaTeX题目:', latexData);
        addTypeDetectionStep(`成功获取LaTeX题目: ID=${latexData.id}`, 'success');
        
        // 如果服务器返回的ID与URL中的ID不同，更新questionId
        if (latexData.id !== id) {
          console.log(`服务器返回的ID(${latexData.id})与请求的ID(${id})不同，更新为服务器ID`);
          addTypeDetectionStep(`服务器返回的ID(${latexData.id})与请求的ID(${id})不同，更新ID`, 'warning');
          setQuestionId(latexData.id);
        }
        
        setLatexQuestion(latexData);
        return latexData;
      } else {
        // 如果备用方式也没有找到数据，尝试原始方式
        console.log('备用方式未找到数据，尝试原始方式');
        addTypeDetectionStep(`第一次请求未找到数据，尝试原始方式: /latex-question/${id}`, 'warning');
        const originalResponse = await axios.get(`http://localhost:3001/latex-question/${id}`);
        if (originalResponse.data) {
          const latexData = originalResponse.data;
          console.log('使用原始方式成功获取LaTeX题目:', latexData);
          addTypeDetectionStep(`原始方式成功获取LaTeX题目: ID=${latexData.id}`, 'success');
          
          // 同样检查ID并更新
          if (latexData.id !== id) {
            console.log(`服务器返回的ID(${latexData.id})与请求的ID(${id})不同，更新为服务器ID`);
            addTypeDetectionStep(`服务器返回的ID(${latexData.id})与请求的ID(${id})不同，更新ID`, 'warning');
            setQuestionId(latexData.id);
          }
          
          setLatexQuestion(latexData);
          return latexData;
        } else {
          console.log('两种方式均未找到LaTeX题目');
          addTypeDetectionStep(`两种方式均未找到LaTeX题目`, 'error');
          return null;
        }
      }
    } catch (error) {
      console.error('获取LaTeX题目失败:', error);
      addTypeDetectionStep(`获取LaTeX题目失败: ${error}`, 'error');
      
      // 详细记录错误信息，帮助调试
      if (axios.isAxiosError(error)) {
        console.error('LaTeX题目请求错误信息:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        addTypeDetectionStep(`请求错误: 状态=${error.response?.status}, 消息=${error.response?.statusText}`, 'error');
      }
      
      // 尝试备用方式 - 自适应延时重试
      try {
        console.log('延迟500ms后再次尝试获取LaTeX题目');
        addTypeDetectionStep(`延迟500ms后再次尝试获取LaTeX题目`, 'warning');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const delayResponse = await axios.get(`http://localhost:3001/latex-questions`, {
          params: { id }
        });
        
        if (delayResponse.data && delayResponse.data.length > 0) {
          const latexData = delayResponse.data[0];
          console.log('延迟重试成功获取LaTeX题目:', latexData);
          addTypeDetectionStep(`延迟重试成功获取LaTeX题目: ID=${latexData.id}`, 'success');
          
          // 检查并更新ID
          if (latexData.id !== id) {
            console.log(`服务器返回的ID(${latexData.id})与请求的ID(${id})不同，更新为服务器ID`);
            addTypeDetectionStep(`服务器返回的ID(${latexData.id})与请求的ID(${id})不同，更新ID`, 'warning');
            setQuestionId(latexData.id);
          }
          
          setLatexQuestion(latexData);
          return latexData;
        } else {
          addTypeDetectionStep(`延迟重试仍未找到LaTeX题目`, 'error');
        }
      } catch (delayError) {
        console.error('延迟重试获取LaTeX题目失败:', delayError);
        addTypeDetectionStep(`延迟重试获取LaTeX题目失败: ${delayError}`, 'error');
      }
      
      message.warning('获取题目内容失败，这可能是一个LaTeX题目但未能加载');
      return null;
    }
  };

  // 获取正确答案
  const fetchCorrectAnswer = async (path: string, type: 'image' | 'latex', id: number | null) => {
    console.log('获取正确答案, 参数:', { path, type, id });
    addTypeDetectionStep(`开始获取正确答案，类型: ${type}`, 'processing');
    
    // 使用轻量路径
    // const litePath = questionLitePath || toLitePath(path);
    
    try {
      if (type === 'latex') {
        // 对于LaTeX题目，尝试从服务器获取答案
        if (id) {
          // 使用与Exams.tsx相同的端点
          const response = await axios.get(`http://localhost:3001/print-correct-answer`, {
            params: { 
              questionId: id,
              questionType: 'latex'
            }
          });
          
          if (response.data && response.data.correctAnswer) {
            const answer = response.data.correctAnswer.trim();
            console.log('获取到LaTeX题目答案:', answer);
            addTypeDetectionStep(`获取到LaTeX题目答案: ${answer}`, 'success');
            setCorrectAnswer(answer);
          } else {
            console.error('无法获取LaTeX题目答案');
            addTypeDetectionStep(`无法获取LaTeX题目答案`, 'error');
            setCorrectAnswer('');
          }
        } else {
          console.error('无法获取LaTeX题目答案，ID不存在');
          addTypeDetectionStep(`无法获取LaTeX题目答案，ID不存在`, 'error');
          setCorrectAnswer('');
        }
      } else {
        // 对于图片题目，使用与Exams.tsx相同的端点
        try {
          const response = await axios.get(`http://localhost:3001/print-correct-answer`, {
            params: { 
              questionPath: path, 
              questionType: 'image'
            }
          });
          
          if (response.data && response.data.correctAnswer) {
            const answer = response.data.correctAnswer.trim();
            console.log('获取到图片题目答案:', answer);
            addTypeDetectionStep(`获取到图片题目答案: ${answer}`, 'success');
            setCorrectAnswer(answer);
          } else {
            console.error('无法获取图片题目答案');
            addTypeDetectionStep(`无法获取图片题目答案`, 'error');
            setCorrectAnswer('');
          }
        } catch (error) {
          console.error('获取图片题目答案失败:', error);
          addTypeDetectionStep(`获取图片题目答案失败: ${error}`, 'error');
          setCorrectAnswer('');
        }
      }
    } catch (error) {
      console.error('获取正确答案失败:', error);
      addTypeDetectionStep(`获取正确答案失败: ${error}`, 'error');
    }
  };

  // 获取题目评分信息
  const fetchQuestionRating = async (questionId: number, questionType: 'image' | 'latex') => {
    if (!userId) return;
    
    try {
      const response = await axios.get('http://localhost:3003/api/community/question-rating', {
        params: { 
          questionId,
          questionType,
          userId
        }
      });
      
      console.log('题目评分信息:', response.data);
      // 可以更新UI以显示评分信息
    } catch (error) {
      console.error('获取题目评分失败:', error);
    }
  };

  // 获取相关帖子
  const fetchRelatedPosts = async (questionType: string, questionId?: number | null, questionPath?: string) => {
    try {
      const response = await axios.get('http://localhost:3003/api/community/posts/by-question', {
        params: {
          questionType,
          questionId,
          questionPath
        }
      });
      
      if (response.data && response.data.length > 0) {
        setRelatedPosts(response.data);
        setShowRelatedPosts(true);
      } else {
        setRelatedPosts([]);
        setShowRelatedPosts(false);
      }
    } catch (error) {
      console.error('获取相关帖子失败:', error);
      setRelatedPosts([]);
    }
  };

  // 获取之前的答题记录
  const fetchPreviousAnswers = async () => {
    // 确保使用正确的questionId，优先使用latexQuestion.id
    const actualQuestionId = (questionType === 'latex' && latexQuestion?.id) ? latexQuestion.id : questionId;
    
    if (!actualQuestionId || !userId) {
      console.log('缺少必要参数(userId或questionId)，无法获取答题记录');
      return;
    }
    
    try {
      console.log(`尝试获取用户${userId}对题目${actualQuestionId}的答题记录，路径: ${questionPath}`);
      
      // 首先尝试从localStorage获取
      const storedRecords = localStorage.getItem('currentQuestionRecords');
      if (storedRecords) {
        console.log('从localStorage获取到答题记录');
        const recordsData = JSON.parse(storedRecords) as StoredRecord[];
        
        // 增强过滤逻辑，考虑多种匹配可能性
        const filteredRecords = recordsData.filter((record: StoredRecord) => {
          const recordMatches = [];
          
          // 1. 通过路径匹配
          if (questionPath && record.question_path) {
            // 直接路径匹配
            const pathMatch = record.question_path === questionPath;
            if (pathMatch) recordMatches.push('路径完全匹配');
            
            // 标准化路径后匹配
            const recordLitePath = toLitePath(record.question_path);
            const currentLitePath = questionLitePath || toLitePath(questionPath);
            const litePathMatch = recordLitePath === currentLitePath;
            if (litePathMatch) recordMatches.push('轻量路径匹配');
          }
          
          // 2. 通过ID匹配
          if (actualQuestionId && record.questionId) {
            const idMatch = record.questionId === actualQuestionId;
            if (idMatch) recordMatches.push('ID匹配');
          }
          
          // 只要有一项匹配即可
          if (recordMatches.length > 0) {
            console.log(`记录匹配原因: ${recordMatches.join(', ')}`, record);
            return true;
          }
          
          return false;
        });
        
        if (filteredRecords.length > 0) {
          console.log('找到匹配的本地存储记录:', filteredRecords.length, '条');
          setPreviousAnswers(filteredRecords);
          
          // 自动填充最后一次的答案
          const latestAnswer = filteredRecords[filteredRecords.length - 1];
          if (latestAnswer) {
            if (latestAnswer.answer_content) {
              setUserAnswer(latestAnswer.answer_content);
            } else if (latestAnswer.answer) {
              setUserAnswer(latestAnswer.answer);
            }
          }
          
          // 使用本地数据成功，提前返回
          return;
        } else {
          console.log('本地存储中没有找到匹配的记录，尝试API请求');
        }
      } else {
        console.log('localStorage中没有答题记录，尝试API请求');
      }
      
      // 如果localStorage没有数据，再使用API请求
      // 使用user-answers端点，这是Records.tsx中使用的相同端点
      const apiUrl = `http://localhost:3001/user-answers/${userId}`;
      console.log('尝试使用Records.tsx相同端点:', apiUrl);
      
      const apiResponse = await fetch(apiUrl);
      if (!apiResponse.ok) {
        // 如果这个端点也失败，再尝试之前的端点
        throw new Error(`API请求错误: ${apiResponse.status}`);
      }
      
      const apiData = await apiResponse.json();
      console.log('从API获取到所有答题记录:', apiData.length, '条');
      
      // 增强过滤逻辑，考虑多种匹配可能性
      const questionRecords = apiData.filter((record: any) => {
        // 1. 通过路径匹配
        if (questionPath && record.question_path) {
          const directPathMatch = record.question_path === questionPath;
          if (directPathMatch) return true;
          
          // 轻量路径匹配
          const recordLitePath = toLitePath(record.question_path);
          const currentLitePath = questionLitePath || toLitePath(questionPath); 
          if (recordLitePath === currentLitePath) return true;
        }
        
        // 2. 通过ID匹配
        if (actualQuestionId && record.questionId) {
          if (record.questionId === actualQuestionId) return true;
        }
        
        return false;
      });
      
      if (questionRecords.length > 0) {
        console.log('找到匹配的记录:', questionRecords.length, '条');
        setPreviousAnswers(questionRecords);
        
        // 自动填充最后一次的答案
        const latestAnswer = questionRecords[questionRecords.length - 1];
        if (latestAnswer && latestAnswer.answer_content) {
          setUserAnswer(latestAnswer.answer_content);
        }
        
        return;
      }
      
      // 如果前面的尝试都失败，再使用之前的方式
      console.log('使用原始API端点尝试获取记录');
      const url = `http://localhost:3001/users/${userId}/answers?questionId=${actualQuestionId}`;
      console.log('请求URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`错误状态码: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('成功获取答题记录:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        setPreviousAnswers(data);
        // 自动填充最后一次的答案
        const latestAnswer = data[data.length - 1];
        if (latestAnswer && latestAnswer.answer) {
          setUserAnswer(latestAnswer.answer);
        }
      } else {
        console.log('没有找到之前的答题记录');
        setPreviousAnswers([]);
      }
    } catch (error) {
      console.error('获取答题记录失败:', error);
      
      // 尝试备用方式获取
      try {
        console.log('尝试使用备用方式获取答题记录');
        const backupUrl = `http://localhost:3001/answers?userId=${userId}&questionId=${actualQuestionId}`;
        console.log('备用请求URL:', backupUrl);
        
        const backupResponse = await fetch(backupUrl);
        if (!backupResponse.ok) {
          throw new Error(`备用请求错误状态码: ${backupResponse.status}`);
        }
        
        const backupData = await backupResponse.json();
        console.log('使用备用方式成功获取答题记录:', backupData);
        
        if (Array.isArray(backupData) && backupData.length > 0) {
          setPreviousAnswers(backupData);
          // 自动填充最后一次的答案
          const latestAnswer = backupData[backupData.length - 1];
          if (latestAnswer && latestAnswer.answer) {
            setUserAnswer(latestAnswer.answer);
          }
        } else {
          console.log('备用方式也没有找到答题记录');
          setPreviousAnswers([]);
        }
      } catch (backupError) {
        console.error('备用方式获取答题记录失败:', backupError);
        message.error('获取历史答题记录失败');
        setPreviousAnswers([]);
      }
    }
  };

  // 提交答案
  const handleAnswerSubmit = async () => {
    // 首先确保我们有questionId，如果没有，尝试从其他地方获取
    if (!questionId) {
      console.warn('缺少questionId，尝试从题目信息获取');
      
      // 如果有LaTeX题目
      if (latexQuestion && latexQuestion.id) {
        console.log('从LaTeX题目获取ID:', latexQuestion.id);
        setQuestionId(latexQuestion.id);
      } else if (questionPath) {
        // 从路径生成ID
        const folderName = questionPath.split('/').pop() || '';
        const generatedId = generateQuestionId(folderName);
        console.log('临时生成题目ID:', generatedId);
        setQuestionId(generatedId);
      } else {
        message.error('无法确定题目ID，无法提交答案');
        return;
      }
    }

    // 获取用户ID
    try {
      // 使用 parseToken 函数替代直接 JSON.parse
      const userData = parseToken();
      const currentUserId = userData?.id || userId;
      
      if (!currentUserId) {
        console.error('无法获取用户ID，可能需要重新登录');
        message.error('无法获取用户信息，请重新登录');
        navigate('/login');
        return;
    }

    // 确定最终提交的答案
    const finalAnswer = selectedOption === 'custom' ? customAnswer : selectedOption;
    
    if (!finalAnswer || (selectedOption === 'custom' && !customAnswer.trim())) {
      message.error('请选择一个选项或输入答案');
      return;
    }
    
    // 更新userAnswer为最终答案
    setUserAnswer(finalAnswer);

    setSubmitting(true);

    // 获取要使用的实际questionId
    const actualQuestionId = latexQuestion?.id || questionId;
    
    // 记录使用最终ID的情况
    if (latexQuestion?.id && latexQuestion.id !== questionId) {
      console.log(`注意: 使用服务器返回的LaTeX题目ID(${latexQuestion.id})而非URL ID(${questionId})`);
    }
    
    // 确定实际使用的题目类型
    // 如果成功加载了LaTeX题目，无论最初的类型是什么，都使用latex类型
    const actualQuestionType = latexQuestion ? 'latex' : questionType;
    
    if (actualQuestionType !== questionType) {
      console.log(`注意: 实际题目类型(${actualQuestionType})与最初设置的类型(${questionType})不同`);
    }
      
    console.log('提交答案最终参数:', {
      userId: currentUserId,
      questionId: actualQuestionId,
      questionPath,
      selectedOption: finalAnswer,
      questionType: actualQuestionType,
      originalPath: questionPath // 添加原始路径
    });
    
    try {
      // 使用与Exams.tsx相同的API端点
      const response = await axios.post('http://localhost:3001/submit-answer', {
        userId: currentUserId,
        questionPath,
        questionId: actualQuestionId,
        selectedOption: finalAnswer,
        questionType: actualQuestionType
      });
      
      console.log('服务器响应:', response.data);
      
      if (response.data.correct) {
        message.success('回答正确！');
        setIsCorrect(true);
      } else {
        message.error(`回答错误！正确答案: ${response.data.correctAnswer || correctAnswer}`);
        setIsCorrect(false);
        
        // 更新正确答案
        if (response.data.correctAnswer) {
          setCorrectAnswer(response.data.correctAnswer);
        }
      }
      
      // 记录答题成功
      setHasAnswered(true);
      
      // 更新本地存储
      updateLocalStorage(finalAnswer, response.data.correct, currentUserId);
      
    } catch (error) {
      console.error('提交答案失败:', error);
      
      // 如果API调用失败，尝试本地评判
      const isCorrectLocal = finalAnswer === correctAnswer;
      
      // 仍然记录答题
      message.warning('服务器连接失败，已本地记录答案');
      setHasAnswered(true);
      setIsCorrect(isCorrectLocal);
      
      // 更新本地存储
      updateLocalStorage(finalAnswer, isCorrectLocal, currentUserId);
    } finally {
      setSubmitting(false);
      }
    } catch (error) {
      console.error('处理用户数据时出错:', error);
      message.error('处理用户数据时出错，请重新登录');
      return;
    }
  };
  
  // 更新本地存储
  const updateLocalStorage = (finalAnswer: string, isCorrect: boolean, currentUserId: number) => {
    try {
      // 创建新的答题记录
      const newRecord: StoredRecord = {
        id: Date.now(), // 临时ID
        question_path: questionPath || '',
        attempt_count: (previousAnswers.length || 0) + 1,
        answer_content: finalAnswer,
        correctness: isCorrect ? 'correct' : 'incorrect',
        answer_time: new Date().toISOString(),
        userId: currentUserId,
        questionId: questionId || undefined
      };
      
      // 更新本地状态
      const updatedRecords = [...previousAnswers, newRecord];
      setPreviousAnswers(updatedRecords);
      
      // 更新localStorage
      const storedRecords = localStorage.getItem('currentQuestionRecords');
      if (storedRecords) {
        const allRecords = JSON.parse(storedRecords) as StoredRecord[];
        // 过滤掉可能重复的记录
        const filteredRecords = allRecords.filter((r: StoredRecord) => 
          !(r.question_path === newRecord.question_path && 
            r.answer_content === newRecord.answer_content && 
            r.answer_time === newRecord.answer_time)
        );
        const updatedAllRecords = [...filteredRecords, newRecord];
        localStorage.setItem('currentQuestionRecords', JSON.stringify(updatedAllRecords));
      } else {
        localStorage.setItem('currentQuestionRecords', JSON.stringify([newRecord]));
      }
      
      console.log('答题记录已保存到本地存储');
    } catch (localError) {
      console.error('本地记录答案失败:', localError);
    }
  };

  // 提交打星评分
  const submitRating = async () => {
    if (!userId || ratingValue <= 0 || !questionId) return;
    
    setRatingSubmitting(true);
    try {
      // 确保使用准确的questionId和questionType
      console.log('提交评分数据:', {
        userId,
        questionId,
        questionType,
        rating: ratingValue,
        teacherId: 11
      });
      
      const response = await axios.post('http://localhost:3003/api/community/rate-question', {
        userId,
        questionId,
        questionType,
        rating: ratingValue,
        teacherId: 11 // 指定教师ID
      });
      
      if (response.data.success) {
        message.success(`评分成功! 剩余苹果币: ${response.data.remainingApples}`);
        // 隐藏评分功能，防止重复提交
        setRatingValue(0);
      } else if (response.data.error) {
        message.error(response.data.error);
      }
    } catch (error: any) {
      console.error('评分失败:', error);
      if (error.response && error.response.data && error.response.data.error) {
        message.error(`评分失败: ${error.response.data.error}`);
      } else if (error.message) {
        message.error(`评分失败: ${error.message}`);
      } else {
        message.error('评分失败，请稍后再试');
      }
    } finally {
      setRatingSubmitting(false);
    }
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

  // 返回到记录页面
  const handleGoBack = () => {
    navigate('/records');
  };

  // 手动解析URL参数的函数
  const parseUrlParams = () => {
    console.log('手动解析URL参数');
    const url = window.location.href;
    console.log('完整URL:', url);
    
    // 尝试手动提取查询参数
    const queryString = url.split('?')[1] || '';
    console.log('查询字符串:', queryString);
    
    // 手动解析path参数
    const pathMatch = queryString.match(/path=([^&]+)/);
    const typeMatch = queryString.match(/type=([^&]+)/);
    const idMatch = queryString.match(/id=([^&]+)/);
    
    let path = pathMatch ? pathMatch[1] : null;
    const type = typeMatch ? typeMatch[1] as 'image' | 'latex' : 'image';
    const id = idMatch ? idMatch[1] : null;
    
    console.log('手动解析结果:', { path, type, id });
    
    // 尝试解码path
    if (path) {
      try {
        path = decodeURIComponent(path);
        console.log('手动解码后的path:', path);
        return { path, type, id };
      } catch (error) {
        console.error('手动解码path失败:', error);
      }
    }
    
    return { path, type, id };
  };

  const handleOptionChange = (e: RadioChangeEvent) => {
    const value = e.target.value;
    setSelectedOption(value);
    
    // 如果选择了预设选项，更新userAnswer
    if (value !== 'custom') {
      setUserAnswer(value);
    } else {
      // 如果选择了自定义，暂时使用已有的customAnswer
      setUserAnswer(customAnswer);
    }
  };

  const handleCustomAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCustomAnswer(value);
    
    // 如果当前选择的是自定义，同时更新userAnswer
    if (selectedOption === 'custom') {
      setUserAnswer(value);
    }
  };

  // 添加用于记录流程的函数
  const addTypeDetectionStep = (message: string, status: 'success' | 'warning' | 'error' | 'processing'|'wait'|'finish'|'default'|'blue'|'red'|'gray'|'green'|undefined = 'processing') => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    setTypeDetectionSteps(prev => [...prev, {time: timeString, message, status}]);
  };

  // 将路径转换为轻量路径的工具函数
  const toLitePath = (originalPath: string): string => {
    if (!originalPath) return '';
    
    console.log('转换轻量路径前:', originalPath);
    
    // 计算斜杠数量
    const slashCount = (originalPath.match(/\//g) || []).length;
    let litePath = originalPath;
    
    // 处理起始没有斜杠的情况
    const hasLeadingSlash = originalPath.startsWith('/');
    
    // 案例1: "prtsc/数学/大一/2022/期中考试/20220320T115848" - 无前导斜杠，5个斜杠
    if (!hasLeadingSlash && slashCount >= 5) {
      // 删除第一个字段（通常是prtsc或latex）
      const firstSlashIndex = litePath.indexOf('/');
      if (firstSlashIndex !== -1) {
        litePath = '/' + litePath.substring(firstSlashIndex + 1);
      }
    } 
    // 案例2: "/prtsc/电磁场/大一/2019/A卷/20250418T200144" - 有前导斜杠，6个斜杠
    else if (hasLeadingSlash && slashCount >= 6) {
      // 删除前两个字段（通常是/prtsc或/latex）
      const secondSlashIndex = litePath.indexOf('/', 1);
      if (secondSlashIndex !== -1) {
        litePath = litePath.substring(secondSlashIndex);
      }
    }
    // 案例3: "/线性代数/大一/2019/A卷/20250320T151711" - 已经是标准格式，无需处理
    
    // 确保开头有斜杠
    if (!litePath.startsWith('/')) {
      litePath = '/' + litePath;
    }
    
    console.log('转换轻量路径后:', litePath);
    return litePath;
  };

  return (
    <div className="question-view-container">
      <Button 
        type="primary" 
        icon={<ArrowLeftOutlined />} 
        onClick={handleGoBack}
        className="back-button"
      >
        返回记录
      </Button>
      
      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
          <div className="loading-text">加载题目中...</div>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          <Col span={18}>
            <Card className="question-info-card">
              <div className="question-path-info">
                {pathInfo && (
                  <>
                    <Tag color="blue">{pathInfo.subject}</Tag>
                    <Tag color="green">{pathInfo.grade}</Tag>
                    <Tag color="orange">{pathInfo.year}</Tag>
                    <Tag color="purple">{pathInfo.examType}</Tag>
                    <Tag color="red">{pathInfo.timeId}</Tag>
                  </>
                )}
              </div>
              
              {/*
              <div className="path-debug-info" style={{margin: '10px 0', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                <Title level={5}>路径解析调试信息</Title>
                <div style={{overflow: 'auto', maxHeight: '200px'}}>
                  <p><strong>原始路径:</strong> {questionPath}</p>
                  {pathDebugInfo && (
                    <>
                      <p><strong>前缀类型:</strong> {pathDebugInfo.prefix}</p>
                      <p><strong>学科:</strong> {pathDebugInfo.subject}</p>
                      <p><strong>年级:</strong> {pathDebugInfo.grade}</p>
                      <p><strong>年份:</strong> {pathDebugInfo.year}</p>
                      <p><strong>试卷类型:</strong> {pathDebugInfo.examType}</p>
                      <p><strong>时间ID:</strong> {pathDebugInfo.timeId}</p>
                      <p><strong>解析结果:</strong> {pathDebugInfo.isFixed ? '已修复' : '原始解析'}</p>
                      <Collapse>
                        <Collapse.Panel header="查看详细解析信息" key="1">
                          <pre>{JSON.stringify(pathDebugInfo, null, 2)}</pre>
                        </Collapse.Panel>
                      </Collapse>
                    </>
                  )}
                </div>
              </div>
              
              
              <div className="type-detection-flow" style={{margin: '10px 0', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
                <Title level={5}>题目类型判断流程</Title>
                <div style={{maxHeight: '300px', overflow: 'auto', padding: '10px'}}>
                  <Timeline mode="left" style={{padding: '20px 0'}}>
                    {typeDetectionSteps.map((step, index) => (
                      <Timeline.Item key={index} color={step.status} label={step.time}>
                        {step.message}
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </div>
              </div> */}
              
              {questionType === 'image' && (
                <div className="images-container">
                  <Title level={4}>题目图片</Title>
                  <Row gutter={[16, 16]}>
                    {images.map((image, index) => (
                      <Col span={index === 0 ? 24 : 12} key={index}>
                        <Image
                          src={`http://localhost:3001${image.url}`}
                          alt={image.name}
                          className={index === 0 ? "main-image" : "sub-image"}
                        />
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
              
              {questionType === 'latex' && latexQuestion && (
                <div className="latex-container">
                  <Title level={4}>题目内容</Title>
                  <div className="latex-content">
                    <MathJaxContext>
                      <MathJax dynamic>{latexQuestion.latex_code}</MathJax>
                    </MathJaxContext>
                  </div>
                </div>
              )}
            </Card>
            
            <Card className="answer-card">
              <Title level={4}>答题区</Title>
              <div className="answer-options">
                <Radio.Group 
                  onChange={handleOptionChange} 
                  value={selectedOption}
                >
                  {answerOptions.map(option => (
                    <Radio key={option.value} value={option.value}>{option.label}</Radio>
                  ))}
                </Radio.Group>
                
                {selectedOption === 'custom' && (
                  <TextArea
                    rows={4}
                    placeholder="请输入您的答案"
                    value={customAnswer}
                    onChange={handleCustomAnswerChange}
                    className="custom-answer-input"
                  />
                )}
                
                <Button 
                  type="primary" 
                  onClick={handleAnswerSubmit} 
                  className="submit-button"
                  disabled={(!selectedOption || (selectedOption === 'custom' && !customAnswer)) || hasAnswered}
                >
                  提交答案
                </Button>
              </div>
              
              {isCorrect !== null && (
                <div className={`answer-result ${isCorrect ? 'correct' : 'incorrect'}`}>
                  {isCorrect ? (
                    <div className="correct-answer">
                      <CheckCircleOutlined className="icon" />
                      <span>回答正确！</span>
                    </div>
                  ) : (
                    <div className="incorrect-answer">
                      <CloseCircleOutlined className="icon" />
                      <span>回答错误！正确答案是：{correctAnswer}</span>
                    </div>
                  )}
                </div>
              )}
              
              {hasAnswered && (
                <div className="rating-container">
                  <Divider />
                  <Title level={5}>为本题打分</Title>
                  <div className="rating-controls">
                    <Rate 
                      value={ratingValue}
                      onChange={setRatingValue}
                      className="rate-stars"
                    />
                    <Button 
                      type="primary" 
                      onClick={submitRating}
                      loading={ratingSubmitting}
                      disabled={ratingValue === 0}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              )}
            </Card>
            
            {showRelatedPosts && relatedPosts.length > 0 && (
              <Card className="related-posts-card">
                <Title level={4}>引用了此题目的帖子</Title>
                {relatedPosts.map(post => (
                  <div key={post.id} className="related-post-item">
                    <h4>
                      <a href={`/post/${post.id}`} target="_blank" rel="noopener noreferrer">
                        {post.title}
                      </a>
                    </h4>
                    <div className="post-meta">
                      <span>作者: {post.author_name}</span>
                      <span>发布时间: {new Date(post.created_at).toLocaleString()}</span>
                      <span>分类: {post.category === 'question' ? '题目交流' : 
                                  post.category === 'study' ? '学习分享' : 
                                  post.category === 'entertainment' ? '娱乐活动' : '疑难解惑'}</span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </Col>
          
          <Col span={6}>
            <Card className="history-card">
              <Title level={4}>答题历史</Title>
              {previousAnswers.length > 0 ? (
                <div className="history-list">
                  {previousAnswers.map((answer, index) => (
                    <div key={index} className="history-item">
                      <div className="history-attempt">第 {answer.attempt_count} 次尝试</div>
                      <div className={`history-answer ${answer.correctness === 'correct' ? 'correct' : 'incorrect'}`}>
                        答案: {answer.answer_content}
                        {answer.correctness === 'correct' ? (
                          <CheckCircleOutlined className="history-icon correct" />
                        ) : (
                          <CloseCircleOutlined className="history-icon incorrect" />
                        )}
                      </div>
                      <div className="history-time">
                        {new Date(answer.answer_time).toLocaleString()}
                      </div>
                      <Divider />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-history">
                  <Text type="secondary">暂无答题记录</Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default QuestionView; 