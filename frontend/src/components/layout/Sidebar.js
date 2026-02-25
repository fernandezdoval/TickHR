import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authAPI } from '@/lib/api';
import {
  LayoutDashboard,
  Clock,
  FileText,
  Receipt,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clock', icon: Clock, label: 'Fichaje' },
  { to: '/tickets', icon: FileText, label: 'Solicitudes' },
  { to: '/expenses', icon: Receipt, label: 'Gastos' },
];

const adminItems = [
  { to: '/admin/tickets', icon: ShieldCheck, label: 'Gestionar Solicitudes' },
  { to: '/admin/expenses', icon: Receipt, label: 'Gestionar Gastos' },
  { to: '/admin/users', icon: Users, label: 'Usuarios' },
];

export const Sidebar = ({ isOpen, onToggle }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      // Ignore errors
    }
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-40 transform transition-transform duration-200 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="sidebar"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
          <h1 className="font-heading text-xl font-bold tracking-tight">TickHR</h1>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-slate-800"
            onClick={onToggle}
            data-testid="close-sidebar-btn"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col h-[calc(100%-4rem)] py-4">
          <div className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                    isActive
                      ? "active bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )
                }
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={() => window.innerWidth < 1024 && onToggle()}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2 px-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Administración
                  </span>
                </div>
                {adminItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium",
                        isActive
                          ? "active bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )
                    }
                    data-testid={`nav-admin-${item.label.toLowerCase().replace(' ', '-')}`}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </div>

          {/* User section */}
          <div className="px-3 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              data-testid="logout-btn"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};
