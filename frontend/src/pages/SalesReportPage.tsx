import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SalesSummaryDto } from '@astar-pos/shared';

import api from '@/services/api';

export default function SalesReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<SalesSummaryDto | null>(null);

  useEffect(() => {
    api
      .get<SalesSummaryDto>(`/reporting/sales/summary?from=${from}&to=${to}`)
      .then((r) => setSummary(r.data))
      .catch(() => undefined);
  }, [from, to]);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-[var(--color-primary)]">Sales Report</h1>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: `R${summary.totalRevenue.toFixed(2)}` },
              { label: 'Transactions', value: summary.totalTransactions },
              { label: 'Avg Table Spend', value: `R${summary.averageTableSpend.toFixed(2)}` },
              { label: 'Total Voids', value: summary.totalVoids },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-[var(--color-primary)]">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Revenue by group */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Revenue by Menu Group</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.byGroup}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="groupName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? `R${v.toFixed(2)}` : String(v))}
                />
                <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by hour */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">Revenue by Hour</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary.byHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h: number) => `${h}:00`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? `R${v.toFixed(2)}` : String(v))}
                />
                <Bar dataKey="revenue" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top items */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-3">Top 10 Items</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Item</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Qty</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {summary.topItems.slice(0, 10).map((item) => (
                  <tr key={item.menuItemId} className="border-b border-gray-50">
                    <td className="py-2 font-medium">{item.menuItemName}</td>
                    <td className="py-2 text-right text-gray-600">{item.quantitySold}</td>
                    <td className="py-2 text-right font-semibold text-[var(--color-primary)]">
                      R{item.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By staff */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-3">Sales by Staff</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Staff</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Tables</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Sales</th>
                </tr>
              </thead>
              <tbody>
                {summary.byStaff.map((s) => (
                  <tr key={s.staffId} className="border-b border-gray-50">
                    <td className="py-2 font-medium">{s.staffName}</td>
                    <td className="py-2 text-right text-gray-600">{s.tablesClosed}</td>
                    <td className="py-2 text-right font-semibold text-[var(--color-primary)]">
                      R{s.totalSales.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
