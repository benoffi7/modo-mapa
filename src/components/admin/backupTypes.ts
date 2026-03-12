export interface BackupEntry {
  id: string;
  createdAt: string;
}

export type ConfirmAction =
  | { type: 'restore'; backup: BackupEntry }
  | { type: 'delete'; backup: BackupEntry };
