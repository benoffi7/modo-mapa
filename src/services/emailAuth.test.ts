import { getAuthErrorMessage, linkAnonymousWithEmail, signOutAndReset, resendVerificationEmail, sendResetEmail, changePassword } from './emailAuth';
import { STORAGE_KEY_VISITS } from '../constants/storage';

const mockLinkWithCredential = vi.fn();
const mockSendEmailVerification = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockReauthenticateWithCredential = vi.fn();
const mockUpdatePassword = vi.fn();
const mockCredential = { providerId: 'password' };

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: {
    credential: vi.fn(() => mockCredential),
  },
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticateWithCredential(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  auth: {},
}));

describe('getAuthErrorMessage', () => {
  it('maps known Firebase error codes to Spanish messages', () => {
    const error = Object.assign(new Error('test'), { code: 'auth/email-already-in-use' });
    expect(getAuthErrorMessage(error)).toBe('No se pudo crear la cuenta. Si ya tenés una, intentá iniciar sesión.');
  });

  it('maps wrong-password to generic credentials message', () => {
    const error = Object.assign(new Error('test'), { code: 'auth/wrong-password' });
    expect(getAuthErrorMessage(error)).toBe('Email o contraseña incorrectos.');
  });

  it('returns default message for unknown error codes', () => {
    const error = Object.assign(new Error('test'), { code: 'auth/unknown-error' });
    expect(getAuthErrorMessage(error)).toBe('Ocurrió un error. Intentá de nuevo.');
  });

  it('returns default message for non-Error objects', () => {
    expect(getAuthErrorMessage('string error')).toBe('Ocurrió un error. Intentá de nuevo.');
    expect(getAuthErrorMessage(null)).toBe('Ocurrió un error. Intentá de nuevo.');
    expect(getAuthErrorMessage(42)).toBe('Ocurrió un error. Intentá de nuevo.');
  });

  it('maps requires-recent-login to Spanish message', () => {
    const error = Object.assign(new Error('test'), { code: 'auth/requires-recent-login' });
    expect(getAuthErrorMessage(error)).toBe('Tu sesión expiró. Volvé a ingresar tu contraseña actual.');
  });
});

describe('linkAnonymousWithEmail', () => {
  const mockUser = { uid: 'test-uid' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    const linkedUser = { uid: 'test-uid', emailVerified: false };
    mockLinkWithCredential.mockResolvedValue({ user: linkedUser });
    mockSendEmailVerification.mockResolvedValue(undefined);
  });

  it('calls linkWithCredential and sendEmailVerification', async () => {
    await linkAnonymousWithEmail(mockUser, 'test@example.com', 'password123');

    expect(mockLinkWithCredential).toHaveBeenCalledWith(mockUser, mockCredential);
    expect(mockSendEmailVerification).toHaveBeenCalledWith({ uid: 'test-uid', emailVerified: false });
  });

  it('throws on linkWithCredential failure', async () => {
    mockLinkWithCredential.mockRejectedValue(
      Object.assign(new Error('fail'), { code: 'auth/email-already-in-use' }),
    );

    await expect(linkAnonymousWithEmail(mockUser, 'test@example.com', 'pass'))
      .rejects.toThrow('fail');
    expect(mockSendEmailVerification).not.toHaveBeenCalled();
  });
});

describe('resendVerificationEmail', () => {
  const mockUser = { uid: 'test-uid' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmailVerification.mockResolvedValue(undefined);
  });

  it('calls sendEmailVerification', async () => {
    await resendVerificationEmail(mockUser);
    expect(mockSendEmailVerification).toHaveBeenCalledWith(mockUser);
  });
});

describe('sendResetEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('calls sendPasswordResetEmail', async () => {
    await sendResetEmail('test@example.com');
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({}, 'test@example.com');
  });
});

describe('changePassword', () => {
  const mockUser = { uid: 'test-uid', email: 'test@example.com' } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReauthenticateWithCredential.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  it('re-authenticates then updates password', async () => {
    await changePassword(mockUser, 'oldpass', 'newpass123');
    expect(mockReauthenticateWithCredential).toHaveBeenCalledWith(mockUser, mockCredential);
    expect(mockUpdatePassword).toHaveBeenCalledWith(mockUser, 'newpass123');
  });

  it('throws on re-auth failure without calling updatePassword', async () => {
    mockReauthenticateWithCredential.mockRejectedValue(
      Object.assign(new Error('fail'), { code: 'auth/wrong-password' }),
    );

    await expect(changePassword(mockUser, 'wrong', 'newpass123')).rejects.toThrow('fail');
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});

describe('signOutAndReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    localStorage.clear();
  });

  it('calls firebaseSignOut', async () => {
    await signOutAndReset();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('removes STORAGE_KEY_VISITS from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify([{ id: '1' }]));
    await signOutAndReset();
    expect(localStorage.getItem(STORAGE_KEY_VISITS)).toBeNull();
  });

  it('does NOT remove color mode preference', async () => {
    localStorage.setItem('modo-mapa-color-mode', 'dark');
    await signOutAndReset();
    expect(localStorage.getItem('modo-mapa-color-mode')).toBe('dark');
  });
});
