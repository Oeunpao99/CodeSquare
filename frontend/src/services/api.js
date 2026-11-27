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
    if (error.response?.status === 401 && window.location.pathname !== '/auth') {
      localStorage.removeItem('token');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export const messageService = {
  inbox: (signal) => api.get('/messages', { signal }),
  thread: (username, params, signal) =>
    api.get('/messages/with/' + encodeURIComponent(username), { params, signal }),
  markRead: (username, throughId) =>
    api.post('/messages/with/' + encodeURIComponent(username) + '/read', { through_id: throughId }),
  send: (username, body) => api.post('/messages/with/' + encodeURIComponent(username), body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  media: (id, signal) => api.get('/messages/' + id + '/media', { responseType: 'blob', signal }),
};

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

  // Partial profile update — only the keys you pass are changed. Pass
  // avatar_data: '' to remove an uploaded photo, complete_onboarding: true to
  // finish the first-run flow in the same call.
  updateProfile: (data) => api.patch('/auth/profile', data),

  skipOnboarding: () => api.post('/auth/onboarding/skip'),
};

export const lessonService = {
  getLanguages: () => api.get('/lessons/languages'),
  getLanguage: (slug) => api.get(`/lessons/languages/${slug}`),
  getLesson: (slug, moduleId, lessonId) => 
    api.get(`/lessons/languages/${slug}/modules/${moduleId}/lessons/${lessonId}`),
  submitExercise: (exerciseId, code) =>
    api.post('/lessons/submit-exercise', { exercise_id: exerciseId, code }),
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

export const billingService = {
  status: () => api.get('/billing/status'),
  checkout: (plan = 'pro') => api.post('/billing/checkout', { plan }),
  confirm: (paymentId) => api.post(`/billing/checkout/${paymentId}/confirm`),
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
  activity: (year) => api.get('/progress/activity', { params: { year } }),
  getSkills: () => api.get('/progress/skills'),
  getContinue: () => api.get('/progress/continue'),
};

export const careerService = {
  getReadiness: () => api.get('/career/readiness'),
};

export const communityService = {
  leaderboard: (limit = 50) => api.get('/community/leaderboard', { params: { limit } }),
  profile: (username) => api.get(`/community/users/${username}`),
  activity: (username, year) => api.get(`/community/users/${username}/activity`, { params: { year } }),
  devs: (params = {}) => api.get('/community/devs', { params }),

  // --- follow ---
  follow: (username) => api.post(`/community/users/${username}/follow`),
  unfollow: (username) => api.delete(`/community/users/${username}/follow`),
  userPosts: (username, params = {}) => api.get(`/community/users/${username}/posts`, { params }),

  // --- community feed ---
  posts: (params = {}) => api.get('/community/posts', { params }),
  post: (id) => api.get(`/community/posts/${id}`),
  createPost: (data) => api.post('/community/posts', data),
  updatePost: (id, data) => api.patch(`/community/posts/${id}`, data),
  deletePost: (id) => api.delete(`/community/posts/${id}`),
  likePost: (id) => api.post(`/community/posts/${id}/like`),
  savePost: (id) => api.post(`/community/posts/${id}/save`),
  repost: (id) => api.post(`/community/posts/${id}/repost`),
  flagPost: (id) => api.post(`/community/posts/${id}/flag`),
  addComment: (id, body, parentId) => api.post(`/community/posts/${id}/comments`, { body, parent_id: parentId || null }),
  deleteComment: (id) => api.delete(`/community/comments/${id}`),
  likeComment: (id, commentId) => api.post(`/community/posts/${id}/comments/${commentId}/like`),
  reviewQuality: (id) => api.post(`/community/posts/${id}/quality`),
  explainCode: (id) => api.post(`/community/posts/${id}/explain`),
};

export const notificationService = {
  list: () => api.get('/notifications'),
  markAllRead: () => api.post('/notifications/read'),
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

export const githubService = {
  status: () => api.get('/github/status'),
  connect: () => api.get('/github/connect'),
  disconnect: () => api.delete('/github/connection'),
  repos: () => api.get('/github/repos'),
  importRepo: (repo) => api.post('/github/import', { repo }),
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
  remove: (id) => api.post(`/notes/${id}/delete`),
  favorite: (id, favorite) => api.post(`/notes/${id}/favorite`, { favorite }),
  reveal: (id, password) => api.post(`/notes/${id}/secret`, { password }),
  convert: (id) => api.post(`/notes/${id}/convert`),
  vaultStatus: () => api.get('/notes/vault/status'),
};

export default api;

// ---- Classes (private classrooms) + teacher applications ----
export const teacherService = {
  me: () => api.get('/teachers/me'),
  apply: (data) => api.post('/teachers/apply', data),
};

export const classService = {
  mine: () => api.get('/classes/mine'),
  create: (data) => api.post('/classes', data),
  join: (code) => api.post('/classes/join', { code }),
  get: (id) => api.get(`/classes/${id}`),
  update: (id, patch) => api.patch(`/classes/${id}`, patch),
  rotateCode: (id) => api.post(`/classes/${id}/rotate-code`),
  leave: (id) => api.post(`/classes/${id}/leave`),
  members: (id) => api.get(`/classes/${id}/members`),
  removeMember: (id, userId) => api.delete(`/classes/${id}/members/${userId}`),
  candidates: (id, q) => api.get(`/classes/${id}/candidates`, { params: { q } }),
  addMember: (id, userId) => api.post(`/classes/${id}/members`, { user_id: userId }),
  telegram: (id) => api.get(`/classes/${id}/telegram`),
  telegramLink: (id) => api.post(`/classes/${id}/telegram/link`),
  telegramVerify: (id) => api.post(`/classes/${id}/telegram/verify`),
  telegramTest: (id, gid) => api.post(`/classes/${id}/telegram/${gid}/test`),
  telegramRemove: (id, gid) => api.delete(`/classes/${id}/telegram/${gid}`),
  addSection: (id, data) => api.post(`/classes/${id}/sections`, data),
  updateSection: (id, sid, patch) => api.patch(`/classes/${id}/sections/${sid}`, patch),
  deleteSection: (id, sid) => api.delete(`/classes/${id}/sections/${sid}`),
  addMaterial: (id, sid, data) => api.post(`/classes/${id}/sections/${sid}/materials`, data),
  uploadFile: (id, sid, file, title, onUploadProgress) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return api.post(`/classes/${id}/sections/${sid}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
  },
  updateMaterial: (id, mid, patch) => api.patch(`/classes/${id}/materials/${mid}`, patch),
  deleteMaterial: (id, mid) => api.delete(`/classes/${id}/materials/${mid}`),
  // Files are members-only, so fetch with the auth header and hand back a Blob.
  fileBlob: (id, mid, inline = false) =>
    api.get(`/classes/${id}/materials/${mid}/file`, { params: inline ? { inline: 1 } : {}, responseType: 'blob' }),

  // Stream (announcements)
  posts: (id) => api.get(`/classes/${id}/posts`),
  addPost: (id, body) => api.post(`/classes/${id}/posts`, { body }),
  deletePost: (id, postId) => api.delete(`/classes/${id}/posts/${postId}`),

  // Class quizzes (taken at /quizzes/<slug>)
  quizzes: (id) => api.get(`/classes/${id}/quizzes`),
  quizForEdit: (id, qid) => api.get(`/classes/${id}/quizzes/${qid}`),
  createQuiz: (id, data) => api.post(`/classes/${id}/quizzes`, data),
  saveQuiz: (id, qid, data) => api.put(`/classes/${id}/quizzes/${qid}`, data),
  publishQuiz: (id, qid, published) => api.patch(`/classes/${id}/quizzes/${qid}`, null, { params: { published } }),
  deleteQuiz: (id, qid) => api.delete(`/classes/${id}/quizzes/${qid}`),
  quizResults: (id, qid) => api.get(`/classes/${id}/quizzes/${qid}/results`),

  // Assignments
  assignments: (id) => api.get(`/classes/${id}/assignments`),
  createAssignment: (id, data) => api.post(`/classes/${id}/assignments`, data),
  updateAssignment: (id, aid, patch) => api.patch(`/classes/${id}/assignments/${aid}`, patch),
  deleteAssignment: (id, aid) => api.delete(`/classes/${id}/assignments/${aid}`),
  submit: (id, aid, file, text, onUploadProgress) => {
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('text', text || '');
    return api.post(`/classes/${id}/assignments/${aid}/submit`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
  },
  submissions: (id, aid) => api.get(`/classes/${id}/assignments/${aid}/submissions`),
  grade: (id, sid, grade, feedback) => api.post(`/classes/${id}/submissions/${sid}/grade`, { grade, feedback }),
  returnWork: (id, sid) => api.post(`/classes/${id}/submissions/${sid}/return`),
  submissionBlob: (id, sid) => api.get(`/classes/${id}/submissions/${sid}/file`, { responseType: 'blob' }),

  // Gradebook (teacher)
  grades: (id) => api.get(`/classes/${id}/grades`),
};

