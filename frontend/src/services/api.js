import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vtms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Backend-signed Administrator training session token.
  // The API validates it (admin must still be ACTIVE/ADMIN) and opens a
  // training context for the selected portal. No account is impersonated.
  const trainingToken = localStorage.getItem('vtms_training_token');
  if (trainingToken) {
    config.headers['X-Training-Token'] = trainingToken;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const message = err.response.data?.message || '';
      const sentTrainingToken = !!(
        err.config?.headers?.['X-Training-Token'] ||
        err.config?.headers?.['x-training-token']
      );

      // The administrator is still signed in - only the training session
      // expired. Return them to the Admin Training portal instead of
      // logging them out.
      if (sentTrainingToken && message.startsWith('Training session')) {
        localStorage.removeItem('vtms_training_token');
        localStorage.removeItem('vtms_training_portal');
        if (!window.location.pathname.startsWith('/admin/training')) {
          window.location.href = '/admin/training';
        }
        return Promise.reject(err);
      }

      localStorage.removeItem('vtms_token');
      localStorage.removeItem('vtms_user');
      localStorage.removeItem('vtms_training_token');
      localStorage.removeItem('vtms_training_portal');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
