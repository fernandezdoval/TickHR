import React, { useEffect, useState, useRef } from 'react';
import { expensesAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Receipt, Loader2, Upload, Calendar, Euro, Image } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  { value: 'transport', label: 'Transporte' },
  { value: 'meals', label: 'Comidas' },
  { value: 'accommodation', label: 'Alojamiento' },
  { value: 'supplies', label: 'Material' },
  { value: 'other', label: 'Otros' },
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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: '',
    receipt: null,
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const response = await expensesAPI.getMyExpenses();
      setExpenses(response.data);
    } catch (error) {
      toast.error('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, receipt: file });
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = new FormData();
      data.append('description', formData.description);
      data.append('amount', formData.amount);
      data.append('category', formData.category);
      data.append('date', formData.date);
      if (formData.receipt) {
        data.append('receipt', formData.receipt);
      }

      await expensesAPI.create(data);
      toast.success('Gasto registrado correctamente');
      setDialogOpen(false);
      setFormData({ description: '', amount: '', category: '', date: '', receipt: null });
      setReceiptPreview(null);
      await loadExpenses();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (value) => EXPENSE_CATEGORIES.find(c => c.value === value)?.label || value;

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
            <h1 className="font-heading text-2xl font-bold text-foreground">Mis Gastos</h1>
            <p className="text-muted-foreground">Registra y gestiona tus gastos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary" data-testid="new-expense-btn">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Registrar gasto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ej: Taxi aeropuerto"
                    required
                    data-testid="expense-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Importe (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      required
                      data-testid="expense-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      data-testid="expense-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                    required
                  >
                    <SelectTrigger data-testid="expense-category-select">
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Receipt Upload */}
                <div className="space-y-2">
                  <Label>Justificante (opcional)</Label>
                  <div
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="expense-receipt-upload"
                  >
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="Receipt" className="max-h-32 mx-auto rounded" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">Haz clic para subir imagen</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting} data-testid="submit-expense-btn">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrar gasto
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold tabular-nums">
                {expenses.filter(e => e.status === 'pending').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Aprobados</p>
              <p className="text-2xl font-bold tabular-nums text-green-600">
                €{expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Rechazados</p>
              <p className="text-2xl font-bold tabular-nums text-red-600">
                {expenses.filter(e => e.status === 'rejected').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Expenses List */}
        <Card>
          <CardContent className="p-0">
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No tienes gastos registrados</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  Registrar primer gasto
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {expenses.map((expense) => (
                  <div key={expense.expense_id} className="p-4 table-row">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{expense.description}</span>
                          <span className={`status-badge ${STATUS_STYLES[expense.status]}`}>
                            {STATUS_LABELS[expense.status]}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-4">
                          <span>{getCategoryLabel(expense.category)}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {expense.date}
                          </span>
                        </p>
                        {expense.rejection_reason && (
                          <p className="text-xs text-red-600">Motivo: {expense.rejection_reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums">€{expense.amount.toFixed(2)}</p>
                      </div>
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
