import api from './api';

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/register', data);
    return response.data;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', data);
    return response.data;
  },

  async getMe(): Promise<{ user: User }> {
    const response = await api.get<{ user: User }>('/api/auth/me');
    return response.data;
  },

  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<{ message: string }> {
    const response = await api.put<{ message: string }>(
      '/api/auth/change-password',
      data
    );
    return response.data;
  },
};
