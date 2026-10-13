import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { BrowserRouter, Routes, Route } from 'react-router-dom';


import './App.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Classes from './pages/Classes';
import ClassStudents from './pages/ClassStudents';
import Community from './pages/Community';
import Admin from './pages/Admin';
import SupremeAdmin from './pages/SupremeAdmin';

import { AuthProvider, useAuth } from './contexts/AuthContext';
// import { AuthProvider } from './contexts/AuthContext';


import { PermissionProvider } from './contexts/PermissionContext';
import Profile from './pages/Profile';
import Exams from './pages/Exams';
import QuestionManagement from './pages/questionmanagement';
import TestFunction from './pages/TestFunction';

// 配置React Router未来版本的行为
const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
};

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();

  console.log('ProtectedRoute rendered'); // 添加这行

  if (loading) {
    console.log('ProtectedRoute: loading is true'); // 添加这行
    return <div>加载中...</div>;
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: not authenticated, navigating to /login'); // 添加这行
    return <Navigate to="/login" replace />;
  }

  console.log('ProtectedRoute: authenticated, rendering children'); // 添加这行
  return <>{children}</>;
};

function App() {
  console.log('App component rendered'); // 放在 render 函数内部

  return (
    <AuthProvider>
      <PermissionProvider>
        <BrowserRouter future={routerFutureConfig}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Home />} />
              <Route path="classes" element={<Classes />} />
              <Route path="classes/:classId/students" element={<ClassStudents />} />
              <Route path="community" element={<Community />} />
              <Route path="admin" element={<Admin />} />
              <Route path="supreme-admin" element={<SupremeAdmin />} />
              <Route path="profile" element={<Profile />} />
              <Route path="exams" element={<Exams />} />
              <Route path="questions" element={<QuestionManagement />} />
              <Route path="test-function" element={<TestFunction />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PermissionProvider>
    </AuthProvider>
  );
}

export default App;