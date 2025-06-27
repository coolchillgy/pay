import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

// Context Providers
import { AuthProvider } from './utils/AuthContext';
import { SocketProvider } from './utils/SocketContext';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import CompanyDashboard from './pages/CompanyDashboard';
import CompanyCreate from './pages/CompanyCreate';

// Axios 기본 설정
axios.defaults.baseURL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend.railway.app' 
  : 'http://localhost:8000';

// 인터셉터로 JWT 토큰 자동 추가
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 401 에러 시 자동 로그아웃
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5분
    },
  },
});

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children, allowedRoles, user }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// 메인 App 컴포넌트
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          {({ user }) => (
            <SocketProvider>
              <div className="App">
                <Routes>
                  {/* 루트 경로 - 자동 리다이렉트 */}
                  <Route path="/" element={
                    user ? (
                      <Navigate to={user.role === 'admin' ? '/admin' : '/company'} replace />
                    ) : (
                      <Navigate to="/login" replace />
                    )
                  } />

                  {/* 로그인 페이지 */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* 관리자 라우트 */}
                  <Route path="/admin" element={
                    <ProtectedRoute user={user} allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />

                  {/* 업체 생성 페이지 (관리자 전용) */}
                  <Route path="/admin/companies/create" element={
                    <ProtectedRoute user={user} allowedRoles={['admin']}>
                      <CompanyCreate />
                    </ProtectedRoute>
                  } />

                  {/* 업체 대시보드 */}
                  <Route path="/company" element={
                    <ProtectedRoute user={user} allowedRoles={['company']}>
                      <CompanyDashboard />
                    </ProtectedRoute>
                  } />

                  {/* 404 페이지 */}
                  <Route path="*" element={
                    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-6xl font-bold text-gray-400 mb-4">404</h1>
                        <p className="text-xl text-gray-600 mb-8">페이지를 찾을 수 없습니다</p>
                        <button
                          onClick={() => window.location.href = '/'}
                          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          홈으로 돌아가기
                        </button>
                      </div>
                    </div>
                  } />
                </Routes>

                {/* Toast 알림 시스템 */}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '16px',
                      fontSize: '14px',
                      fontWeight: '500',
                    },
                    success: {
                      style: {
                        background: '#10B981',
                      },
                      iconTheme: {
                        primary: '#fff',
                        secondary: '#10B981',
                      },
                    },
                    error: {
                      style: {
                        background: '#EF4444',
                      },
                      iconTheme: {
                        primary: '#fff',
                        secondary: '#EF4444',
                      },
                    },
                    loading: {
                      style: {
                        background: '#3B82F6',
                      },
                    },
                  }}
                />
              </div>
            </SocketProvider>
          )}
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App; 