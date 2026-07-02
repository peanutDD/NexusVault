import api from './api';

export const fileCategoryService = {
  async getCategories(): Promise<string[]> {
    const response = await api.get<{ categories: string[] }>('/api/files/categories');
    return response.data.categories;
  },

  async batchMove(ids: string[], category: string | null): Promise<{ moved: number }> {
    const response = await api.post<{ moved: number; message: string }>(
      '/api/files/batch-move',
      { ids, category: category ?? '' },
    );
    return { moved: response.data.moved };
  },
};
