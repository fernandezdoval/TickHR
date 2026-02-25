import React, { useEffect, useState } from 'react';
import { ticketsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Check, X, Loader2, Calendar, User, FileText } from 'lucide-react';

const TICKET_TYPES = {
  vacation: { label: 'Vacaciones', color: 'bg-blue-100 text-blue-800' },
  absence: { label: 'Ausencia', color: 'bg-amber-100 text-amber-800' },
  permission: { label: 'Permiso', color: 'bg-purple-100 text-purple-800' },
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actionDialog, setActionDialog] = useState({ open: false, ticket: null, action: null });
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [filter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await ticketsAPI.getAllTickets(filter === 'all' ? null : filter);
      setTickets(response.data);
    } catch (error) {
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (ticket, action) => {
    setActionDialog({ open: true, ticket, action });
    setReason('');
  };

  const confirmAction = async () => {
    setProcessing(true);
    try {
      await ticketsAPI.review(
        actionDialog.ticket.ticket_id,
        actionDialog.action,
        actionDialog.action === 'reject' ? reason : null
      );
      toast.success(actionDialog.action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      setActionDialog({ open: false, ticket: null, action: null });
      await loadTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar');
    } finally {
      setProcessing(false);
    }
  };

  const getTypeInfo = (type) => TICKET_TYPES[type] || { label: type, color: 'bg-gray-100 text-gray-800' };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Gestionar Solicitudes</h1>
          <p className="text-muted-foreground">Aprueba o rechaza solicitudes de empleados</p>
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="pending" data-testid="filter-pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved" data-testid="filter-approved">Aprobadas</TabsTrigger>
            <TabsTrigger value="rejected" data-testid="filter-rejected">Rechazadas</TabsTrigger>
            <TabsTrigger value="all" data-testid="filter-all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No hay solicitudes</p>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((ticket) => {
                  const typeInfo = getTypeInfo(ticket.ticket_type);
                  return (
                    <div key={ticket.ticket_id} className="p-4 table-row">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              {ticket.user_name}
                            </span>
                          </div>
                          <p className="font-medium">{ticket.reason}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {ticket.start_date} - {ticket.end_date}
                          </p>
                        </div>
                        {ticket.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleAction(ticket, 'approve')}
                              data-testid={`approve-ticket-${ticket.ticket_id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAction(ticket, 'reject')}
                              data-testid={`reject-ticket-${ticket.ticket_id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {ticket.status !== 'pending' && (
                          <span className={`status-badge ${
                            ticket.status === 'approved' ? 'status-approved' : 'status-rejected'
                          }`}>
                            {ticket.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, ticket: null, action: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">
                {actionDialog.action === 'approve' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {actionDialog.action === 'reject' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Motivo del rechazo (opcional)</p>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Indica el motivo..."
                    rows={3}
                    data-testid="reject-reason"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setActionDialog({ open: false, ticket: null, action: null })}>
                  Cancelar
                </Button>
                <Button
                  className={actionDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                  variant={actionDialog.action === 'reject' ? 'destructive' : 'default'}
                  onClick={confirmAction}
                  disabled={processing}
                  data-testid="confirm-action-btn"
                >
                  {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {actionDialog.action === 'approve' ? 'Aprobar' : 'Rechazar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
