import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token into requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('elt-cert-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('elt-cert-token');
      localStorage.removeItem('elt-cert-user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
