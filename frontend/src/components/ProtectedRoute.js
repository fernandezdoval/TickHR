import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const location = useLocation();
  const { user, isAuthenticated, setAuth, logout } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Skip check if returning from OAuth callback
    if (window.location.hash?.includes('session_id=')) {
      setChecking(false);
      return;
    }

    const verifyAuth = async () => {
      // If we have user data from store, verify it's still valid
      if (isAuthenticated && user) {
        try {
          const response = await authAPI.getMe();
          setAuth(response.data, localStorage.getItem('session_token'));
          setChecking(false);
        } catch (error) {
          logout();
          setChecking(false);
        }
      } else {
        // Try to recover session from token
        const token = localStorage.getItem('session_token');
        if (token) {
          try {
            const response = await authAPI.getMe();
            setAuth(response.data, token);
          } catch (error) {
            logout();
          }
        }
        setChecking(false);
      }
    };

    verifyAuth();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
