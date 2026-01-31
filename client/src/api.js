import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token and device ID to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const deviceId = localStorage.getItem('deviceId');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (deviceId) {
    config.headers['X-Device-Id'] = deviceId;
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
  // Session Management
  getActiveSessions: () => api.get('/auth/sessions'),
  logoutOtherDevices: () => api.post('/auth/sessions/logout-others'),
  logoutDevice: (deviceId) => api.post(`/auth/sessions/logout/${deviceId}`),
};

// Devices API
export const devicesAPI = {
  getAll: (serverId, status) =>
    api.get('/devices', { params: { serverId, status } }),
  getOne: (deviceId) => api.get(`/devices/${deviceId}`),
  create: (deviceData) => api.post('/devices', deviceData),
  update: (deviceId, deviceData) => api.put(`/devices/${deviceId}`, deviceData),
  delete: (deviceId) => api.delete(`/devices/${deviceId}`),
  toggleStatus: (deviceId, status, isEnabled) =>
    api.patch(`/devices/${deviceId}/status`, { status, isEnabled }),
  getConfig: (deviceId) => api.get(`/devices/${deviceId}/config`, { responseType: 'blob' }),
  getQR: (deviceId) => api.get(`/devices/${deviceId}/qr`),
  disconnect: (deviceId) => api.post(`/devices/${deviceId}/disconnect`),
  getHistory: (deviceId) => api.get(`/devices/${deviceId}/history`),
};

// Plans API
export const plansAPI = {
  getAll: (isActive) =>
    api.get('/plans', { params: { isActive } }),
  getOne: (planId) => api.get(`/plans/${planId}`),
  create: (planData) => api.post('/plans', planData),
  update: (planId, planData) => api.put(`/plans/${planId}`, planData),
  delete: (planId) => api.delete(`/plans/${planId}`),
  assignToDevice: (planId, deviceId) =>
    api.post('/plans/assign', { planId, deviceId }),
  getStats: (planId) => api.get(`/plans/${planId}/stats`),
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
  getDevices: (serverId) => api.get(`/servers/${serverId}/devices`),
  getWireGuardStatus: (serverId) => api.get(`/servers/${serverId}/wireguard-status`),
  syncOutline: (serverId) => api.post(`/servers/${serverId}/sync-outline`),
};

// Users API
export const usersAPI = {
  getAll: (role, plan, isActive) =>
    api.get('/users', { params: { role, plan, isActive } }),
  getOne: (userId) => api.get(`/users/${userId}`),
  createPanelUser: (data) => api.post('/users', data),
  update: (userId, userData) => api.put(`/users/${userId}`, userData),
  delete: (userId) => api.delete(`/users/${userId}`),
  getActivityLogs: (userId, action, limit) =>
    api.get(`/users/${userId}/activity`, { params: { action, limit } }),
  getDataUsage: (userId) => api.get(`/users/${userId}/data-usage`),
};

// Sales API
export const salesAPI = {
  getReport: (filters) => api.get('/sales/report', { params: filters }),
  getSummary: (filters) => api.get('/sales/summary', { params: filters }),
  getByPeriod: (period, filters) =>
    api.get('/sales/by-period', { params: { ...filters, period } }),
};

export default api;
