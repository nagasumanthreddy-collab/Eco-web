import { AnimatePresence } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { isOfflineBundle } from './lib/api.ts';
import { AlertsPage } from './pages/AlertsPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { DailyEntryPage } from './pages/DailyEntryPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { PredictionsPage } from './pages/PredictionsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { SurplusPage } from './pages/SurplusPage.tsx';

function LoginRedirectWrapper() {
  const { user, loading } = useAuth();
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }
  return <AuthPage />;
}

function RouterShell({ children }: { children: ReactNode }) {
  if (isOfflineBundle()) {
    return <HashRouter>{children}</HashRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AnimatePresence>
            {showSplash && (
              <SplashScreen
                key="ecopredict-splash"
                durationMs={3000}
                onComplete={() => setShowSplash(false)}
              />
            )}
          </AnimatePresence>

          {!showSplash && (
            <RouterShell>
              <Routes>
                <Route path="/login" element={<LoginRedirectWrapper />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="entries" element={<DailyEntryPage />} />
                  <Route path="predictions" element={<PredictionsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="surplus" element={<SurplusPage />} />
                  <Route path="alerts" element={<AlertsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </RouterShell>
          )}
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
