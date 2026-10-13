/**
 * 认证工具函数
 * 提供处理不同格式token的工具函数
 */

// 存储JWT格式的token
export const storeJwtToken = (token: string, userId?: number | string) => {
  // 存储JWT格式token
  localStorage.setItem('token', token);
  
  // 如果提供了userId，单独存储
  if (userId !== undefined) {
    localStorage.setItem('userId', String(userId));
  }
  
  console.log('已存储JWT格式token');
};

// 存储JSON格式的token
export const storeJsonToken = (userData: any) => {
  // 存储完整的JSON对象作为token
  const jsonToken = JSON.stringify({ user: userData });
  localStorage.setItem('token', jsonToken);
  
  // 同时存储userId方便直接访问
  if (userData && userData.id) {
    localStorage.setItem('userId', String(userData.id));
  }
  
  console.log('已存储JSON格式token');
  
  return jsonToken;
};

// 存储两种格式token
export const storeTokens = (jwtToken: string, userData: any) => {
  // 存储JWT格式token作为主token
  localStorage.setItem('token', jwtToken);
  
  // 存储JSON格式token作为备用
  const jsonToken = JSON.stringify({ user: userData });
  localStorage.setItem('jsonToken', jsonToken);
  
  // 单独存储userId方便直接访问
  if (userData && userData.id) {
    localStorage.setItem('userId', String(userData.id));
  }
  
  console.log('已同时存储JWT和JSON格式token');
};

/**
 * 解码可能被错误编码的UTF-8字符串
 * 常用于处理JWT解码后中文显示乱码的问题
 * @param str 需要解码的字符串
 * @returns 解码后的字符串，如果解码失败则返回原始字符串
 */
export const decodeUTF8 = (str: string): string => {
  if (!str) return str;
  
  try {
    // 尝试解码可能被错误编码的UTF-8字符串
    return decodeURIComponent(escape(str));
  } catch (e) {
    console.error('解码UTF-8字符串失败:', e);
    return str; // 如果解码失败，返回原始字符串
  }
};

/**
 * 处理对象中可能包含中文的字段
 * @param obj 需要处理的对象
 * @param fields 需要处理的字段名数组，如果不提供则处理所有string类型字段
 * @returns 处理后的新对象
 */
export const decodeObject = (obj: any, fields?: string[]): any => {
  if (!obj) return obj;
  
  const result: any = { ...obj };
  
  // 如果提供了特定字段列表，只处理这些字段
  if (fields && fields.length > 0) {
    fields.forEach(field => {
      if (typeof result[field] === 'string') {
        result[field] = decodeUTF8(result[field]);
      }
    });
    return result;
  }
  
  // 否则处理对象中所有字符串类型的字段
  Object.keys(result).forEach(key => {
    if (typeof result[key] === 'string') {
      result[key] = decodeUTF8(result[key]);
    }
  });
  
  return result;
};

// 解析任意格式的token，提取用户信息
export const parseToken = () => {
  // 首先尝试从userInfo中获取用户数据（最完整的用户信息）
  const userInfoStr = localStorage.getItem('userInfo');
  if (userInfoStr) {
    try {
      const userInfo = JSON.parse(userInfoStr);
      console.log('从localStorage的userInfo获取到完整用户信息');
      return decodeObject(userInfo); // 解码中文字段并返回
    } catch (error) {
      console.error('解析userInfo失败:', error);
      // 继续尝试其他方法
    }
  }
  
  // 如果userInfo不存在或解析失败，尝试从token获取
  const tokenStr = localStorage.getItem('token');
  if (!tokenStr) return null;
  
  // 存储日志
  console.log('开始解析token:', tokenStr.substring(0, 20) + '...');
  
  try {
    // 方法1：尝试作为JSON对象解析
    let userData = null;
    try {
      const tokenData = JSON.parse(tokenStr);
      if (tokenData && tokenData.user) {
        userData = tokenData.user;
        console.log('从JSON格式token获取到用户信息');
      }
    } catch (parseError) {
      console.log('Token不是JSON格式，可能是JWT格式:', tokenStr.substring(0, 20) + '...');
    }
    
    // 方法2：如果JSON解析失败，尝试JWT格式解析
    if (!userData) {
      try {
        const jwtParts = tokenStr.split('.');
        if (jwtParts.length === 3) {
          const payload = JSON.parse(atob(jwtParts[1]));
          if (payload) {
            // 尝试从不同的字段提取用户ID
            const userId = payload.userId || payload.id || payload.sub || null;
            if (userId) {
              console.log('从JWT payload解析到用户ID:', userId);
              userData = { 
                id: Number(userId),
                // 可能包含的其他信息
                name: payload.name || payload.username,
                email: payload.email,
                role: payload.role
              };
            }
          }
        }
      } catch (jwtError) {
        console.error('解析JWT失败:', jwtError);
      }
    }
    
    // 方法3：尝试从jsonToken中获取（如果存在）
    if (!userData) {
      const jsonTokenStr = localStorage.getItem('jsonToken');
      if (jsonTokenStr) {
        try {
          const jsonData = JSON.parse(jsonTokenStr);
          if (jsonData && jsonData.user) {
            userData = jsonData.user;
            console.log('从备用jsonToken获取到用户信息');
          }
        } catch (e) {
          console.error('解析jsonToken失败:', e);
        }
      }
    }
    
    // 方法4：从localStorage中获取userId
    if (!userData) {
      const userId = localStorage.getItem('userId');
      if (userId) {
        console.log('从localStorage直接获取userId:', userId);
        userData = { id: Number(userId) };
      }
    }
    
    // 如果成功获取用户信息，处理可能的中文编码问题
    if (userData) {
      userData = decodeObject(userData);
    }
    
    return userData;
  } catch (error) {
    console.error('解析用户数据失败:', error);
    return null;
  }
};

// 检查用户是否已认证
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  // 简单验证：如果有token就认为已认证
  // 更复杂的验证可以检查token是否过期等
  return true;
};

// 登出
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('jsonToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('userInfo');
}; 