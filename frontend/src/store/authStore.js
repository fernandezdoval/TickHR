import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true });
        if (token) {
          localStorage.setItem('session_token', token);
        }
      },

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem('session_token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'tickhr-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
