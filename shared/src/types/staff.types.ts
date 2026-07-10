export type StaffRole = 'owner' | 'manager' | 'waiter' | 'barman' | 'kitchen';

export interface StaffDto {
  id: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffDto {
  fullName: string;
  role: StaffRole;
  pin: string;
}

export interface UpdateStaffDto {
  fullName?: string;
  role?: StaffRole;
  isActive?: boolean;
}

export interface ChangePinDto {
  staffId: string;
  currentPin: string;
  newPin: string;
}

export interface PinLoginDto {
  pin: string;
  deviceId: string;
}

export interface WebAuthnLoginDto {
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  deviceId: string;
}

export interface WebAuthnRegistrationDto {
  staffId: string;
  credentialId: string;
  publicKey: string;
  deviceId: string;
}

export interface AuthResponseDto {
  accessToken: string;
  staff: StaffDto;
  sessionId: string;
}

export interface StaffSessionDto {
  id: string;
  staffId: string;
  staffName: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  deviceIdentifier: string;
  clockInMethod: 'pin' | 'biometric';
  flagged: boolean;
  flagReason: string | null;
}

export interface ClockOutDto {
  sessionId: string;
  deviceId: string;
}

export interface ActiveSessionsDto {
  sessions: StaffSessionDto[];
  flaggedCount: number;
}
