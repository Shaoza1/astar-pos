import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { AuthResponseDto, PinLoginDto } from '@astar-pos/shared';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import api from '@/services/api';
import { useAuth } from '@/store/auth.context';

const DEVICE_ID = 'pos-terminal-1';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  function press(digit: string) {
    if (pin.length < 6) setPin((p) => p + digit);
  }

  function backspace() {
    setPin((p) => p.slice(0, -1));
  }

  async function submit() {
    if (pin.length < 4) return;
    setLoading(true);
    try {
      const body: PinLoginDto = { pin, deviceId: DEVICE_ID };
      const { data } = await api.post<AuthResponseDto>('/auth/login/pin', body);
      login(data);
      toast.success(`Welcome, ${data.staff.fullName}!`);
      setTimeout(() => navigate('/pos'), 800);
    } catch {
      toast.error('Invalid PIN. Try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  async function biometric() {
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60_000,
        },
      });
      if (!credential) return;
      const pk = credential as PublicKeyCredential;
      const resp = pk.response as AuthenticatorAssertionResponse;
      const { data } = await api.post<AuthResponseDto>('/auth/login/biometric', {
        credentialId: pk.id,
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(resp.authenticatorData))),
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(resp.clientDataJSON))),
        signature: btoa(String.fromCharCode(...new Uint8Array(resp.signature))),
        deviceId: DEVICE_ID,
      });
      login(data);
      toast.success(`Welcome, ${data.staff.fullName}!`);
      setTimeout(() => navigate('/pos'), 800);
    } catch {
      toast.error('Biometric login failed.');
    }
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <div className="min-h-screen bg-[var(--color-primary)] flex items-center justify-center p-4">
      {!isOnline && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--color-accent)] text-white px-4 py-2 rounded-full text-sm font-medium">
          Offline — API unreachable
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-[var(--color-primary)] mb-2">
          Astar POS
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">Enter your PIN to sign in</p>

        {/* PIN display */}
        <div className="flex justify-center gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                i < pin.length
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        {/* PIN pad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {digits.map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className="h-14 rounded-xl bg-gray-100 text-xl font-semibold text-gray-800 hover:bg-gray-200 active:scale-95 transition-all"
            >
              {d}
            </button>
          ))}
          <button
            onClick={biometric}
            className="h-14 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
          >
            ⬡ Bio
          </button>
          <button
            onClick={backspace}
            className="h-14 rounded-xl bg-gray-100 text-xl font-medium text-gray-600 hover:bg-gray-200 active:scale-95 transition-all"
          >
            ⌫
          </button>
        </div>

        <button
          onClick={() => void submit()}
          disabled={pin.length < 4 || loading}
          className="w-full h-14 rounded-xl bg-[var(--color-primary)] text-white text-lg font-semibold disabled:opacity-40 hover:bg-[var(--color-primary-light)] active:scale-95 transition-all"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}
