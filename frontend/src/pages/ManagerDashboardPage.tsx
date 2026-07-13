import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LowStockAlertDto, ShiftReportDto, TableSessionDto } from '@astar-pos/shared';

import api from '@/services/api';

export default function ManagerDashboardPage() {
  const [sessions, setSessions] = useState<TableSessionDto[]>([]);
  const [shift, setShift] = useState<ShiftReportDto | null>(null);
  const [lowStock, setLowStock] = useState<LowStockAlertDto[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    void Promise.all([
      api.get<TableSessionDto[]>('/orders/sessions/flagged').then((r) => setSessions(r.data)),
      api.get<ShiftReportDto>('/payments/shifts/current').then((r) => setShift(r.data)),
      api.get<LowStockAlertDto[]>('/inventory/stock/alerts').then((r) => setLowStock(r.data)),
    ]).catch(() => undefined);
  }, []);

  function elapsed(openedAt: string): string {
    const m = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--color-primary)]">Manager Dashboard</h1>
        <button
          onClick={() => navigate('/admin')}
          className="text-sm text-[var(--color-primary)] underline"
        >
          Admin →
        </button>
      </div>

      {/* Shift summary */}
      {shift && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-3">Current Shift</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Sales</p>
              <p className="text-xl font-bold text-[var(--color-primary)]">
                R{shift.totalSales.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cash</p>
              <p className="text-xl font-bold">R{shift.totalCash.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Card</p>
              <p className="text-xl font-bold">R{shift.totalCard.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Flagged sessions */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-3">
            Flagged Tables
            <span className="ml-2 bg-[var(--color-danger)] text-white text-xs px-2 py-0.5 rounded-full">
              {sessions.length}
            </span>
          </h2>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-3 border border-red-100"
              >
                <div>
                  <p className="font-semibold text-sm">Table {s.tableNumber}</p>
                  <p className="text-xs text-gray-500">{elapsed(s.openedAt)} open</p>
                  {s.flagReason && (
                    <p className="text-xs text-[var(--color-danger)]">{s.flagReason}</p>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/pos/table/${s.id}`)}
                  className="text-xs bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-3">
            Low Stock Alerts
            <span className="ml-2 bg-[var(--color-accent)] text-white text-xs px-2 py-0.5 rounded-full">
              {lowStock.length}
            </span>
          </h2>
          <div className="space-y-2">
            {lowStock.map((a) => (
              <div
                key={a.ingredientId}
                className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-lg border border-amber-100"
              >
                <span className="text-sm font-medium">{a.ingredientName}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    a.stockStatus === 'out'
                      ? 'bg-[var(--color-danger)] text-white'
                      : 'bg-[var(--color-accent)] text-white'
                  }`}
                >
                  {a.stockStatus === 'out' ? 'OUT' : `${a.currentStock} ${a.consumptionUnit}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Variance Report', path: '/admin/variance' },
          { label: 'Sales Report', path: '/admin/sales' },
          { label: 'Deliveries', path: '/admin/deliveries' },
          { label: 'Inventory', path: '/admin/inventory' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="bg-white rounded-xl p-4 text-left shadow-sm border border-gray-100 hover:border-[var(--color-primary)] transition-colors"
          >
            <span className="font-medium text-[var(--color-primary)]">{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
