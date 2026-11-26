
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ticketsApi } from './api/endpoints';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

import { ActivityLogPage } from './pages/ActivityLogPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketsPage } from './pages/TicketsPage';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  const [refreshKey, setRefreshKey] = useState(0);
  const [openCount, setOpenCount] = useState<number | undefined>(undefined);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  // Update the sidebar badge with Open tickets only.
  useEffect(() => {
    if (!user) return;

    ticketsApi
      .stats()
      .then((res) => {
        setOpenCount(res.stats.byStatus.open);
      })
      .catch(() => {
        setOpenCount(undefined);
      });
  }, [user, refreshKey]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: '#6b7280',
        }}
      >
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout openCount={openCount} onTicketCreated={triggerRefresh}>
      <Routes>
        <Route
          path="/"
          element={<DashboardPage refreshKey={refreshKey} />}
        />

        <Route
          path="/tickets"
          element={
            <TicketsPage
              refreshKey={refreshKey}
              onMutated={triggerRefresh}
            />
          }
        />

        <Route
          path="/tickets/:id"
          element={<TicketDetailPage onMutated={triggerRefresh} />}
        />

        <Route
          path="/history"
          element={<HistoryPage refreshKey={refreshKey} />}
        />

        <Route
          path="/activity"
          element={
            user.role === 'admin'
              ? <ActivityLogPage />
              : <Navigate to="/" replace />
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ProtectedRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
