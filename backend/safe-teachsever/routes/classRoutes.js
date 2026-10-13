// 先加载私有运行配置，禁止在源码中保存凭据。
require('../../config/runtime');
const express = require('express');
const router = express.Router();
const classModel = require('../models/classModel');
const jwt = require('jsonwebtoken');
const { checkMaxClassCount, checkCanViewAllStudents } = require('../../config-city/server-nacos/middleware/permissionsMiddleware');

// 中间件：验证JWT令牌
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }
  
  jwt.verify(token, require('../../config/runtime').requireEnv('TEACHER_JWT_SECRET'), (err, teacher) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    req.teacher = teacher;
    next();
  });
};

// 初始化班级相关数据库表
classModel.initTables().then(success => {
  if (success) {
    console.log('班级相关数据库表初始化成功');
  } else {
    console.error('班级相关数据库表初始化失败');
  }
});

// 创建新班级
router.post('/', authenticateToken, checkMaxClassCount, async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '班级名称不能为空' });
  }
  
  try {
    const classData = {
      name,
      description: description || '',
      teacher_id: req.teacher.id
    };
    
    const newClass = await classModel.createClass(classData);
    
    res.status(201).json({
      message: '班级创建成功',
      class: newClass
    });
  } catch (error) {
    console.error('创建班级错误:', error);
    res.status(500).json({ error: '创建班级失败', details: error.message });
  }
});

// 获取教师创建的所有班级
router.get('/', authenticateToken, async (req, res) => {
  try {
    const classes = await classModel.getTeacherClasses(req.teacher.id);
    
    res.json(classes);
  } catch (error) {
    console.error('获取班级列表错误:', error);
    res.status(500).json({ error: '获取班级列表失败', details: error.message });
  }
});

// 获取班级详情
router.get('/:id', authenticateToken, async (req, res) => {
  const classId = req.params.id;
  
  try {
    const classDetails = await classModel.getClassById(classId, req.teacher.id);
    
    if (!classDetails) {
      return res.status(404).json({ error: '班级不存在或无权访问' });
    }
    
    res.json(classDetails);
  } catch (error) {
    console.error('获取班级详情错误:', error);
    res.status(500).json({ error: '获取班级详情失败', details: error.message });
  }
});

// 更新班级信息
router.put('/:id', authenticateToken, async (req, res) => {
  const classId = req.params.id;
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '班级名称不能为空' });
  }
  
  try {
    const classData = {
      name,
      description: description || ''
    };
    
    const updatedClass = await classModel.updateClass(classId, req.teacher.id, classData);
    
    if (!updatedClass) {
      return res.status(404).json({ error: '班级不存在或无权修改' });
    }
    
    res.json({
      message: '班级信息更新成功',
      class: updatedClass
    });
  } catch (error) {
    console.error('更新班级信息错误:', error);
    res.status(500).json({ error: '更新班级信息失败', details: error.message });
  }
});

// 删除班级
router.delete('/:id', authenticateToken, async (req, res) => {
  const classId = req.params.id;
  
  try {
    const success = await classModel.deleteClass(classId, req.teacher.id);
    
    if (!success) {
      return res.status(404).json({ error: '班级不存在或无权删除' });
    }
    
    res.json({ message: '班级删除成功' });
  } catch (error) {
    console.error('删除班级错误:', error);
    res.status(500).json({ error: '删除班级失败', details: error.message });
  }
});

// 获取班级学生列表
router.get('/:id/students', authenticateToken, checkCanViewAllStudents, async (req, res) => {
  const classId = req.params.id;
  
  try {
    const students = await classModel.getClassStudents(classId, req.teacher.id);
    
    if (students === null) {
      return res.status(404).json({ error: '班级不存在或无权访问' });
    }
    
    res.json(students);
  } catch (error) {
    console.error('获取班级学生列表错误:', error);
    res.status(500).json({ error: '获取班级学生列表失败', details: error.message });
  }
});

// 从班级中移除学生
router.delete('/:classId/students/:studentId', authenticateToken, async (req, res) => {
  const { classId, studentId } = req.params;
  
  try {
    const success = await classModel.removeStudentFromClass(studentId, classId, req.teacher.id);
    
    if (!success) {
      return res.status(404).json({ error: '班级不存在、学生不在班级中或无权操作' });
    }
    
    res.json({ message: '学生已从班级中移除' });
  } catch (error) {
    console.error('从班级中移除学生错误:', error);
    res.status(500).json({ error: '从班级中移除学生失败', details: error.message });
  }
});

// 验证班级码
router.get('/code/:classCode', async (req, res) => {
  const { classCode } = req.params;
  
  try {
    const classInfo = await classModel.findClassByCode(classCode);
    
    if (!classInfo) {
      return res.status(404).json({ error: '无效的班级码' });
    }
    
    // 只返回班级的基本信息，不包括敏感数据
    const { id, name, description } = classInfo;
    
    res.json({
      id,
      name,
      description
    });
  } catch (error) {
    console.error('验证班级码错误:', error);
    res.status(500).json({ error: '验证班级码失败', details: error.message });
  }
});

// 学生加入班级
router.post('/join', async (req, res) => {
  const { student_id, class_code } = req.body;
  
  if (!student_id || !class_code) {
    return res.status(400).json({ error: '学生ID和班级码不能为空' });
  }
  
  try {
    // 查找班级
    const classInfo = await classModel.findClassByCode(class_code);
    
    if (!classInfo) {
      return res.status(404).json({ error: '无效的班级码' });
    }
    
    // 学生加入班级
    const result = await classModel.joinClass(student_id, classInfo.id);
    
    if (result.alreadyJoined) {
      return res.status(400).json({ error: '学生已经加入该班级' });
    }
    
    res.status(201).json({
      message: '成功加入班级',
      class: {
        id: classInfo.id,
        name: classInfo.name,
        description: classInfo.description
      }
    });
  } catch (error) {
    console.error('加入班级错误:', error);
    res.status(500).json({ error: '加入班级失败', details: error.message });
  }
});

// 获取学生已加入的班级列表
router.get('/students/:studentId/classes', async (req, res) => {
  const studentId = req.params.studentId;
  
  if (!studentId) {
    return res.status(400).json({ error: '学生ID不能为空' });
  }
  
  try {
    const classes = await classModel.getStudentClasses(studentId);
    res.json(classes);
  } catch (error) {
    console.error('获取学生已加入班级列表错误:', error);
    res.status(500).json({ error: '获取学生已加入班级列表失败-sever', details: error.message });
  }
});

module.exports = router;