# 学生用户注册配置
# 控制学生账号的注册流程和验证要求
studentRegister:
  enabled: true                   # 是否启用学生注册功能，关闭后只能由管理员创建账号
  requireEmail: true              # 注册时是否必须验证邮箱，增加账号真实性
  requirePhone: true              # 注册时是否必须验证手机号，加强身份验证
  allowOpenRegistration: true     # 是否允许公开注册，关闭则需邀请码
  maxAccountsPerIp: 5             # 单个IP地址最多可注册账号数，防止批量注册
  registerCooldown: 60            # 同一IP两次注册之间的最小间隔(秒)，防止频繁注册

# 教师用户注册配置
# 控制教师账号的创建方式和验证流程
teacherRegister:
  enabled: true                   # 是否启用教师自主注册功能
  maxRegisterPerTeacherId: 5      # 单个教师工号/证件号可注册的最大账号数
  requireApproval: false          # 教师注册后是否需要管理员审核才能使用
  allowSelfRegister: true         # 是否允许教师自己注册，关闭则只能由管理员创建
  requireSchool: true             # 注册时是否必须填写所属学校信息

# 注册安全配置
# 控制注册过程的安全措施和限制条件
security:
  useRecaptcha: false             # 是否使用Google reCAPTCHA验证码防止机器人注册
  recaptchaKey: ""                # reCAPTCHA站点密钥，验证码功能开启时必填
  allowPasswordReset: true        # 是否允许用户自助重置密码，关闭则需管理员重置
  minimumPasswordLength: 3        # 注册时密码的最小长度要求
  restrictedDomains: []           # 禁止使用的邮箱域名列表，如spam.com
  restrictedEmails: []            # 具体禁止注册的邮箱地址列表