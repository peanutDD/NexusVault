import api from './api';
import type { User, RegisterRequest, LoginRequest, AuthResponse } from '../types/auth';

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/register', data);
    return response.data;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', data);
    return response.data;
  },

  async getGithubOAuthUrl(): Promise<{ url: string }> {
    const response = await api.get<{ url: string }>('/api/auth/oauth/github/url');
    return response.data;
  },

  async getMe(): Promise<{ user: User }> {
    const response = await api.get<{ user: User }>('/api/auth/me');
    return response.data;
  },

  async getMeWithToken(token: string): Promise<{ user: User }> {
    const response = await api.get<{ user: User }>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await api.put<unknown>('/api/auth/change-password', data);
    const payload = response.data as { success?: unknown; message?: unknown } | null;
    if (!payload || payload.success !== true || typeof payload.message !== 'string') {
      throw new Error('Password change failed');
    }
    return { success: true, message: payload.message };
  },

  async sendEmailVerification(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      '/api/auth/send-email-verification',
      { email }
    );
    return response.data;
  },

  async updateProfile(data: {
    username: string;
    email: string;
    email_verification_code?: string;
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
