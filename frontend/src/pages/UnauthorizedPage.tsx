import { useNavigate } from 'react-router-dom';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-5xl mb-4">🚫</p>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-6">You don&apos;t have permission to view this page.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
