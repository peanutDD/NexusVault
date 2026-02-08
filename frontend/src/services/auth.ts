import api from './api';
import type { User, RegisterRequest, LoginRequest, AuthResponse } from '../types';

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

  async updateProfile(data: {
    username: string;
    email: string;
  }): Promise<{ user: User }> {
    const response = await api.put<{ user: User }>(
      '/api/auth/update-profile',
      data
    );
    return response.data;
  },

  async checkProfileAvailability(params: {
    username: string;
    email: string;
  }): Promise<{
    username_available: boolean;
    email_available: boolean;
  }> {
    const response = await api.get<{
      username_available: boolean;
      email_available: boolean;
    }>('/api/auth/check-profile-availability', { params });
    return response.data;
  },
};
