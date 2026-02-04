/**
 * 认证相关类型定义
 */

/**
 * 用户类型
 */
export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

/**
 * 注册请求类型
 */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

/**
 * 登录请求类型
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 认证响应类型
 */
export interface AuthResponse {
  token: string;
  user: User;
}
