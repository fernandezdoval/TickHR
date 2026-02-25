import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('session_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('session_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => apiClient.post('/api/auth/register', data),
  login: (data) => apiClient.post('/api/auth/login', data),
  googleAuth: (sessionId) => apiClient.post('/api/auth/session', { session_id: sessionId }),
  getMe: () => apiClient.get('/api/auth/me'),
  logout: () => apiClient.post('/api/auth/logout'),
};

// Clock API
export const clockAPI = {
  clockIn: () => apiClient.post('/api/clock/in'),
  clockOut: () => apiClient.post('/api/clock/out'),
  getStatus: () => apiClient.get('/api/clock/status'),
  getHistory: (limit = 30) => apiClient.get(`/api/clock/history?limit=${limit}`),
};

// Tickets API
export const ticketsAPI = {
  create: (data) => apiClient.post('/api/tickets', data),
  getMyTickets: () => apiClient.get('/api/tickets'),
  getAllTickets: (status) => apiClient.get(`/api/admin/tickets${status ? `?status=${status}` : ''}`),
  review: (ticketId, action, reason) => apiClient.put(`/api/admin/tickets/${ticketId}`, { action, reason }),
};

// Expenses API
export const expensesAPI = {
  create: (formData) => apiClient.post('/api/expenses', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getMyExpenses: () => apiClient.get('/api/expenses'),
  getReceipt: (expenseId) => apiClient.get(`/api/expenses/${expenseId}/receipt`),
  getAllExpenses: (status) => apiClient.get(`/api/admin/expenses${status ? `?status=${status}` : ''}`),
  review: (expenseId, action, reason) => apiClient.put(`/api/admin/expenses/${expenseId}`, { action, reason }),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => apiClient.get('/api/dashboard/stats'),
};

// Admin API
export const adminAPI = {
  getUsers: () => apiClient.get('/api/admin/users'),
  updateUserRole: (userId, role) => apiClient.put(`/api/admin/users/${userId}/role?role=${role}`),
};
