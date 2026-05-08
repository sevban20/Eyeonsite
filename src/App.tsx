import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { LanguageProvider, useTranslation } from './lib/i18n';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import MonitorDetail from './components/MonitorDetail';
import Alerts from './components/Alerts';
import Settings from './components/Settings';
import Auth from './components/Auth';
import VerifyEmail from './components/VerifyEmail';
import ResetPassword from './components/ResetPassword';
import Landing from './components/Landing';
import Pricing from './components/Pricing';
import About from './components/About';
import Contact from './components/Contact';
import Blog from './components/Blog';
import Privacy from './components/Privacy';
import Terms from './components/Terms';
import { Loader2, AlertTriangle, Activity } from 'lucide-react';
import { Toaster } from 'sonner';
import StatusPage from './components/StatusPage';
import StatusPagesList from './components/StatusPagesList';
import api from './lib/api';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-orange-500 animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-zinc-400 font-medium tracking-wide uppercase text-[10px]">{t('common.initializing')}</p>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/auth" />;
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const [workspace, setWorkspace] = useState<any>(null);

  useEffect(() => {
    if (user) {
      api.get('/workspaces').then(res => {
        if (res.data.length > 0) {
          setWorkspace(res.data[0]);
        }
      }).catch(err => console.error("Failed to fetch workspace", err));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-orange-500 animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-zinc-400 font-medium tracking-wide uppercase text-[10px]">Initializing System</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-orange-500/30 selection:text-orange-200">
      <Toaster theme="dark" position="top-right" />
      <Routes>
        <Route path="/status/:slug" element={<StatusPage />} />
        <Route path="*" element={
          <>
            {user && <Navbar user={user} workspace={workspace} />}
            <main className={user ? "pt-20 pb-12" : ""}>
              <Routes>
                <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
                <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/dashboard" element={
                  <PrivateRoute>
                    <Dashboard user={user} workspace={workspace} />
                  </PrivateRoute>
                } />
                <Route path="/monitor/:id" element={
                  <PrivateRoute>
                    <MonitorDetail user={user} workspace={workspace} />
                  </PrivateRoute>
                } />
                <Route path="/status-pages" element={
                  <PrivateRoute>
                    <StatusPagesList workspace={workspace} />
                  </PrivateRoute>
                } />
                <Route path="/alerts" element={
                  <PrivateRoute>
                    <Alerts user={user} workspace={workspace} />
                  </PrivateRoute>
                } />
                <Route path="/settings" element={
                  <PrivateRoute>
                    <Settings user={user} workspace={workspace} />
                  </PrivateRoute>
                } />
              </Routes>
            </main>
          </>
        } />
      </Routes>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}
