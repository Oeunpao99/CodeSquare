import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },
  
  register: (email, username, password) => {
    return api.post('/auth/register', { email, username, password });
  },
  
  googleAuth: (token) => {
    return api.post('/auth/google', { token });
  },
  
  getMe: () => api.get('/auth/me'),

  updateMajor: (major) => api.patch('/auth/major', { major }),
};

export const lessonService = {
  getLanguages: () => api.get('/lessons/languages'),
  getLanguage: (slug) => api.get(`/lessons/languages/${slug}`),
  getLesson: (slug, moduleId, lessonId) => 
    api.get(`/lessons/languages/${slug}/modules/${moduleId}/lessons/${lessonId}`),
  submitExercise: (exerciseId, code) =>
    api.post('/lessons/submit-exercise', null, { params: { exercise_id: exerciseId, code } }),
  getPractice: (limit = 10, slugs = null) =>
    api.get('/lessons/practice', { params: { limit, ...(slugs ? { slugs } : {}) } }),
  completeLesson: (lessonId, score, timeSpent, attempts) => 
    api.post('/lessons/complete-lesson', { lesson_id: lessonId, score, time_spent: timeSpent, attempts: attempts }),
};

export const usageService = {
  get: () => api.get('/ai/usage'),
  plans: () => api.get('/ai/plans'),
  setPlan: (plan) => api.post('/ai/plan', { plan }),
};

export const tutorService = {
  sessions: () => api.get('/ai/sessions'),
  createSession: () => api.post('/ai/sessions'),
  getSession: (id) => api.get(`/ai/sessions/${id}`),
  deleteSession: (id) => api.delete(`/ai/sessions/${id}`),
  compact: (turns, sessionId = null, keep = 4) =>
    api.post('/ai/chat/compact', { turns, session_id: sessionId, keep }),
};

export const aiService = {
  getHint: (exerciseId, code, errorMessage, hintLevel) =>
    api.post('/ai/hint', { exercise_id: exerciseId, code, error_message: errorMessage, current_hint_level: hintLevel }),
  
  reviewCode: (code, language, lessonContext, exerciseDescription) => 
    api.post('/ai/review', { code, language, lesson_context: lessonContext, exercise_description: exerciseDescription }),
  
  generateProject: (language, skillsLearned, difficulty, focus = null) =>
    api.post('/ai/generate-project', { language, skills_learned: skillsLearned, difficulty, focus }),
  
  chat: (message, context, language, history = [], sessionId = null) =>
    api.post('/ai/chat', { message, context, language, history, session_id: sessionId }),
};

export const progressService = {
  getSummary: () => api.get('/progress/summary'),
  getDetailed: () => api.get('/progress/detailed'),
  getSkills: () => api.get('/progress/skills'),
  getContinue: () => api.get('/progress/continue'),
};

export const careerService = {
  getReadiness: () => api.get('/career/readiness'),
};

export const communityService = {
  leaderboard: (limit = 50) => api.get('/community/leaderboard', { params: { limit } }),
};

export const challengeService = {
  list: (params = {}) => api.get('/challenges', { params }),
  daily: () => api.get('/challenges/daily'),
  topics: () => api.get('/challenges/topics'),
  myStats: () => api.get('/challenges/stats/me'),
  get: (slug) => api.get(`/challenges/${slug}`),
  submit: (slug, code) => api.post(`/challenges/${slug}/submit`, { code }),
};

export const quizService = {
  list: (params = {}) => api.get('/quizzes', { params }),
  topics: () => api.get('/quizzes/topics'),
  myStats: () => api.get('/quizzes/stats/me'),
  get: (slug) => api.get(`/quizzes/${slug}`),
  submit: (slug, answers) => api.post(`/quizzes/${slug}/submit`, { answers }),
};

export const roadmapService = {
  getForMajor: (major) => api.get(`/roadmap/${major}`),
};

export const projectService = {
  list: () => api.get('/projects'),
  portfolio: () => api.get('/projects/portfolio'),
  create: (body) => api.post('/projects', body),
  get: (id) => api.get(`/projects/${id}`),
  update: (id, patch) => api.patch(`/projects/${id}`, patch),
  remove: (id) => api.delete(`/projects/${id}`),
  review: (id) => api.post(`/projects/${id}/review`),
};

export const docService = {
  getCollections: () => api.get('/docs/collections'),
  getCollection: (slug) => api.get(`/docs/collections/${slug}`),
  getTopic: (collectionSlug, topicSlug) =>
    api.get(`/docs/topics/${collectionSlug}/${topicSlug}`),
  search: (q) => api.get('/docs/search', { params: { q } }),
  setRead: (collectionSlug, topicSlug, read) =>
    api.post(`/docs/topics/${collectionSlug}/${topicSlug}/read`, { read }),
  setBookmark: (collectionSlug, topicSlug, bookmarked) =>
    api.post(`/docs/topics/${collectionSlug}/${topicSlug}/bookmark`, { bookmarked }),
  rateCollection: (slug, stars) => api.post(`/docs/collections/${slug}/rate`, { stars }),
  continueReading: () => api.get('/docs/reading/continue'),
  bookmarks: () => api.get('/docs/bookmarks'),
};

export const noteService = {
  list: () => api.get('/notes'),
  create: (body) => api.post('/notes', body),
  get: (id) => api.get(`/notes/${id}`),
  update: (id, patch) => api.patch(`/notes/${id}`, patch),
  remove: (id) => api.delete(`/notes/${id}`),
  reveal: (id, password) => api.post(`/notes/${id}/secret`, { password }),
  convert: (id) => api.post(`/notes/${id}/convert`),
  vaultStatus: () => api.get('/notes/vault/status'),
};

export default api;