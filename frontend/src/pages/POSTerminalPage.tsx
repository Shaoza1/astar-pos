import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { TableDto } from '@astar-pos/shared';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import api from '@/services/api';
import { useAuth } from '@/store/auth.context';
import { getPendingCount } from '@/store/offline.store';

function elapsed(openedAt: string): string {
  const ms = Date.now() - new Date(openedAt).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function POSTerminalPage() {
  const [tables, setTables] = useState<TableDto[]>([]);
  const [openModal, setOpenModal] = useState<TableDto | null>(null);
  const [guestCount, setGuestCount] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const { currentStaff } = useAuth();
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  async function loadTables() {
    try {
      const { data } = await api.get<TableDto[]>('/orders/tables');
      setTables(data);
    } catch {
      toast.error('Could not load tables');
    }
  }

  useEffect(() => {
    void loadTables();
    const interval = setInterval(() => void loadTables(), 30_000);
    getPendingCount()
      .then(setPendingCount)
      .catch(() => undefined);
    return () => clearInterval(interval);
  }, []);

  async function openSession() {
    if (!openModal || !currentStaff) return;
    try {
      await api.post('/orders/sessions/open', {
        tableId: openModal.id,
        openedBy: currentStaff.id,
        guestCount: guestCount ? parseInt(guestCount) : undefined,
      });
      toast.success(`Table ${openModal.tableNumber} opened`);
      setOpenModal(null);
      setGuestCount('');
      await loadTables();
    } catch {
      toast.error('Failed to open table');
    }
  }

  function tableColour(t: TableDto): string {
    if (!t.currentSession) return 'bg-[var(--color-success)] text-white';
    if (t.currentSession.isFlagged) return 'bg-[var(--color-accent)] text-white';
    return 'bg-[var(--color-danger)] text-white';
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--color-primary)]">Tables</h1>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="bg-[var(--color-accent)] text-white text-xs px-3 py-1 rounded-full">
              Offline
            </span>
          )}
          {pendingCount > 0 && (
            <span className="bg-gray-700 text-white text-xs px-3 py-1 rounded-full">
              {pendingCount} pending sync
            </span>
          )}
          <span className="text-sm text-gray-600">{currentStaff?.fullName}</span>
        </div>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (t.currentSession) {
                navigate(`/pos/table/${t.currentSession.id}`);
              } else {
                setOpenModal(t);
              }
            }}
            className={`${tableColour(t)} rounded-2xl p-4 min-h-[100px] flex flex-col items-center justify-center gap-1 shadow active:scale-95 transition-all`}
          >
            <span className="text-2xl font-bold">{t.tableNumber}</span>
            {t.currentSession ? (
              <>
                <span className="text-xs opacity-90">
                  R{t.currentSession.totalAmount.toFixed(2)}
                </span>
                <span className="text-xs opacity-75">{elapsed(t.currentSession.openedAt)}</span>
                {t.currentSession.isFlagged && (
                  <span className="text-xs font-semibold">⚠ Flagged</span>
                )}
              </>
            ) : (
              <span className="text-xs opacity-75">Available</span>
            )}
          </button>
        ))}
      </div>

      {/* Open session modal */}
      {openModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h2 className="text-lg font-bold mb-4">Open Table {openModal.tableNumber}</h2>
            <label className="block text-sm text-gray-600 mb-1">Guest count (optional)</label>
            <input
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4 text-lg"
              placeholder="e.g. 4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setOpenModal(null);
                  setGuestCount('');
                }}
                className="flex-1 h-12 rounded-xl border border-gray-300 text-gray-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => void openSession()}
                className="flex-1 h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
