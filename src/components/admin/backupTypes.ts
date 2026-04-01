import type { BackupEntry } from '../../types/admin';

export type { BackupEntry };

export type ConfirmAction =
  | { type: 'restore'; backup: BackupEntry }
  | { type: 'delete'; backup: BackupEntry };
