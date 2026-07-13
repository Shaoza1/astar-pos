import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { IngredientDto, IngredientGroupDto } from '@astar-pos/shared';

import api from '@/services/api';
import { useAuth } from '@/store/auth.context';

function stockChip(status: IngredientDto['stockStatus']) {
  if (status === 'out')
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-danger)] text-white">
        Out
      </span>
    );
  if (status === 'low')
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)] text-white">
        Low
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-success)] text-white">
      OK
    </span>
  );
}

export default function InventoryPage() {
  const [groups, setGroups] = useState<IngredientGroupDto[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDto[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adjustModal, setAdjustModal] = useState<IngredientDto | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const { currentStaff } = useAuth();

  async function load() {
    const [{ data: grps }, { data: ings }] = await Promise.all([
      api.get<IngredientGroupDto[]>('/inventory/groups'),
      api.get<IngredientDto[]>('/inventory/ingredients'),
    ]);
    setGroups(grps);
    setIngredients(ings);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitAdjustment() {
    if (!adjustModal || !currentStaff || !adjustReason.trim()) return;
    try {
      await api.post('/inventory/stock/adjust', {
        ingredientId: adjustModal.id,
        quantityChange: parseFloat(adjustQty),
        reason: adjustReason,
        performedBy: currentStaff.id,
      });
      toast.success('Adjustment recorded');
      setAdjustModal(null);
      setAdjustQty('');
      setAdjustReason('');
      await load();
    } catch {
      toast.error('Failed to record adjustment');
    }
  }

  const lowItems = ingredients.filter((i) => i.stockStatus !== 'ok');

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4 space-y-4">
      <h1 className="text-xl font-bold text-[var(--color-primary)]">Inventory</h1>

      {/* Low stock section */}
      {lowItems.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <h2 className="font-semibold text-[var(--color-danger)] mb-3">
            Needs Attention ({lowItems.length})
          </h2>
          <div className="space-y-2">
            {lowItems.map((ing) => (
              <div key={ing.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{ing.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {ing.currentStock} {ing.consumptionUnit}
                  </span>
                  {stockChip(ing.stockStatus)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      {groups.map((group) => {
        const items = ingredients.filter((i) => i.groupId === group.id && i.isActive);
        const isCollapsed = collapsed.has(group.id);
        return (
          <div key={group.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                })
              }
              className="w-full flex items-center justify-between px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              <span>
                {group.name}{' '}
                <span className="text-gray-400 font-normal text-sm">({items.length})</span>
              </span>
              <span className="text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
            </button>
            {!isCollapsed && (
              <table className="w-full text-sm border-t border-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      'Name',
                      'Purchase Unit',
                      'Consumption Unit',
                      'Stock',
                      'Threshold',
                      'Status',
                      '',
                    ].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs text-gray-500 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((ing) => (
                    <tr key={ing.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{ing.name}</td>
                      <td className="px-3 py-2 text-gray-500">{ing.purchaseUnit}</td>
                      <td className="px-3 py-2 text-gray-500">{ing.consumptionUnit}</td>
                      <td className="px-3 py-2 font-semibold">{ing.currentStock}</td>
                      <td className="px-3 py-2 text-gray-500">{ing.lowStockThreshold}</td>
                      <td className="px-3 py-2">{stockChip(ing.stockStatus)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setAdjustModal(ing)}
                          className="text-xs text-[var(--color-primary)] underline"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Adjustment modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h2 className="text-lg font-bold mb-1">Record Adjustment</h2>
            <p className="text-sm text-gray-600 mb-4">
              {adjustModal.name} — current: {adjustModal.currentStock} {adjustModal.consumptionUnit}
            </p>
            <label className="block text-sm text-gray-600 mb-1">Quantity change (+ or −)</label>
            <input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3"
              placeholder="-5 or +10"
            />
            <label className="block text-sm text-gray-600 mb-1">Reason</label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="e.g. Waste, Spillage"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setAdjustModal(null)}
                className="flex-1 h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitAdjustment()}
                disabled={!adjustQty || !adjustReason.trim()}
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
