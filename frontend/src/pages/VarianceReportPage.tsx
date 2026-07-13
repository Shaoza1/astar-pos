import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { ShiftReportDto, VarianceReportDto, VarianceReportRowDto } from '@astar-pos/shared';

import api from '@/services/api';
import { useAuth } from '@/store/auth.context';

type Filter = 'all' | 'shortages' | 'overs';

function statusChip(row: VarianceReportRowDto, actual: number) {
  const variance = actual - row.expectedConsumption;
  if (Math.abs(variance) < 0.01)
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-success)] text-white">
        Exact
      </span>
    );
  if (variance < 0)
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-danger)] text-white">
        Shortage
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)] text-white">
      Over
    </span>
  );
}

export default function VarianceReportPage() {
  const [shifts, setShifts] = useState<ShiftReportDto[]>([]);
  const [selectedShift, setSelectedShift] = useState('');
  const [report, setReport] = useState<VarianceReportDto | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const { currentStaff } = useAuth();

  useEffect(() => {
    api
      .get<ShiftReportDto[]>('/payments/shifts/history')
      .then((r) => {
        const closed = r.data.filter((s) => !s.isOpen);
        setShifts(closed);
        if (closed.length > 0) setSelectedShift(closed[0].id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedShift) return;
    api
      .get<VarianceReportDto>(`/reporting/variance/${selectedShift}?filter=${filter}`)
      .then((r) => {
        setReport(r.data);
        const initial: Record<string, string> = {};
        r.data.rows.forEach((row) => {
          initial[row.ingredientId] = String(row.actualCount);
        });
        setCounts(initial);
      })
      .catch(() => undefined);
  }, [selectedShift, filter]);

  async function submitCounts() {
    if (!report || !currentStaff) return;
    try {
      await api.post('/reporting/variance/submit', {
        shiftReportId: selectedShift,
        counts: Object.entries(counts).map(([ingredientId, v]) => ({
          ingredientId,
          actualCount: parseFloat(v) || 0,
        })),
        submittedBy: currentStaff.id,
      });
      toast.success('Counts submitted');
    } catch {
      toast.error('Failed to submit counts');
    }
  }

  async function printReport() {
    if (!selectedShift) return;
    await api.get(`/reporting/variance/${selectedShift}/print`);
    window.print();
  }

  // Group rows by ingredient group
  const grouped = (report?.rows ?? []).reduce<Record<string, VarianceReportRowDto[]>>(
    (acc, row) => {
      (acc[row.ingredientGroup] ??= []).push(row);
      return acc;
    },
    {}
  );

  const shortages =
    report?.rows.filter((r) => {
      const v = (parseFloat(counts[r.ingredientId] ?? '0') || 0) - r.expectedConsumption;
      return v < -0.01;
    }).length ?? 0;
  const overs =
    report?.rows.filter((r) => {
      const v = (parseFloat(counts[r.ingredientId] ?? '0') || 0) - r.expectedConsumption;
      return v > 0.01;
    }).length ?? 0;

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-bold text-[var(--color-primary)]">Variance Report</h1>

        <select
          value={selectedShift}
          onChange={(e) => setSelectedShift(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.shiftDate} — {s.shift}
            </option>
          ))}
        </select>

        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {(['all', 'shortages', 'overs'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm capitalize transition-colors ${
                filter === f
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => void printReport()}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            Print
          </button>
          <button
            onClick={() => void submitCounts()}
            className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold"
          >
            Submit Counts
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {report && (
        <div className="flex gap-4 mb-4 text-sm">
          <span className="text-[var(--color-danger)] font-semibold">{shortages} shortages</span>
          <span className="text-[var(--color-accent)] font-semibold">{overs} overs</span>
          <span className="text-[var(--color-success)] font-semibold">
            {report.rows.length - shortages - overs} exact
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                'Ingredient',
                'Group',
                'Unit',
                'Opening',
                'Received',
                'Expected',
                'Actual Count',
                'Variance',
                'Status',
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, rows]) =>
              rows.map((row, i) => {
                const actual = parseFloat(counts[row.ingredientId] ?? '0') || 0;
                const variance = actual - row.expectedConsumption;
                return (
                  <tr
                    key={row.ingredientId}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${i === 0 ? 'border-t-2 border-t-gray-200' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium">{row.ingredientName}</td>
                    <td className="px-3 py-2 text-gray-500">{i === 0 ? group : ''}</td>
                    <td className="px-3 py-2 text-gray-500">{row.consumptionUnit}</td>
                    <td className="px-3 py-2">{row.openingStock.toFixed(2)}</td>
                    <td className="px-3 py-2">{row.stockReceived.toFixed(2)}</td>
                    <td className="px-3 py-2">{row.expectedConsumption.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={counts[row.ingredientId] ?? ''}
                        onChange={(e) =>
                          setCounts((prev) => ({ ...prev, [row.ingredientId]: e.target.value }))
                        }
                        className="w-20 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                      />
                    </td>
                    <td
                      className={`px-3 py-2 font-semibold ${variance < -0.01 ? 'text-[var(--color-danger)]' : variance > 0.01 ? 'text-[var(--color-accent)]' : 'text-[var(--color-success)]'}`}
                    >
                      {variance >= 0 ? '+' : ''}
                      {variance.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">{statusChip(row, actual)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!report && (
          <div className="text-center text-gray-400 py-12">Select a shift to load the report</div>
        )}
      </div>
    </div>
  );
}
