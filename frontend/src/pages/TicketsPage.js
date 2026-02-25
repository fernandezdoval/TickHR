import React, { useEffect, useState } from 'react';
import { ticketsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, FileText, Loader2, Calendar, Clock } from 'lucide-react';

const TICKET_TYPES = [
  { value: 'vacation', label: 'Vacaciones', color: 'bg-blue-100 text-blue-800' },
  { value: 'absence', label: 'Ausencia', color: 'bg-amber-100 text-amber-800' },
  { value: 'permission', label: 'Permiso', color: 'bg-purple-100 text-purple-800' },
];

const STATUS_STYLES = {
  pending: 'status-pending',
  approved: 'status-approved',
  rejected: 'status-rejected',
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    ticket_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const response = await ticketsAPI.getMyTickets();
      setTickets(response.data);
    } catch (error) {
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await ticketsAPI.create(formData);
      toast.success('Solicitud enviada correctamente');
      setDialogOpen(false);
      setFormData({ ticket_type: '', start_date: '', end_date: '', reason: '' });
      await loadTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeInfo = (type) => TICKET_TYPES.find(t => t.value === type) || TICKET_TYPES[0];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Mis Solicitudes</h1>
            <p className="text-muted-foreground">Vacaciones, ausencias y permisos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-ticket-btn">
                <Plus className="mr-2 h-4 w-4" />
                Nueva solicitud
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Nueva solicitud</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de solicitud</Label>
                  <Select
                    value={formData.ticket_type}
                    onValueChange={(value) => setFormData({ ...formData, ticket_type: value })}
                    required
                  >
                    <SelectTrigger data-testid="ticket-type-select">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha inicio</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      data-testid="ticket-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha fin</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                      data-testid="ticket-end-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Describe el motivo de tu solicitud..."
                    rows={3}
                    required
                    data-testid="ticket-reason"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting} data-testid="submit-ticket-btn">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar solicitud
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tickets List */}
        <Card>
          <CardContent className="p-0">
            {tickets.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No tienes solicitudes</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  Crear primera solicitud
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((ticket) => {
                  const typeInfo = getTypeInfo(ticket.ticket_type);
                  return (
                    <div key={ticket.ticket_id} className="p-4 table-row">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                            <span className={`status-badge ${STATUS_STYLES[ticket.status]}`}>
                              {STATUS_LABELS[ticket.status]}
                            </span>
                          </div>
                          <p className="font-medium">{ticket.reason}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {ticket.start_date} - {ticket.end_date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(ticket.created_at).toLocaleDateString('es-ES')}
                            </span>
                          </p>
                          {ticket.reviewed_by && (
                            <p className="text-xs text-muted-foreground">
                              Revisado por: {ticket.reviewed_by}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
