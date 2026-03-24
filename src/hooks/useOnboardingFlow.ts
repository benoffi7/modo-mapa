import { useState, useCallback } from 'react';
import { STORAGE_KEY_BENEFITS_SHOWN } from '../constants/storage';

type BenefitsSource = 'banner' | 'menu' | 'settings';
type EmailDialogTab = 'register' | 'login';

interface UseOnboardingFlowReturn {
  benefitsOpen: boolean;
  benefitsSource: BenefitsSource;
  emailDialogOpen: boolean;
  emailDialogTab: EmailDialogTab;
  handleCreateAccount: (source?: BenefitsSource) => void;
  handleLogin: () => void;
  handleBenefitsContinue: () => void;
  closeBenefits: () => void;
  closeEmailDialog: () => void;
}

export function useOnboardingFlow(): UseOnboardingFlowReturn {
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [benefitsSource, setBenefitsSource] = useState<BenefitsSource>('banner');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogTab, setEmailDialogTab] = useState<EmailDialogTab>('register');

  const handleCreateAccount = useCallback((source: BenefitsSource = 'banner') => {
    setEmailDialogTab('register');
    if (localStorage.getItem(STORAGE_KEY_BENEFITS_SHOWN) === 'true') {
      setEmailDialogOpen(true);
    } else {
      setBenefitsSource(source);
      setBenefitsOpen(true);
    }
  }, []);

  const handleLogin = useCallback(() => {
    setEmailDialogTab('login');
    setEmailDialogOpen(true);
  }, []);

  const handleBenefitsContinue = useCallback(() => {
    setBenefitsOpen(false);
    setEmailDialogOpen(true);
  }, []);

  const closeBenefits = useCallback(() => {
    setBenefitsOpen(false);
  }, []);

  const closeEmailDialog = useCallback(() => {
    setEmailDialogOpen(false);
  }, []);

  return {
    benefitsOpen,
    benefitsSource,
    emailDialogOpen,
    emailDialogTab,
    handleCreateAccount,
    handleLogin,
    handleBenefitsContinue,
    closeBenefits,
    closeEmailDialog,
  };
}
