import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { ShiftReportDto } from '@astar-pos/shared';

import api from '@/services/api';
import { useAuth } from '@/store/auth.context';

export default function ShiftManagementPage() {
  const [current, setCurrent] = useState<ShiftReportDto | null>(null);
  const [history, setHistory] = useState<ShiftReportDto[]>([]);
  const [cashFloat, setCashFloat] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [shift, setShift] = useState<'morning' | 'evening'>('morning');
  const { currentStaff } = useAuth();

  async function load() {
    await Promise.all([
      api
        .get<ShiftReportDto>('/payments/shifts/current')
        .then((r) => setCurrent(r.data))
        .catch(() => setCurrent(null)),
      api
        .get<ShiftReportDto[]>('/payments/shifts/history')
        .then((r) => setHistory(r.data))
        .catch(() => undefined),
    ]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function openShift() {
    if (!currentStaff) return;
    try {
      await api.post('/payments/shifts/open', {
        shift,
        openedBy: currentStaff.id,
        openingCashFloat: parseFloat(cashFloat) || 0,
      });
      toast.success('Shift opened');
      setCashFloat('');
      await load();
    } catch {
      toast.error('Failed to open shift');
    }
  }

  async function closeShift() {
    if (!current || !currentStaff) return;
    try {
      await api.post('/payments/shifts/close', {
        shiftReportId: current.id,
        closedBy: currentStaff.id,
        actualCashInTill: parseFloat(actualCash) || 0,
      });
      toast.success('Shift closed');
      setActualCash('');
      await load();
    } catch {
      toast.error('Failed to close shift');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4 space-y-4">
      <h1 className="text-xl font-bold text-[var(--color-primary)]">Shifts</h1>

      {/* Current shift */}
      {current ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Current Shift — {current.shift}</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Open
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">Total Sales</p>
              <p className="text-xl font-bold">R{current.totalSales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cash</p>
              <p className="text-xl font-bold">R{current.totalCash.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Card</p>
              <p className="text-xl font-bold">R{current.totalCard.toFixed(2)}</p>
            </div>
          </div>
          <label className="block text-sm text-gray-600 mb-1">Actual cash in till</label>
          <input
            type="number"
            value={actualCash}
            onChange={(e) => setActualCash(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="0.00"
          />
          {actualCash && (
            <p
              className={`text-sm font-semibold mb-3 ${
                parseFloat(actualCash) - current.totalCash < -10
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-success)]'
              }`}
            >
              Variance: R{(parseFloat(actualCash) - current.totalCash).toFixed(2)}
            </p>
          )}
          <button
            onClick={() => void closeShift()}
            disabled={!actualCash}
            className="w-full h-12 rounded-xl bg-[var(--color-danger)] text-white font-semibold disabled:opacity-40"
          >
            Close Shift
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-3">Open New Shift</h2>
          <div className="flex gap-3 mb-3">
            {(['morning', 'evening'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setShift(s)}
                className={`flex-1 h-12 rounded-xl font-medium capitalize transition-colors ${
                  shift === s
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-gray-300 text-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <label className="block text-sm text-gray-600 mb-1">Opening cash float</label>
          <input
            type="number"
            value={cashFloat}
            onChange={(e) => setCashFloat(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="0.00"
          />
          <button
            onClick={() => void openShift()}
            className="w-full h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold"
          >
            Open {shift.charAt(0).toUpperCase() + shift.slice(1)} Shift
          </button>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <h2 className="font-semibold text-gray-700 px-4 py-3 border-b border-gray-100">
          Shift History
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Date', 'Shift', 'Sales', 'Cash Variance', 'Status'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs text-gray-500 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2">{s.shiftDate}</td>
                <td className="px-4 py-2 capitalize">{s.shift}</td>
                <td className="px-4 py-2 font-semibold">R{s.totalSales.toFixed(2)}</td>
                <td
                  className={`px-4 py-2 font-semibold ${
                    s.cashVariance !== null && Math.abs(s.cashVariance) > 50
                      ? 'text-[var(--color-danger)]'
                      : 'text-gray-700'
                  }`}
                >
                  {s.cashVariance !== null ? `R${s.cashVariance.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${s.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {s.isOpen ? 'Open' : 'Closed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
