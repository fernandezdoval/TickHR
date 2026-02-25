import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AuthCallback from "@/pages/AuthCallback";
import DashboardPage from "@/pages/DashboardPage";
import ClockPage from "@/pages/ClockPage";
import TicketsPage from "@/pages/TicketsPage";
import ExpensesPage from "@/pages/ExpensesPage";
import AdminTicketsPage from "@/pages/AdminTicketsPage";
import AdminExpensesPage from "@/pages/AdminExpensesPage";
import AdminUsersPage from "@/pages/AdminUsersPage";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

function AppRouter() {
  const location = useLocation();
  
  // Check URL fragment for session_id - MUST be synchronous before routes
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/clock" element={
        <ProtectedRoute><ClockPage /></ProtectedRoute>
      } />
      <Route path="/tickets" element={
        <ProtectedRoute><TicketsPage /></ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute><ExpensesPage /></ProtectedRoute>
      } />
      
      {/* Admin routes */}
      <Route path="/admin/tickets" element={
        <ProtectedRoute adminOnly><AdminTicketsPage /></ProtectedRoute>
      } />
      <Route path="/admin/expenses" element={
        <ProtectedRoute adminOnly><AdminExpensesPage /></ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute adminOnly><AdminUsersPage /></ProtectedRoute>
      } />
      
      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <Toaster data-testid="global-toaster" richColors position="top-center" />
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </div>
  );
}

export default App;
