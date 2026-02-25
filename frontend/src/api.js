const API_BASE = 'http://localhost:8000';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  isAuthenticated: () => !!localStorage.getItem(ACCESS_TOKEN_KEY),
};

async function refreshAccessToken() {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: refreshToken }),
  });

  if (!response.ok) {
    tokenManager.clearTokens();
    window.location.href = '/login';
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  tokenManager.setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

export async function fetchWithAuth(endpoint, options = {}) {
  let accessToken = tokenManager.getAccessToken();
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  };

  let response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401) {
    try {
      accessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${accessToken}`;
      response = await fetch(`${API_BASE}${endpoint}`, config);
    } catch (error) {
      tokenManager.clearTokens();
      window.location.href = '/login';
      throw error;
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(errorData.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail);
    }
    const data = await response.json();
    tokenManager.setTokens(data.access_token, data.refresh_token);
    return data;
  },
  logout: async () => {
    const refreshToken = tokenManager.getRefreshToken();
    try {
      if (refreshToken) await fetchWithAuth('/auth/logout', { method: 'POST', body: JSON.stringify({ token: refreshToken }) });
    } finally {
      tokenManager.clearTokens();
      window.location.href = '/login';
    }
  },
  getCurrentUser: () => fetchWithAuth('/auth/me'),
  searchMembers: (query) => fetchWithAuth(`/member/search?q=${encodeURIComponent(query)}`),
  getMembers: (offset = 0, limit = 20) => fetchWithAuth(`/member/?offset=${offset}&limit=${limit}`),
  getMemberDetails: (memberId) => fetchWithAuth(`/member/${memberId}`),
  createMember: (memberData) => fetchWithAuth('/member/', { method: 'POST', body: JSON.stringify(memberData) }),
  updateMember: (memberId, updateData) => fetchWithAuth(`/member/${memberId}`, { method: 'PATCH', body: JSON.stringify(updateData) }), // Fixed
  deleteMember: (memberId) => fetchWithAuth(`/member/${memberId}`, { method: 'DELETE' }), // Fixed
  getMemberSavings: (memberId, skip = 0, limit = 10) => fetchWithAuth(`/savings/${memberId}?skip=${skip}&limit=${limit}`),
  createSavings: (memberId, savingsData) => fetchWithAuth(`/savings/${memberId}`, { method: 'POST', body: JSON.stringify(savingsData) }),
  updateSavings: (savingsId, updateData) => fetchWithAuth(`/savings/${savingsId}`, { method: 'PATCH', body: JSON.stringify(updateData) }), // Fixed
  deleteSavings: (savingsId) => fetchWithAuth(`/savings/${savingsId}`, { method: 'DELETE' }), // Fixed
  createLoan: (memberId, loanData) => fetchWithAuth(`/loan/${memberId}`, { method: 'POST', body: JSON.stringify(loanData) }),
  updateLoan: (loanId, updateData) => fetchWithAuth(`/loan/${loanId}`, { method: 'PATCH', body: JSON.stringify(updateData) }), // Fixed
  deleteLoan: (loanId) => fetchWithAuth(`/loan/${loanId}`, { method: 'DELETE' }), // Fixed
  createPayment: (loanId, paymentData) => fetchWithAuth(`/payment/${loanId}`, { method: 'POST', body: JSON.stringify(paymentData) }),
  updatePayment: (paymentId, updateData) => fetchWithAuth(`/payment/${paymentId}`, { method: 'PATCH', body: JSON.stringify(updateData) }), // Fixed
  deletePayment: (paymentId) => fetchWithAuth(`/payment/${paymentId}`, { method: 'DELETE' }), // Fixed
  getDashboardStats: () => fetchWithAuth('/admin/dashboard-stats'),
};