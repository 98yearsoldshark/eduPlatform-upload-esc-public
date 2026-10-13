# 角色权限定义
roles:
  # 教师角色权限
  teacher:
    canAssignAssistant: true        # 教师可以分配助教角色
    canViewAllStudents: true        # 教师可以查看班级所有学生数据
    maxClassCount: 10               # 教师最多可以管理10个班级
    canDeleteStudentWorks: true     # 教师可以删除学生提交的作业
    canModifyQuestions: true        # 教师可以修改题库中的题目
  
  # 助教角色权限
  assistant:
    canManageClass: true            # 助教可以管理班级
    canGradeAssignments: true       # 助教可以批改作业
    canPublishNotifications: false  # 助教不能发布系统通知
    canViewStudentDetails: true     # 助教可以查看学生详细信息
    canModerateCommunity: false     # 助教不能管理社区内容
  
  # 管理员角色权限  
  admin:
    canAssignTeacher: true          # 管理员可以分配教师角色
    canAssignAdmin: false           # 管理员不能分配其他管理员
    canAccessSystemConfig: false    # 管理员不能访问系统配置
    canViewAllUserData: true        # 管理员可以查看所有用户数据
    canManageAnnouncements: true    # 管理员可以管理系统公告
#===== 0502 =========== 已经完成前9行实现 ==========================================================
   我发现目前@permissions.yaml 这个文件里面的配置没有实际的后端代码支持，意味着这里面的配置信息在项目中是不起作用的，我想逐步实现这里面的配置功能。首先完成配置文件中前9行的功能实现，要求在后端具有实际作用，在前端文件能实际实现这些功能。在@SupremeAdmin.tsx 页面能进行这些功能的实时配置。帮我进行修改代码，注意添加部分讲解并生成日志files.mdc 。下面是提示，1，canAssignAssistant、canViewAllStudents这两个功能在教师端前端已有相关的功能，2，maxClassCount这个功能涉及班级数量，需要查找教师端后端关于创建班级的代码，其中数据库名称为classes，3，canModifyQuestions这个功能是教师端前端的题目管理方面，如果参数改为false，则题目不能选入，不能修改latex浏览器内部的操作，不能进行文件浏览器内部一些操作
#======================== 提示词 =================================================================

# 安全策略设置
policies:
  enableIpWhitelist: false          # 不启用IP白名单限制
  adminIpWhitelist:                 # 管理员IP白名单列表
    - 127.0.0.1                     # 本地回环地址
    - "::1"                         # IPv6本地回环地址
  maxLoginAttempts: 5               # 最大登录失败尝试次数为5次
  accountLockTime: 30               # 账号锁定时间为30分钟
  passwordExpiryDays: 90            # 密码有效期为90天
  passwordPolicy:                   # 密码策略
    minLength: 8                    # 密码最小长度8字符
    requireUppercase: true          # 需要包含大写字母
    requireLowercase: true          # 需要包含小写字母
    requireNumbers: true            # 需要包含数字
    requireSpecialChars: true       # 需要包含特殊字符
  sessionTimeout: 120               # 会话超时时间为120分钟
  allowMultipleDevices: false       # 不允许多设备同时登录
  logSensitiveOperations: true      # 记录敏感操作日志

# 社区功能设置
community:
  enabled: true                     # 启用社区功能
  postModeration:                   # 帖子审核设置
    enabled: true                   # 启用帖子审核
    exemptRoles:                    # 免审核角色
      - admin                       # 管理员发帖不需要审核
      - teacher                     # 教师发帖不需要审核
  commentControl:                   # 评论控制
    allowAnonymous: false           # 不允许匿名评论
    enableWordFilter: true          # 启用敏感词过滤
    maxLength: 500                  # 评论最大长度500字符
  userControl:                      # 用户控制
    requireInvitationCode: false    # 不需要邀请码注册
    allowUsernameChange: true       # 允许用户修改用户名
    usernameChangeCooldown: 30      # 用户名修改冷却期30天