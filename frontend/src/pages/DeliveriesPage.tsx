import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { CreateDeliveryDto, DeliveryDto, IngredientDto } from '@astar-pos/shared';

import api from '@/services/api';
import { useAuth } from '@/store/auth.context';

interface DeliveryLine {
  ingredientId: string;
  quantityOrdered: string;
  quantityReceived: string;
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [lines, setLines] = useState<DeliveryLine[]>([
    { ingredientId: '', quantityOrdered: '', quantityReceived: '' },
  ]);
  const { currentStaff } = useAuth();

  async function load() {
    const [{ data: dels }, { data: ings }] = await Promise.all([
      api.get<DeliveryDto[]>('/reporting/deliveries'),
      api.get<IngredientDto[]>('/inventory/ingredients'),
    ]);
    setDeliveries(dels);
    setIngredients(ings);
  }

  useEffect(() => {
    void load();
  }, []);

  async function recordDelivery() {
    if (!currentStaff || !supplier) return;
    const body: CreateDeliveryDto = {
      supplierName: supplier,
      deliveryDate: new Date().toISOString().slice(0, 10),
      invoiceReference: invoiceRef || undefined,
      recordedBy: currentStaff.id,
      items: lines
        .filter((l) => l.ingredientId && l.quantityReceived)
        .map((l) => ({
          ingredientId: l.ingredientId,
          quantityOrdered: l.quantityOrdered ? parseFloat(l.quantityOrdered) : undefined,
          quantityReceived: parseFloat(l.quantityReceived),
        })),
    };
    try {
      await api.post('/reporting/deliveries', body);
      toast.success('Delivery recorded');
      setShowForm(false);
      setSupplier('');
      setInvoiceRef('');
      setLines([{ ingredientId: '', quantityOrdered: '', quantityReceived: '' }]);
      await load();
    } catch {
      toast.error('Failed to record delivery');
    }
  }

  async function verify(id: string) {
    try {
      await api.patch(`/reporting/deliveries/${id}/verify`);
      toast.success('Delivery verified');
      await load();
    } catch {
      toast.error('Failed to verify');
    }
  }

  async function dispute(id: string) {
    try {
      await api.patch(`/reporting/deliveries/${id}/dispute`);
      toast.success('Delivery disputed');
      await load();
    } catch {
      toast.error('Failed to dispute');
    }
  }

  function statusBadge(status: DeliveryDto['status']) {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700',
      verified: 'bg-green-100 text-green-700',
      disputed: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status]}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--color-primary)]">Deliveries</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold"
        >
          + Record Delivery
        </button>
      </div>

      {/* Discrepancies */}
      {deliveries.some((d) => d.totalDiscrepancyItems > 0) && (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <h2 className="font-semibold text-[var(--color-danger)] mb-2">Discrepancies</h2>
          {deliveries
            .filter((d) => d.totalDiscrepancyItems > 0)
            .map((d) => (
              <div key={d.id} className="text-sm mb-1">
                <span className="font-medium">{d.supplierName}</span> — {d.totalDiscrepancyItems}{' '}
                item(s) differ
              </div>
            ))}
        </div>
      )}

      {/* Delivery list */}
      <div className="space-y-3">
        {deliveries.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold">{d.supplierName}</p>
                <p className="text-xs text-gray-500">
                  {d.deliveryDate}
                  {d.invoiceReference ? ` · ${d.invoiceReference}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(d.status)}
                {d.status === 'pending' && (
                  <>
                    <button
                      onClick={() => void verify(d.id)}
                      className="text-xs bg-[var(--color-success)] text-white px-3 py-1 rounded-lg"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => void dispute(d.id)}
                      className="text-xs bg-[var(--color-danger)] text-white px-3 py-1 rounded-lg"
                    >
                      Dispute
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {d.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span>{item.ingredientName}</span>
                  <span
                    className={`text-xs ${item.discrepancy !== 0 ? 'text-[var(--color-danger)] font-semibold' : 'text-gray-500'}`}
                  >
                    {item.quantityReceived} {item.purchaseUnit}
                    {item.discrepancy !== 0 &&
                      ` (${item.discrepancy > 0 ? '+' : ''}${item.discrepancy})`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Record delivery modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Record Delivery</h2>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Supplier name"
              />
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Invoice reference (optional)"
              />
            </div>
            <div className="space-y-2 mb-3">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={line.ingredientId}
                    onChange={(e) => {
                      const n = [...lines];
                      n[i] = { ...n[i], ingredientId: e.target.value };
                      setLines(n);
                    }}
                    className="flex-1 border rounded-lg px-2 py-2 text-sm"
                  >
                    <option value="">Ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={line.quantityOrdered}
                    onChange={(e) => {
                      const n = [...lines];
                      n[i] = { ...n[i], quantityOrdered: e.target.value };
                      setLines(n);
                    }}
                    className="w-16 border rounded-lg px-2 py-2 text-sm"
                    placeholder="Ord"
                  />
                  <input
                    type="number"
                    value={line.quantityReceived}
                    onChange={(e) => {
                      const n = [...lines];
                      n[i] = { ...n[i], quantityReceived: e.target.value };
                      setLines(n);
                    }}
                    className="w-16 border rounded-lg px-2 py-2 text-sm"
                    placeholder="Rcv"
                  />
                  <button
                    onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[var(--color-danger)] text-lg font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { ingredientId: '', quantityOrdered: '', quantityReceived: '' },
                ])
              }
              className="text-sm text-[var(--color-primary)] underline mb-4"
            >
              + Add item
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void recordDelivery()}
                disabled={!supplier}
                className="flex-1 h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
