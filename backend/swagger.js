const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '学生端API文档',
      version: '1.0.0',
      description: '学生端系统的API文档',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: '开发服务器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '请输入JWT令牌（不需要Bearer前缀）'
        }
      }
    },
    paths: {
      '/login': {
        post: {
          summary: '用户登录',
          description: '用户通过邮箱和密码登录系统',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    password: { type: 'string' }
                  }
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
                      token: { 
                        type: 'string',
                        description: 'JWT格式的访问令牌' 
                      },
                      legacyToken: { 
                        type: 'string',
                        description: '旧版JSON格式的令牌（向后兼容）' 
                      },
                      user: { 
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          phone: { type: 'string' },
                          email: { type: 'string' },
                          school: { type: 'string' },
                          classNumber: { type: 'string' },
                          studentId: { type: 'string' },
                          name: { type: 'string' },
                          wechat: { type: 'string' },
                          registerTime: { type: 'string', format: 'date-time' },
                          lastLoginTime: { type: 'string', format: 'date-time' },
                          role: { type: 'string', enum: ['student', 'teacher', 'assistant', 'admin'] },
                          teacherUserId: { type: 'integer', nullable: true }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: '邮箱或密码为空'
            },
            401: {
              description: '用户不存在或密码错误'
            },
            500: {
              description: '登录失败'
            }
          }
        }
      },
      '/register': {
        post: {
          summary: '用户注册',
          description: '新用户注册账号',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    password: { type: 'string' },
                    school: { type: 'string' },
                    classNumber: { type: 'string' },
                    studentId: { type: 'string' },
                    name: { type: 'string' },
                    wechat: { type: 'string' },
                    isFromTeacher: { type: 'boolean', default: false }
                  },
                  required: ['email', 'password']
                }
              }
            }
          },
          responses: {
            200: {
              description: '注册成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      userId: { type: 'number' }
                    }
                  }
                }
              }
            },
            400: {
              description: '手机号、邮箱或密码为空，或学号已被注册'
            },
            500: {
              description: '注册失败'
            }
          }
        }
      },
      '/users': {
        get: {
          summary: '获取所有用户',
          description: '获取系统中所有用户信息（需要管理员、教师或助教权限）',
          security: [
            {
              bearerAuth: []
            }
          ],
          responses: {
            200: {
              description: '成功获取用户列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        phone: { type: 'string' },
                        email: { type: 'string' },
                        school: { type: 'string' },
                        classNumber: { type: 'string' },
                        studentId: { type: 'string' },
                        name: { type: 'string' },
                        wechat: { type: 'string' },
                        registerTime: { type: 'string', format: 'date-time' },
                        lastLoginTime: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: '未授权'
            },
            403: {
              description: '权限不足'
            },
            500: {
              description: '获取用户列表失败'
            }
          }
        }
      },
      '/users/{id}': {
        delete: {
          summary: '删除用户',
          description: '根据用户ID删除用户（仅限管理员角色可以使用，其他角色如student、teacher、assistant将会被拒绝访问）',
          security: [
            {
              bearerAuth: []
            }
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'integer'
              }
            }
          ],
          responses: {
            200: {
              description: '用户删除成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      operator: { 
                        type: 'object',
                        description: '执行删除操作的用户信息',
                        properties: {
                          id: { type: 'integer' },
                          role: { type: 'string', enum: ['admin'] },
                          name: { type: 'string' }
                        }
                      },
                      allowedRoles: {
                        type: 'array',
                        description: '允许执行此操作的角色列表',
                        items: {
                          type: 'string',
                          enum: ['admin']
                        }
                      }
                    }
                  }
                }
              }
            },
            401: {
              description: '未授权'
            },
            403: {
              description: '权限不足或无法删除特殊角色用户',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { 
                        type: 'string',
                        description: '错误信息',
                        example: '权限不足，无法访问此资源'
                      },
                      currentRole: { 
                        type: 'string',
                        description: '当前用户的角色',
                        example: 'undefined'
                      },
                      allowedRoles: { 
                        type: 'array',
                        description: '允许访问的角色列表',
                        items: { type: 'string' },
                        example: ['admin']
                      },
                      endpoint: {
                        type: 'string',
                        description: '请求的API端点',
                        example: '/users/123'
                      },
                      method: {
                        type: 'string',
                        description: '请求方法',
                        example: 'DELETE'
                      },
                      userInfo: {
                        type: 'object',
                        description: '当前用户信息',
                        properties: {
                          id: { type: 'integer', example: 456 },
                          name: { type: 'string', example: '张三' },
                          email: { type: 'string', example: 'zhangsan@example.com' }
                        }
                      }
                    }
                  }
                }
              }
            },
            404: {
              description: '用户不存在'
            },
            500: {
              description: '删除用户失败'
            }
          }
        },
        put: {
          summary: '更新用户信息',
          description: '根据用户ID更新用户信息（需要管理员、教师权限或是本人）',
          security: [
            {
              bearerAuth: []
            }
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
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
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    school: { type: 'string' },
                    classNumber: { type: 'string' },
                    studentId: { type: 'string' },
                    name: { type: 'string' },
                    wechat: { type: 'string' }
                  }
                },
                examples: {
                  validRequest: {
                    summary: '有效的请求',
                    value: {
                      phone: "0417",
                      school: "bupt",
                      classNumber: "1029",
                      studentId: "TA104",
                      name: "张三",
                      wechat: "example-wechat",
                      email: "student@example.com"
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: '用户信息更新成功',
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
              description: 'JSON格式错误或参数格式不正确',
              content: {
                'text/html': {
                  schema: {
                    type: 'string'
                  },
                  examples: {
                    jsonError: {
                      summary: 'JSON格式错误',
                      value: '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>SyntaxError: Expected double-quoted property name in JSON at position 174 (line 11 column 1)</pre>\n</body>\n</html>'
                    }
                  }
                }
              }
            },
            401: {
              description: '未授权'
            },
            403: {
              description: '权限不足'
            },
            404: {
              description: '用户不存在'
            },
            500: {
              description: '更新用户信息失败'
            }
          }
        }
      },
      '/users/{id}/reset-password': {
        post: {
          summary: '重置用户密码',
          description: '管理员或教师重置用户密码',
          security: [
            {
              bearerAuth: []
            }
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
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
                    newPassword: { type: 'string' }
                  },
                  required: ['newPassword']
                }
              }
            }
          },
          responses: {
            200: {
              description: '密码重置成功',
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
              description: '新密码不能为空'
            },
            401: {
              description: '未授权'
            },
            403: {
              description: '权限不足'
            },
            404: {
              description: '用户不存在'
            },
            500: {
              description: '重置密码失败'
            }
          }
        }
      },
      '/change-password': {
        put: {
          summary: '修改当前用户密码',
          description: '用户修改自己的密码',
          security: [
            {
              bearerAuth: []
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    currentPassword: { type: 'string' },
                    newPassword: { type: 'string' }
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
              description: '当前密码错误'
            },
            404: {
              description: '用户不存在'
            },
            500: {
              description: '修改密码失败'
            }
          }
        }
      },
      '/latex-questions': {
        get: {
          summary: '获取LaTeX题目列表',
          description: '获取所有或根据条件筛选的LaTeX题目',
          parameters: [
            {
              name: 'subject',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '科目'
            },
            {
              name: 'grade',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '年级'
            },
            {
              name: 'year',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '年份'
            },
            {
              name: 'type',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '题目类型'
            }
          ],
          responses: {
            200: {
              description: '成功获取题目列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            },
            500: {
              description: '获取题目失败'
            }
          }
        }
      },
      '/latex-questions/{path}': {
        get: {
          summary: '获取特定LaTeX题目',
          description: '根据路径获取特定LaTeX题目',
          parameters: [
            {
              name: 'path',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: '题目路径'
            }
          ],
          responses: {
            200: {
              description: '成功获取题目',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            },
            404: {
              description: '题目不存在'
            },
            500: {
              description: '获取题目失败'
            }
          }
        }
      },
      '/submit-answer': {
        post: {
          summary: '提交答案',
          description: '提交用户答案，重定向到userAnswers路由',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object'
                }
              }
            }
          },
          responses: {
            200: {
              description: '答案提交成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            },
            400: {
              description: '提交参数错误'
            },
            500: {
              description: '提交答案失败'
            }
          }
        }
      },
      '/folders': {
        get: {
          summary: '获取文件夹列表',
          description: '获取prtsc目录下的文件夹结构，支持按科目、年级、年份和类型筛选',
          parameters: [
            {
              name: 'subject',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '科目'
            },
            {
              name: 'grade',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '年级'
            },
            {
              name: 'year',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '年份'
            },
            {
              name: 'type',
              in: 'query',
              schema: {
                type: 'string'
              },
              description: '题目类型'
            }
          ],
          responses: {
            200: {
              description: '成功获取文件夹列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            500: {
              description: '获取文件夹列表失败'
            }
          }
        }
      },
      '/images': {
        get: {
          summary: '获取图片列表',
          description: '获取指定文件夹中的图片列表',
          parameters: [
            {
              name: 'folderPath',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              },
              description: '文件夹路径'
            }
          ],
          responses: {
            200: {
              description: '成功获取图片列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        url: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: '缺少必要参数'
            },
            404: {
              description: '文件夹不存在'
            },
            500: {
              description: '获取图片列表失败'
            }
          }
        }
      },
      '/upload': {
        post: {
          summary: '上传文件',
          description: '上传文件到服务器',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: '文件上传成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      filePath: { type: 'string' }
                    }
                  }
                }
              }
            },
            400: {
              description: '未选择文件或文件类型不支持'
            },
            500: {
              description: '文件上传失败'
            }
          }
        }
      },
      '/api/tx-ocr': {
        post: {
          summary: '腾讯OCR识别',
          description: '使用腾讯OCR服务识别图片',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    imageUrl: { type: 'string' }
                  },
                  required: ['imageUrl']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'OCR识别成功',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            },
            400: {
              description: '参数错误'
            },
            500: {
              description: 'OCR识别失败'
            }
          }
        }
      }
    },
  },
  apis: ['./sever.js'],
};

const specs = swaggerJsdoc(options);

module.exports = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
};