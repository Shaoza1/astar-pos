import axios from 'axios';

import { getOfflineDb } from '@/store/offline.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return;
      }
      if (!error.response) {
        // Network error — queue for retry
        const req = error.config;
        if (req?.method === 'post' && req.url && req.data) {
          try {
            const db = await getOfflineDb();
            await db.offline_queue.insert({
              id: crypto.randomUUID(),
              url: req.url,
              body: typeof req.data === 'string' ? req.data : JSON.stringify(req.data),
              createdAt: new Date().toISOString(),
              status: 'pending',
            });
          } catch {
            // best-effort
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
