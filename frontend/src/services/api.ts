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
// Only force logout if the 401 comes from an auth endpoint or /auth/me.
// A 401 on a data endpoint (e.g. missing permission) should not kill the session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/me') || url.includes('/auth/login');
    if (status === 401 && isAuthEndpoint) {
      localStorage.removeItem('elt-cert-token');
      localStorage.removeItem('elt-cert-user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
