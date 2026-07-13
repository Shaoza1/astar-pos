import { useState } from 'react';
import toast from 'react-hot-toast';
import type { ProcessPaymentDto, ProcessSplitPaymentDto } from '@astar-pos/shared';

import api from '@/services/api';

interface Props {
  sessionId: string;
  total: number;
  processedBy: string;
  onSuccess: () => void;
  onClose: () => void;
}

type Method = 'cash' | 'card' | 'split';

interface SplitLine {
  amount: string;
  method: 'cash' | 'card';
}

export function PaymentModal({ sessionId, total, processedBy, onSuccess, onClose }: Props) {
  const [method, setMethod] = useState<Method>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [splits, setSplits] = useState<SplitLine[]>([
    { amount: '', method: 'cash' },
    { amount: '', method: 'card' },
  ]);
  const [loading, setLoading] = useState(false);

  const change = method === 'cash' ? (parseFloat(cashReceived) || 0) - total : 0;
  const splitTotal = splits.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const splitValid = Math.abs(splitTotal - total) < 0.01;

  async function confirm() {
    setLoading(true);
    try {
      if (method === 'split') {
        const body: ProcessSplitPaymentDto = {
          tableSessionId: sessionId,
          processedBy,
          splits: splits
            .filter((l) => parseFloat(l.amount) > 0)
            .map((l) => ({ amount: parseFloat(l.amount), paymentMethod: l.method })),
        };
        await api.post('/payments/split', body);
      } else {
        const body: ProcessPaymentDto = {
          tableSessionId: sessionId,
          paymentMethod: method,
          amount: total,
          processedBy,
          paymentReference: method === 'card' ? cardRef : undefined,
        };
        await api.post('/payments/process', body);
      }
      toast.success('Payment processed');
      onSuccess();
    } catch {
      toast.error('Payment failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-lg font-bold mb-1">Payment</h2>
        <p className="text-2xl font-bold text-[var(--color-primary)] mb-4">R{total.toFixed(2)}</p>

        {/* Method toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4">
          {(['cash', 'card', 'split'] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                method === m
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Amount received</label>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-lg"
              placeholder="0.00"
            />
            {change > 0 && (
              <p className="mt-2 text-[var(--color-success)] font-semibold">
                Change: R{change.toFixed(2)}
              </p>
            )}
          </div>
        )}

        {method === 'card' && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Process on card terminal, then enter reference:
            </p>
            <input
              type="text"
              value={cardRef}
              onChange={(e) => setCardRef(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Terminal reference"
            />
          </div>
        )}

        {method === 'split' && (
          <div className="mb-4 space-y-2">
            {splits.map((line, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={line.method}
                  onChange={(e) => {
                    const next = [...splits];
                    next[i] = { ...next[i], method: e.target.value as 'cash' | 'card' };
                    setSplits(next);
                  }}
                  className="border rounded-lg px-2 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
                <input
                  type="number"
                  value={line.amount}
                  onChange={(e) => {
                    const next = [...splits];
                    next[i] = { ...next[i], amount: e.target.value };
                    setSplits(next);
                  }}
                  className="flex-1 border rounded-lg px-3 py-2"
                  placeholder="Amount"
                />
              </div>
            ))}
            <p
              className={`text-sm font-medium ${splitValid ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
            >
              Total: R{splitTotal.toFixed(2)} / R{total.toFixed(2)}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => void confirm()}
            disabled={loading || (method === 'split' && !splitValid)}
            className="flex-1 h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40"
          >
            {loading ? 'Processing…' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
