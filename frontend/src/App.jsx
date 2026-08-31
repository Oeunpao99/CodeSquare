import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MajorProvider } from './context/MajorContext';
import PageTransition from './components/PageTransition';
import TopProgressBar from './components/TopProgressBar';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import LanguageView from './pages/LanguageView';
import LessonView from './pages/LessonView';
import ProjectsList from './pages/ProjectsList';
import ProjectWorkspace from './pages/ProjectWorkspace';
import GenerateProject from './pages/GenerateProject';
import Portfolio from './pages/Portfolio';
import Profile from './pages/Profile';
import Roadmap from './pages/Roadmap';
import Progress from './pages/Progress';
import Career from './pages/Career';
import Leaderboard from './pages/Leaderboard';
import Community from './pages/Community';
import CommunityPost from './pages/CommunityPost';
import UserProfile from './pages/UserProfile';
import Usage from './pages/Usage';
import Practice from './pages/Practice';
import ChallengeView from './pages/ChallengeView';
import Quizzes from './pages/Quizzes';
import QuizView from './pages/QuizView';
import Tutor from './pages/Tutor';
import Library from './pages/Library';
import Notes from './pages/Notes';
import LibraryCollection from './pages/LibraryCollection';
import LibraryArticle from './pages/LibraryArticle';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading CodeSphere...</p>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/auth" />;
}

// New accounts land here until they finish (or skip) the first-run flow.
function RequireOnboarded({ children }) {
  const { user } = useAuth();
  if (user && !user.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();

  // Public pages animate per-path. Everything behind AppLayout shares one key so
  // the shell (sidebar, its active-pill animation, scroll position) is NOT torn
  // down and rebuilt on every tab switch — only the <Outlet> content changes.
  const isPublic = location.pathname === '/' || location.pathname === '/auth';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={isPublic ? location.pathname : 'app'}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route element={<ProtectedRoute><RequireOnboarded><AppLayout /></RequireOnboarded></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/learn/:slug" element={<LanguageView />} />
          <Route path="/learn/:slug/module/:moduleId/lesson/:lessonId" element={<LessonView />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/generate" element={<GenerateProject />} />
          <Route path="/projects/:id" element={<ProjectWorkspace />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/usage" element={<Usage />} />
          <Route path="/u/:username" element={<UserProfile />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/career" element={<Career />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:id" element={<CommunityPost />} />

          <Route path="/library" element={<Library />} />
          <Route path="/library/:collection" element={<LibraryCollection />} />
          <Route path="/library/:collection/:topic" element={<LibraryArticle />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/c/:slug" element={<ChallengeView />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/quizzes/:slug" element={<QuizView />} />
          <Route path="/tutor" element={<Tutor />} />
          <Route path="/notes" element={<Notes />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <MajorProvider>
      <Router>
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 3500,
            style: {
              background: 'rgb(var(--cs-darker) / 0.92)',
              color: 'rgb(var(--cs-text))',
              borderRadius: '12px',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 1px 0 rgb(var(--cs-line) / 0.08), 0 12px 32px -16px rgb(var(--cs-line) / 0.25)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: '13.5px',
              fontWeight: 500,
              padding: '10px 14px',
              lineHeight: 1.4,
              minWidth: 200,
            },
            success: {
              iconTheme: { primary: 'rgb(var(--cs-green))', secondary: 'rgb(var(--cs-darker))' },
            },
            error: {
              iconTheme: { primary: 'rgb(var(--cs-red))', secondary: 'rgb(var(--cs-darker))' },
            },
          }}
        />
        <AppRoutes />
        <TopProgressBar />
      </Router>
    </MajorProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;