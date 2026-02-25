import React, { useEffect, useState } from 'react';
import { expensesAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Check, X, Loader2, Calendar, User, Receipt, Euro, Image } from 'lucide-react';

const EXPENSE_CATEGORIES = {
  transport: 'Transporte',
  meals: 'Comidas',
  accommodation: 'Alojamiento',
  supplies: 'Material',
  other: 'Otros',
};

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actionDialog, setActionDialog] = useState({ open: false, expense: null, action: null });
  const [receiptDialog, setReceiptDialog] = useState({ open: false, receiptData: null, loading: false });
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [filter]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const response = await expensesAPI.getAllExpenses(filter === 'all' ? null : filter);
      setExpenses(response.data);
    } catch (error) {
      toast.error('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (expense, action) => {
    setActionDialog({ open: true, expense, action });
    setReason('');
  };

  const confirmAction = async () => {
    setProcessing(true);
    try {
      await expensesAPI.review(
        actionDialog.expense.expense_id,
        actionDialog.action,
        actionDialog.action === 'reject' ? reason : null
      );
      toast.success(actionDialog.action === 'approve' ? 'Gasto aprobado' : 'Gasto rechazado');
      setActionDialog({ open: false, expense: null, action: null });
      await loadExpenses();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al procesar');
    } finally {
      setProcessing(false);
    }
  };

  const viewReceipt = async (expenseId) => {
    setReceiptDialog({ open: true, receiptData: null, loading: true });
    try {
      const response = await expensesAPI.getReceipt(expenseId);
      setReceiptDialog({ open: true, receiptData: response.data.receipt_data, loading: false });
    } catch (error) {
      toast.error('Error al cargar justificante');
      setReceiptDialog({ open: false, receiptData: null, loading: false });
    }
  };

  const totalPending = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Gestionar Gastos</h1>
            <p className="text-muted-foreground">Aprueba o rechaza hojas de gastos</p>
          </div>
          {filter === 'pending' && expenses.length > 0 && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total pendiente</p>
              <p className="text-2xl font-bold tabular-nums">€{totalPending.toFixed(2)}</p>
            </div>
          )}
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="pending" data-testid="filter-pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved" data-testid="filter-approved">Aprobados</TabsTrigger>
            <TabsTrigger value="rejected" data-testid="filter-rejected">Rechazados</TabsTrigger>
            <TabsTrigger value="all" data-testid="filter-all">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No hay gastos</p>
              </div>
            ) : (
              <div className="divide-y">
                {expenses.map((expense) => (
                  <div key={expense.expense_id} className="p-4 table-row">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {EXPENSE_CATEGORIES[expense.category] || expense.category}
                          </span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            {expense.user_name}
                          </span>
                          {expense.has_receipt !== false && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => viewReceipt(expense.expense_id)}
                              data-testid={`view-receipt-${expense.expense_id}`}
                            >
                              <Image className="h-3 w-3 mr-1" />
                              Ver justificante
                            </Button>
                          )}
                        </div>
                        <p className="font-medium">{expense.description}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {expense.date}
                        </p>
                        {expense.rejection_reason && (
                          <p className="text-xs text-red-600">Motivo: {expense.rejection_reason}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-xl font-bold tabular-nums">€{expense.amount.toFixed(2)}</p>
                        {expense.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleAction(expense, 'approve')}
                              data-testid={`approve-expense-${expense.expense_id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAction(expense, 'reject')}
                              data-testid={`reject-expense-${expense.expense_id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {expense.status !== 'pending' && (
                          <span className={`status-badge ${
                            expense.status === 'approved' ? 'status-approved' : 'status-rejected'
                          }`}>
                            {expense.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, expense: null, action: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">
                {actionDialog.action === 'approve' ? 'Aprobar gasto' : 'Rechazar gasto'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {actionDialog.expense && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{actionDialog.expense.description}</p>
                  <p className="text-2xl font-bold mt-2">€{actionDialog.expense.amount.toFixed(2)}</p>
                </div>
              )}
              {actionDialog.action === 'reject' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Motivo del rechazo</p>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Indica el motivo del rechazo..."
                    rows={3}
                    data-testid="reject-reason"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setActionDialog({ open: false, expense: null, action: null })}>
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

        {/* Receipt Dialog */}
        <Dialog open={receiptDialog.open} onOpenChange={(open) => !open && setReceiptDialog({ open: false, receiptData: null, loading: false })}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Justificante</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center min-h-[200px]">
              {receiptDialog.loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : receiptDialog.receiptData ? (
                <img
                  src={`data:image/jpeg;base64,${receiptDialog.receiptData}`}
                  alt="Justificante"
                  className="max-w-full max-h-[60vh] rounded-lg"
                />
              ) : (
                <p className="text-muted-foreground">No se pudo cargar el justificante</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
