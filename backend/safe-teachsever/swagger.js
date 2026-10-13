const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '教师管理系统 API',
      version: '1.0.0',
      description: '教师管理系统的API文档',
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: '教师端开发服务器',
      },
    ],
    paths: {
      '/classes': {
        post: {
          summary: '创建班级',
          description: '创建一个新的班级并生成唯一班级码',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '班级名称' },
                    description: { type: 'string', description: '班级描述' }
                  },
                  required: ['name']
                }
              }
            }
          },
          responses: {
            201: {
              description: '班级创建成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      class: { 
                        type: 'object',
                        properties: {
                          id: { type: 'number' },
                          name: { type: 'string' },
                          description: { type: 'string' },
                          class_code: { type: 'string' },
                          teacher_id: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: '班级名称不能为空'
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            500: {
              description: '创建班级失败'
            }
          }
        },
        get: {
          summary: '获取班级列表',
          description: '获取当前教师创建的所有班级',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: '成功获取班级列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        class_code: { type: 'string' },
                        teacher_id: { type: 'number' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            500: {
              description: '获取班级列表失败'
            }
          }
        }
      },
      '/classes/{id}': {
        get: {
          summary: '获取班级详情',
          description: '获取指定班级的详细信息',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: '班级ID',
              schema: {
                type: 'integer'
              }
            }
          ],
          responses: {
            200: {
              description: '成功获取班级详情',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      class_code: { type: 'string' },
                      teacher_id: { type: 'number' },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            404: {
              description: '班级不存在或无权访问'
            },
            500: {
              description: '获取班级详情失败'
            }
          }
        },
        put: {
          summary: '更新班级信息',
          description: '更新指定班级的信息',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: '班级ID',
              schema: {
                type: 'integer'
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '班级名称' },
                    description: { type: 'string', description: '班级描述' }
                  },
                  required: ['name']
                }
              }
            }
          },
          responses: {
            200: {
              description: '班级信息更新成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      class: { 
                        type: 'object',
                        properties: {
                          id: { type: 'number' },
                          name: { type: 'string' },
                          description: { type: 'string' },
                          teacher_id: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: '班级名称不能为空'
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            404: {
              description: '班级不存在或无权修改'
            },
            500: {
              description: '更新班级信息失败'
            }
          }
        },
        delete: {
          summary: '删除班级',
          description: '删除指定的班级及其所有学生关联',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: '班级ID',
              schema: {
                type: 'integer'
              }
            }
          ],
          responses: {
            200: {
              description: '班级删除成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' }
                    }
                  }
                }
              }
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            404: {
              description: '班级不存在或无权删除'
            },
            500: {
              description: '删除班级失败'
            }
          }
        }
      },
      '/classes/{id}/students': {
        get: {
          summary: '获取班级学生列表',
          description: '获取指定班级中的所有学生',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: '班级ID',
              schema: {
                type: 'integer'
              }
            }
          ],
          responses: {
            200: {
              description: '成功获取班级学生列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        student_id: { type: 'string' },
                        gender: { type: 'string' },
                        join_date: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            404: {
              description: '班级不存在或无权访问'
            },
            500: {
              description: '获取班级学生列表失败'
            }
          }
        }
      },
      '/classes/{classId}/students/{studentId}': {
        delete: {
          summary: '从班级中移除学生',
          description: '将指定学生从班级中移除',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'classId',
              in: 'path',
              required: true,
              description: '班级ID',
              schema: {
                type: 'integer'
              }
            },
            {
              name: 'studentId',
              in: 'path',
              required: true,
              description: '学生ID',
              schema: {
                type: 'integer'
              }
            }
          ],
          responses: {
            200: {
              description: '学生已从班级中移除',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' }
                    }
                  }
                }
              }
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            404: {
              description: '班级不存在、学生不在班级中或无权操作'
            },
            500: {
              description: '从班级中移除学生失败'
            }
          }
        }
      },
      '/classes/code/{classCode}': {
        get: {
          summary: '验证班级码',
          description: '通过班级码获取班级基本信息',
          parameters: [
            {
              name: 'classCode',
              in: 'path',
              required: true,
              description: '班级码',
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            200: {
              description: '成功获取班级信息',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      name: { type: 'string' },
                      description: { type: 'string' }
                    }
                  }
                }
              }
            },
            404: {
              description: '无效的班级码'
            },
            500: {
              description: '验证班级码失败'
            }
          }
        }
      },
      '/classes/join': {
        post: {
          summary: '学生加入班级',
          description: '学生通过班级码加入班级',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    student_id: { type: 'number', description: '学生ID' },
                    class_code: { type: 'string', description: '班级码' }
                  },
                  required: ['student_id', 'class_code']
                }
              }
            }
          },
          responses: {
            201: {
              description: '成功加入班级',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      class: { 
                        type: 'object',
                        properties: {
                          id: { type: 'number' },
                          name: { type: 'string' },
                          description: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: '学生ID和班级码不能为空或学生已经加入该班级'
            },
            404: {
              description: '无效的班级码'
            },
            500: {
              description: '加入班级失败'
            }
          }
        }
      },
      '/register': {
        post: {
          summary: '教师注册',
          description: '新教师注册账号',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '教师姓名' },
                    gender: { type: 'string', enum: ['男', '女'], description: '性别' },
                    teacher_id: { type: 'string', description: '教师身份码' },
                    phone: { type: 'string', description: '手机号码' },
                    email: { type: 'string', description: '电子邮箱' },
                    wechat: { type: 'string', description: '微信号' },
                    school: { type: 'string', description: '所属学校' },
                    password: { type: 'string', description: '密码' }
                  },
                  required: ['name', 'teacher_id', 'school', 'password']
                }
              }
            }
          },
          responses: {
            201: {
              description: '注册成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      teacherId: { type: 'number' }
                    }
                  }
                }
              }
            },
            400: {
              description: '必填字段为空或教师身份码已达到最大注册次数限制'
            },
            500: {
              description: '注册失败'
            }
          }
        }
      },
      '/login': {
        post: {
          summary: '教师登录',
          description: '教师通过身份码和密码登录系统',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    teacher_id: { type: 'string', description: '教师身份码' },
                    password: { type: 'string', description: '密码' }
                  },
                  required: ['teacher_id', 'password']
                }
              }
            }
          },
          responses: {
            200: {
              description: '登录成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      teacher: { type: 'object' },
                      token: { type: 'string' }
                    }
                  }
                }
              }
            },
            400: {
              description: '教师身份码或密码为空'
            },
            401: {
              description: '教师不存在或密码错误'
            },
            500: {
              description: '登录失败'
            }
          }
        }
      },
      '/profile': {
        get: {
          summary: '获取教师信息',
          description: '获取当前登录教师的个人信息',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: '成功获取教师信息',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      name: { type: 'string' },
                      gender: { type: 'string' },
                      teacher_id: { type: 'string' },
                      phone: { type: 'string' },
                      email: { type: 'string' },
                      wechat: { type: 'string' },
                      school: { type: 'string' },
                      register_time: { type: 'string', format: 'date-time' },
                      last_login_time: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            404: {
              description: '教师不存在'
            },
            500: {
              description: '获取教师信息失败'
            }
          }
        },
        put: {
          summary: '更新教师信息',
          description: '更新当前登录教师的个人信息',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '教师姓名' },
                    gender: { type: 'string', enum: ['男', '女'], description: '性别' },
                    phone: { type: 'string', description: '手机号码' },
                    email: { type: 'string', description: '电子邮箱' },
                    wechat: { type: 'string', description: '微信号' },
                    school: { type: 'string', description: '所属学校' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: '教师信息更新成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' }
                    }
                  }
                }
              }
            },
            401: {
              description: '未提供访问令牌'
            },
            403: {
              description: '令牌无效或已过期'
            },
            500: {
              description: '更新教师信息失败'
            }
          }
        }
      },
      '/change-password': {
        put: {
          summary: '修改密码',
          description: '修改当前登录教师的密码',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    currentPassword: { type: 'string', description: '当前密码' },
                    newPassword: { type: 'string', description: '新密码' }
                  },
                  required: ['currentPassword', 'newPassword']
                }
              }
            }
          },
          responses: {
            200: {
              description: '密码修改成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' }
                    }
                  }
                }
              }
            },
            400: {
              description: '当前密码和新密码不能为空'
            },
            401: {
              description: '未提供访问令牌或当前密码错误'
            },
            403: {
              description: '令牌无效或已过期'
            },
            404: {
              description: '教师不存在'
            },
            500: {
              description: '修改密码失败'
            }
          }
        }
      },
      '/teachers': {
        get: {
          summary: '获取所有教师列表',
          description: '获取系统中所有教师信息（仅供管理员使用）',
          responses: {
            200: {
              description: '成功获取教师列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        gender: { type: 'string' },
                        teacher_id: { type: 'string' },
                        phone: { type: 'string' },
                        email: { type: 'string' },
                        wechat: { type: 'string' },
                        school: { type: 'string' },
                        register_time: { type: 'string', format: 'date-time' },
                        last_login_time: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            },
            500: {
              description: '获取教师列表失败'
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./server.js'],
};

const specs = swaggerJsdoc(options);

module.exports = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
};