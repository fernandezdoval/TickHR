import React, { useEffect, useState } from 'react';
import { clockAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, Play, Square, Loader2, Calendar, Timer } from 'lucide-react';

export default function ClockPage() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        clockAPI.getStatus(),
        clockAPI.getHistory(14)
      ]);
      setStatus(statusRes.data);
      setHistory(historyRes.data);
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

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
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

  const isClockedIn = status?.clocked_in;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Fichaje</h1>
          <p className="text-muted-foreground">Registra tu entrada y salida</p>
        </div>

        {/* Clock Card */}
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            {/* Digital Clock */}
            <div className="mb-6">
              <p className="text-6xl font-bold tabular-nums font-heading">
                {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-muted-foreground mt-2">
                {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>

            {/* Status */}
            <div className="mb-6">
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                isClockedIn 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-slate-100 text-slate-800'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  isClockedIn ? 'bg-green-500 clock-pulse' : 'bg-slate-400'
                }`} />
                {isClockedIn ? 'Trabajando' : 'No fichado'}
              </span>
              {isClockedIn && status?.record?.clock_in && (
                <p className="text-sm text-muted-foreground mt-2">
                  Entrada: {formatTime(status.record.clock_in)}
                </p>
              )}
            </div>

            {/* Clock Button */}
            <Button
              size="lg"
              className={`w-full h-14 text-lg ${
                isClockedIn 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
              onClick={() => handleClock(isClockedIn ? 'out' : 'in')}
              disabled={clockLoading}
              data-testid="clock-btn"
            >
              {clockLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isClockedIn ? (
                <><Square className="mr-2 h-6 w-6" /> Fichar Salida</>
              ) : (
                <><Play className="mr-2 h-6 w-6" /> Fichar Entrada</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Historial de fichajes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay registros</p>
            ) : (
              <div className="space-y-2">
                {history.map((record) => (
                  <div
                    key={record.record_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 table-row"
                  >
                    <div>
                      <p className="font-medium">{formatDate(record.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(record.clock_in)} - {formatTime(record.clock_out)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {record.total_hours ? `${record.total_hours}h` : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
