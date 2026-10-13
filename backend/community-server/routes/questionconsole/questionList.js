/**
 * 题目管理路由 - 题目列表相关功能
 */
const axios = require('axios');
const { executeWithRetry, generateQuestionId, handleFolderRecursively } = require('./questionUtils');

/**
 * 获取题目列表
 */
const getQuestionList = async (req, res) => {
  const { 
    teacherId, 
    subject, 
    year, 
    type,
    grade, 
    selectionStatus = 'all', 
    page = 1, 
    limit = 10,
    tab = 'all'
  } = req.query;
  
  if (!teacherId) {
    return res.status(400).json({ message: '缺少必要参数: teacherId' });
  }
  
  try {
    console.log(`获取题目列表请求, 教师ID: ${teacherId}, 筛选条件:`, req.query);
    
    // 查询已选题目
    const selectedQuestions = await executeWithRetry(async (conn) => {
      const [rows] = await conn.query(
        `SELECT question_id, question_type, question_folder_or_id 
         FROM teachers_selected_questions 
         WHERE teacher_id = ?`,
        [teacherId]
      );
      return rows;
    });
    
    // 构建已选题目ID映射
    const selectedMap = new Map();
    selectedQuestions.forEach(q => {
      const key = `${q.question_type}-${q.question_id}`;
      selectedMap.set(key, q.question_folder_or_id);
    });
    
    // 构建API请求参数
    const latexParams = {};
    const imageParams = {};
    
    if (subject) {
      latexParams.subject = subject;
      imageParams.subject = subject;
    }
    if (year) {
      latexParams.year = year;
      imageParams.year = year;
    }
    if (type) {
      latexParams.type = type;
      imageParams.type = type;
    }
    if (grade) {
      latexParams.grade = grade;
      imageParams.grade = grade;
    }
    
    // 获取题目数据
    let latexQuestions = [];
    let imageQuestions = [];
    
    // 根据tab决定获取哪种类型的题目
    if (tab === 'all' || tab === 'latex') {
      // 获取LaTeX题目
      try {
        const latexResponse = await axios.get('http://localhost:3001/latex-questions', {
          params: latexParams
        });
        latexQuestions = Array.isArray(latexResponse.data) ? latexResponse.data : [];
        
        // 添加类型标记和选中状态
        latexQuestions = latexQuestions.map(q => ({
          ...q,
          id: parseInt(q.id),
          type: 'latex',
          is_selected: selectedMap.has(`latex-${q.id}`)
        }));
      } catch (error) {
        console.error('获取LaTeX题目失败:', error);
      }
    }
    
    if (tab === 'all' || tab === 'image') {
      // 获取文件夹结构
      try {
        console.log('获取图片题目，参数:', imageParams);
        
        // 使用遍历方法获取所有题目，然后根据筛选条件过滤
        // 第一步：获取所有科目
        const allSubjectsResponse = await axios.get('http://localhost:3001/folders');
        let allSubjects = [];
        
        if (Array.isArray(allSubjectsResponse.data)) {
          allSubjects = allSubjectsResponse.data;
        } else if (allSubjectsResponse.data && Array.isArray(allSubjectsResponse.data.folders)) {
          allSubjects = allSubjectsResponse.data.folders;
        }
        
        console.log(`获取到 ${allSubjects.length} 个科目`);
        
        // 根据筛选条件过滤科目
        const subjectsToProcess = subject 
          ? allSubjects.filter(s => s.name === subject)
          : allSubjects;
          
        // 逐个处理每个科目
        for (const subjectFolder of subjectsToProcess) {
          // 获取科目下的年级
          const gradesResponse = await axios.get('http://localhost:3001/folders', {
            params: { subject: subjectFolder.name }
          });
          
          let grades = [];
          if (Array.isArray(gradesResponse.data)) {
            grades = gradesResponse.data;
          } else if (gradesResponse.data && Array.isArray(gradesResponse.data.folders)) {
            grades = gradesResponse.data.folders;
          }
          
          // 根据筛选条件过滤年级
          const gradesToProcess = grade 
            ? grades.filter(g => g.name === grade)
            : grades;
            
          console.log(`科目 ${subjectFolder.name} 下筛选后处理 ${gradesToProcess.length} 个年级`);
          
          // 逐个处理每个年级
          for (const gradeFolder of gradesToProcess) {
            // 获取年级下的年份
            const yearsResponse = await axios.get('http://localhost:3001/folders', {
              params: { 
                subject: subjectFolder.name,
                grade: gradeFolder.name 
              }
            });
            
            let years = [];
            if (Array.isArray(yearsResponse.data)) {
              years = yearsResponse.data;
            } else if (yearsResponse.data && Array.isArray(yearsResponse.data.folders)) {
              years = yearsResponse.data.folders;
            }
            
            // 根据筛选条件过滤年份
            const yearsToProcess = year 
              ? years.filter(y => y.name === year)
              : years;
              
            console.log(`年级 ${gradeFolder.name} 下筛选后处理 ${yearsToProcess.length} 个年份`);
            
            // 逐个处理每个年份
            for (const yearFolder of yearsToProcess) {
              // 获取年份下的题目类型
              const typesResponse = await axios.get('http://localhost:3001/folders', {
                params: { 
                  subject: subjectFolder.name,
                  grade: gradeFolder.name,
                  year: yearFolder.name 
                }
              });
              
              let types = [];
              if (Array.isArray(typesResponse.data)) {
                types = typesResponse.data;
              } else if (typesResponse.data && Array.isArray(typesResponse.data.folders)) {
                types = typesResponse.data.folders;
              }
              
              // 根据筛选条件过滤题目类型
              const typesToProcess = type 
                ? types.filter(t => t.name === type)
                : types;
                
              console.log(`年份 ${yearFolder.name} 下筛选后处理 ${typesToProcess.length} 个题目类型`);
              
              // 逐个处理每个题目类型
              for (const typeFolder of typesToProcess) {
                // 获取题目类型下的文件夹（具体题目）
                const questionsResponse = await axios.get('http://localhost:3001/folders', {
                  params: { 
                    subject: subjectFolder.name,
                    grade: gradeFolder.name,
                    year: yearFolder.name,
                    type: typeFolder.name 
                  }
                });
                
                let questions = [];
                if (Array.isArray(questionsResponse.data)) {
                  questions = questionsResponse.data;
                } else if (questionsResponse.data && Array.isArray(questionsResponse.data.folders)) {
                  questions = questionsResponse.data.folders;
                }
                
                console.log(`题目类型 ${typeFolder.name} 下有 ${questions.length} 个题目文件夹`);
                
                // 处理每个题目文件夹
                for (const questionFolder of questions) {
                  try {
                    // 构建完整路径
                    const folderPath = `${subjectFolder.name}/${gradeFolder.name}/${yearFolder.name}/${typeFolder.name}/${questionFolder.name}`;
                    
                    // 获取图片
                    const imageResponse = await axios.get('http://localhost:3001/images', {
                      params: { folderPath }
                    });
                    
                    if (imageResponse.data && imageResponse.data.length > 0) {
                      // 为每个文件夹创建一个题目对象
                      const questionId = generateQuestionId(questionFolder.name);
                      imageQuestions.push({
                        id: questionId,
                        type: 'image',
                        subject: subjectFolder.name,
                        grade: gradeFolder.name,
                        year: yearFolder.name,
                        question_type: typeFolder.name,
                        folder_name: questionFolder.name,
                        path: folderPath,
                        images: imageResponse.data,
                        is_selected: selectedMap.has(`image-${questionId}`)
                      });
                    }
                  } catch (questionError) {
                    console.error(`处理题目文件夹 ${questionFolder.name} 时出错:`, questionError);
                  }
                }
              }
            }
          }
        }
        
        console.log(`总共获取到 ${imageQuestions.length} 个图片题目`);
      } catch (folderError) {
        console.error('获取文件夹结构失败:', folderError);
      }
    }
    
    // 合并题目
    let allQuestions = [...latexQuestions, ...imageQuestions];
    
    // 根据选中状态筛选
    if (selectionStatus === 'selected') {
      allQuestions = allQuestions.filter(q => q.is_selected);
    } else if (selectionStatus === 'unselected') {
      allQuestions = allQuestions.filter(q => !q.is_selected);
    }
    
    // 分页处理
    const startIndex = (page - 1) * limit;
    const paginatedQuestions = allQuestions.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({
      questions: paginatedQuestions,
      total: allQuestions.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(allQuestions.length / limit)
    });
    
  } catch (error) {
    console.error('获取题目列表失败:', error);
    res.status(500).json({ message: '获取题目列表失败', error: error.message });
  }
};

module.exports = {
  getQuestionList
}; 