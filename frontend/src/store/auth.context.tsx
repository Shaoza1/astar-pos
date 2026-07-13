import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthResponseDto, StaffDto, StaffRole } from '@astar-pos/shared';

import api from '@/services/api';

interface AuthContextValue {
  currentStaff: StaffDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  role: StaffRole | null;
  login: (response: AuthResponseDto) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentStaff, setCurrentStaff] = useState<StaffDto | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const staffRaw = localStorage.getItem('current_staff');
    if (token && staffRaw) {
      try {
        const staff = JSON.parse(staffRaw) as StaffDto;
        setAccessToken(token);
        setCurrentStaff(staff);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('current_staff');
      }
    }
  }, []);

  function login(response: AuthResponseDto) {
    localStorage.setItem('access_token', response.accessToken);
    localStorage.setItem('current_staff', JSON.stringify(response.staff));
    api.defaults.headers.common['Authorization'] = `Bearer ${response.accessToken}`;
    setAccessToken(response.accessToken);
    setCurrentStaff(response.staff);
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_staff');
    delete api.defaults.headers.common['Authorization'];
    setAccessToken(null);
    setCurrentStaff(null);
  }

  return (
    <AuthContext.Provider
      value={{
        currentStaff,
        accessToken,
        isAuthenticated: !!accessToken,
        role: currentStaff?.role ?? null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
