import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refreshToken }),
};

// Access Keys API
export const accessKeysAPI = {
  getAll: (serverId, status) =>
    api.get('/access-keys', { params: { serverId, status } }),
  getOne: (keyId) => api.get(`/access-keys/${keyId}`),
  create: (keyData) => api.post('/access-keys', keyData),
  update: (keyId, keyData) => api.put(`/access-keys/${keyId}`, keyData),
  delete: (keyId) => api.delete(`/access-keys/${keyId}`),
  toggleStatus: (keyId, status) =>
    api.patch(`/access-keys/${keyId}/status`, { status }),
};

// Servers API
export const serversAPI = {
  getAll: (region, provider, isActive) =>
    api.get('/servers', { params: { region, provider, isActive } }),
  getAccessible: () => api.get('/servers/accessible'),
  getOne: (serverId) => api.get(`/servers/${serverId}`),
  create: (serverData) => api.post('/servers', serverData),
  update: (serverId, serverData) => api.put(`/servers/${serverId}`, serverData),
  delete: (serverId) => api.delete(`/servers/${serverId}`),
  healthCheck: (serverId) => api.post(`/servers/${serverId}/health-check`),
  getMetrics: (serverId) => api.get(`/servers/${serverId}/metrics`),
  getAccessKeys: (serverId) => api.get(`/servers/${serverId}/access-keys`),
};

// Users API
export const usersAPI = {
  getAll: (role, plan, isActive) =>
    api.get('/users', { params: { role, plan, isActive } }),
  getOne: (userId) => api.get(`/users/${userId}`),
  update: (userId, userData) => api.put(`/users/${userId}`, userData),
  updateRole: (userId, role) => api.patch(`/users/${userId}/role`, { role }),
  updateStatus: (userId, isActive) => api.patch(`/users/${userId}/status`, { isActive }),
  delete: (userId) => api.delete(`/users/${userId}`),
  getActivityLogs: (userId, action, limit) =>
    api.get(`/users/${userId}/activity`, { params: { action, limit } }),
  getDataUsage: (userId) => api.get(`/users/${userId}/data-usage`),
};

export default api;
