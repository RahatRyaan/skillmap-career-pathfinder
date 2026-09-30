/**
 * Route table.
 *
 * Public routes are open, student routes require a session, admin routes
 * require the admin role. Route-level lazy loading keeps the initial bundle
 * small: charts, the graph, and admin are only fetched when visited.
 */

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingState } from '@/components/ui/States';

const Landing = lazy(() => import('@/pages/public/Landing'));
const Login = lazy(() => import('@/pages/public/Login'));
const Register = lazy(() => import('@/pages/public/Register'));
const PrivacyNotice = lazy(() => import('@/pages/public/PrivacyNotice'));
const AiInfo = lazy(() => import('@/pages/public/AiInfo'));

const Dashboard = lazy(() => import('@/pages/student/Dashboard'));
const Onboarding = lazy(() => import('@/pages/student/Onboarding'));
const CareerQuiz = lazy(() => import('@/pages/student/CareerQuiz'));
const MySkills = lazy(() => import('@/pages/student/MySkills'));
const CvUpload = lazy(() => import('@/pages/student/CvUpload'));
const CareerExplorer = lazy(() => import('@/pages/student/CareerExplorer'));
const CareerDetail = lazy(() => import('@/pages/student/CareerDetail'));
const CareerCompare = lazy(() => import('@/pages/student/CareerCompare'));
const SkillGap = lazy(() => import('@/pages/student/SkillGap'));
const SkillMap = lazy(() => import('@/pages/student/SkillMapPage'));
const WhatIf = lazy(() => import('@/pages/student/WhatIf'));
const Roadmap = lazy(() => import('@/pages/student/Roadmap'));
const Resources = lazy(() => import('@/pages/student/Resources'));
const Projects = lazy(() => import('@/pages/student/Projects'));
const Progress = lazy(() => import('@/pages/student/Progress'));
const Profile = lazy(() => import('@/pages/student/Profile'));
const Settings = lazy(() => import('@/pages/student/Settings'));

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminCareers = lazy(() => import('@/pages/admin/AdminCareers'));
const AdminSkills = lazy(() => import('@/pages/admin/AdminSkills'));
const AdminMappings = lazy(() => import('@/pages/admin/AdminMappings'));
const AdminResources = lazy(() => import('@/pages/admin/AdminResources'));
const AdminProjects = lazy(() => import('@/pages/admin/AdminProjects'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminImpact = lazy(() => import('@/pages/admin/AdminImpact'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // A student who reaches an admin URL is sent to their own dashboard rather
  // than shown a page they cannot use.
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function RedirectIfSignedIn({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <RedirectIfSignedIn>
              <Login />
            </RedirectIfSignedIn>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfSignedIn>
              <Register />
            </RedirectIfSignedIn>
          }
        />
        <Route path="/privacy" element={<PrivacyNotice />} />
        <Route path="/ai-info" element={<AiInfo />} />

        {/* Student */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="quiz" element={<CareerQuiz />} />
          <Route path="skills" element={<MySkills />} />
          <Route path="cv" element={<CvUpload />} />
          <Route path="careers" element={<CareerExplorer />} />
          <Route path="careers/:id" element={<CareerDetail />} />
          <Route path="careers/compare" element={<CareerCompare />} />
          <Route path="gap" element={<SkillGap />} />
          <Route path="skill-map" element={<SkillMap />} />
          <Route path="what-if" element={<WhatIf />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="resources" element={<Resources />} />
          <Route path="projects" element={<Projects />} />
          <Route path="progress" element={<Progress />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AppShell />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="careers" element={<AdminCareers />} />
          <Route path="skills" element={<AdminSkills />} />
          <Route path="mappings" element={<AdminMappings />} />
          <Route path="resources" element={<AdminResources />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="impact" element={<AdminImpact />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
