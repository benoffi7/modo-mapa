import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export const setAdminClaim = httpsCallable<{ targetUid: string }, void>(functions, 'setAdminClaim');
