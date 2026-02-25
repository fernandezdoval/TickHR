import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { dashboardAPI, clockAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Clock,
  CalendarDays,
  Receipt,
  FileText,
  Users,
  TrendingUp,
  Play,
  Square,
  Loader2
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [clockStatus, setClockStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, clockRes] = await Promise.all([
        dashboardAPI.getStats(),
        clockAPI.getStatus()
      ]);
      setStats(statsRes.data);
      setClockStatus(clockRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleClock = async (action) => {
    setClockLoading(true);
    try {
      if (action === 'in') {
        await clockAPI.clockIn();
        toast.success('Fichaje de entrada registrado');
      } else {
        await clockAPI.clockOut();
        toast.success('Fichaje de salida registrado');
      }
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al fichar');
    } finally {
      setClockLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isClockedIn = clockStatus?.clocked_in;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            ¡Hola, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Quick Clock Action */}
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm">Estado actual</p>
                <p className="text-2xl font-bold mt-1">
                  {isClockedIn ? 'Trabajando' : 'No fichado'}
                </p>
                {isClockedIn && clockStatus?.record?.clock_in && (
                  <p className="text-slate-400 text-sm mt-1">
                    Entrada: {new Date(clockStatus.record.clock_in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <Button
                size="lg"
                className={isClockedIn 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-green-500 hover:bg-green-600 text-white"
                }
                onClick={() => handleClock(isClockedIn ? 'out' : 'in')}
                disabled={clockLoading}
                data-testid="clock-action-btn"
              >
                {clockLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isClockedIn ? (
                  <><Square className="mr-2 h-5 w-5" /> Fichar Salida</>
                ) : (
                  <><Play className="mr-2 h-5 w-5" /> Fichar Entrada</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Horas este mes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{stats?.hours_this_month || 0}h</div>
              <p className="text-xs text-muted-foreground mt-1">{stats?.days_worked || 0} días trabajados</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Solicitudes pendientes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{stats?.pending_tickets || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Vacaciones, ausencias...</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gastos pendientes</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{stats?.pending_expenses || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Por revisar</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gastos aprobados</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">€{stats?.total_expenses_month || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Este mes</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Stats */}
        {isAdmin && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="card-hover border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Solicitudes por revisar</CardTitle>
                <FileText className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{stats?.admin_pending_tickets || 0}</div>
              </CardContent>
            </Card>

            <Card className="card-hover border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Gastos por revisar</CardTitle>
                <Receipt className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{stats?.admin_pending_expenses || 0}</div>
              </CardContent>
            </Card>

            <Card className="card-hover border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total empleados</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{stats?.total_employees || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
