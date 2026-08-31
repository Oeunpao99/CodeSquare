import axios from 'axios';

// The admin console is a SEPARATE session from the learner app: its own token
// under its own key, so signing in/out of one never touches the other.
const ADMIN_TOKEN_KEY = 'cs_admin_token';

export const adminToken = {
  get() {
    try { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch { return ''; }
  },
  set(t) {
    try { localStorage.setItem(ADMIN_TOKEN_KEY, t); } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ }
  },
};

const admin = axios.create({
  baseURL: '/api/admin',
  headers: { 'Content-Type': 'application/json' },
});

admin.interceptors.request.use((config) => {
  const t = adminToken.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

admin.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      adminToken.clear();
      if (window.location.pathname.startsWith('/admin-portal')) {
        window.location.assign('/admin-portal');
      }
    }
    return Promise.reject(err);
  }
);

export const adminAuth = {
  login: (email, password) => {
    const body = new URLSearchParams();
    body.append('username', email);
    body.append('password', password);
    return admin.post('/auth/login', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  me: () => admin.get('/auth/me'),
};

export const adminService = {
  stats: () => admin.get('/stats'),
  users: (params) => admin.get('/users', { params }),
  user: (id) => admin.get(`/users/${id}`),
  updateUser: (id, patch) => admin.patch(`/users/${id}`, patch),
};
