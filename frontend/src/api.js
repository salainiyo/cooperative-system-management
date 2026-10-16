const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

const CONNECTION_ERROR_MESSAGE =
  'Connection error — check your internet connection and try again.';

// fetch() rejects with TypeError when the network is unreachable (offline,
// DNS failure, server down). Users would otherwise see the raw browser
// message "Failed to fetch", so translate it into something actionable.
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(CONNECTION_ERROR_MESSAGE);
    }
    throw error;
  }
}

async function refreshAccessToken() {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await safeFetch(`${API_BASE}/auth/refresh`, {
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

  let response = await safeFetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401) {
    try {
      accessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${accessToken}`;
      response = await safeFetch(`${API_BASE}${endpoint}`, config);
    } catch (error) {
      // A network failure is not an auth failure: stay signed in and let the
      // caller surface the connection problem instead of bouncing to /login.
      if (error.message === CONNECTION_ERROR_MESSAGE) throw error;
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
    const response = await safeFetch(`${API_BASE}/auth/login`, {
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
  forgotPassword: async (email) => {
    const response = await safeFetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
  },
  resetPassword: async (token, newPassword) => {
    const response = await safeFetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
  },
  changePassword: async (currentPassword, newPassword) => {
    const data = await fetchWithAuth('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    // The server rotates tokens so the user stays signed in with the new password.
    if (data.access_token && data.refresh_token) {
      tokenManager.setTokens(data.access_token, data.refresh_token);
    }
    return data;
  },
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
  getSettings: () => fetchWithAuth('/admin/settings/'),
  updateSettings: (settingsData) => fetchWithAuth('/admin/settings/', { method: 'PATCH', body: JSON.stringify(settingsData) }),
  sendTestEmail: (email) => fetchWithAuth('/admin/settings/test-email', { method: 'POST', body: JSON.stringify(email ? { email } : {}) }),
  // Member portal
  getPortalAccount: () => fetchWithAuth('/portal/account'),
  getPortalSavings: (skip = 0, limit = 20) => fetchWithAuth(`/portal/savings?skip=${skip}&limit=${limit}`),
  getPortalLoans: () => fetchWithAuth('/portal/loans'),
  getLoanEligibility: () => fetchWithAuth('/portal/loan-eligibility'),
  createLoanRequest: (data) => fetchWithAuth('/portal/loan-requests', { method: 'POST', body: JSON.stringify(data) }),
  getMyLoanRequests: () => fetchWithAuth('/portal/loan-requests'),
  // Admin: loan request queue
  getLoanRequests: (statusFilter) => fetchWithAuth(`/admin/loan-requests${statusFilter ? `?status=${statusFilter}` : ''}`),
  approveLoanRequest: (id, note) => fetchWithAuth(`/admin/loan-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ note: note || null }) }),
  rejectLoanRequest: (id, note) => fetchWithAuth(`/admin/loan-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ note: note || null }) }),
  // Admin: member portal accounts
  createMemberAccount: (memberId, email, tempPassword) => fetchWithAuth('/admin/member-accounts', { method: 'POST', body: JSON.stringify({ member_id: memberId, email, temp_password: tempPassword || null }) }),
  revokeMemberPassword: (memberId) => fetchWithAuth(`/admin/member-accounts/${memberId}/revoke-password`, { method: 'POST' }),
  deleteMemberAccount: (memberId) => fetchWithAuth(`/admin/member-accounts/${memberId}`, { method: 'DELETE' }),
  getUsers: () => fetchWithAuth('/admin/users'),
  // Reports & exports
  getCollectionsReport: () => fetchWithAuth('/admin/reports/collections'),
  getPortfolioReport: () => fetchWithAuth('/admin/reports/portfolio'),
  getTimeseries: (months = 12) => fetchWithAuth(`/admin/dashboard/timeseries?months=${months}`),
  getPeriodDeltas: () => fetchWithAuth('/admin/dashboard/period-deltas'),
  getMemberStatement: (memberId, from, to) =>
    fetchWithAuth(`/admin/members/${memberId}/statement${from ? `?from=${from}&to=${to}` : ''}`),
  getLoanList: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.member_id) query.set('member_id', params.member_id);
    if (params.offset != null) query.set('offset', params.offset);
    if (params.limit != null) query.set('limit', params.limit);
    const qs = query.toString();
    return fetchWithAuth(`/loan/${qs ? `?${qs}` : ''}`);
  },
  getLoanDetail: (loanId) => fetchWithAuth(`/loan/${loanId}`),
  downloadCsv: async (dataset) => {
    let accessToken = tokenManager.getAccessToken();
    let response = await safeFetch(`${API_BASE}/admin/export/${dataset}.csv`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (response.status === 401) {
      accessToken = await refreshAccessToken();
      response = await safeFetch(`${API_BASE}/admin/export/${dataset}.csv`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dataset}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};