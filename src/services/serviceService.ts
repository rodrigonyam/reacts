import api from './api';
import type { Service } from '../types';

export const serviceService = {
  getAll: async () => {
    const { data } = await api.get<{ data: Service[] }>('/services');
    return data.data;
  },
  create: async (payload: Omit<Service, 'id'>) => {
    const { data } = await api.post<{ data: Service }>('/services', payload);
    return data.data;
  },
  update: async (id: string, payload: Partial<Service>) => {
    const { data } = await api.put<{ data: Service }>(`/services/${id}`, payload);
    return data.data;
  },
  delete: async (id: string) => {
    await api.delete(`/services/${id}`);
  },
};
