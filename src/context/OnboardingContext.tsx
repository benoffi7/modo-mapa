import { createContext, useContext, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useOnboardingFlow } from '../hooks/useOnboardingFlow';
import { useActivityReminder } from '../hooks/useActivityReminder';

const AccountBanner = lazy(() => import('../components/onboarding/AccountBanner'));
const ActivityReminder = lazy(() => import('../components/onboarding/ActivityReminder'));
const BenefitsDialog = lazy(() => import('../components/onboarding/BenefitsDialog'));
const EmailPasswordDialog = lazy(() => import('../components/auth/EmailPasswordDialog'));

interface OnboardingContextType {
  handleCreateAccount: (source?: 'banner' | 'menu' | 'settings') => void;
  handleLogin: () => void;
  emailDialogOpen: boolean;
  emailDialogTab: 'register' | 'login';
  closeEmailDialog: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  handleCreateAccount: () => {},
  handleLogin: () => {},
  emailDialogOpen: false,
  emailDialogTab: 'register',
  closeEmailDialog: () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const {
    benefitsOpen, benefitsSource, emailDialogOpen, emailDialogTab,
    handleCreateAccount, handleLogin, handleBenefitsContinue,
    closeBenefits, closeEmailDialog,
  } = useOnboardingFlow();
  const { showReminder, dismissReminder } = useActivityReminder();

  return (
    <OnboardingContext.Provider value={{ handleCreateAccount, handleLogin, emailDialogOpen, emailDialogTab, closeEmailDialog }}>
      {children}
      <Suspense fallback={null}>
        <AccountBanner onCreateAccount={() => handleCreateAccount('banner')} />
        <ActivityReminder
          open={showReminder}
          onCreateAccount={() => handleCreateAccount('banner')}
          onDismiss={dismissReminder}
        />
        {benefitsOpen && (
          <BenefitsDialog
            open={benefitsOpen}
            onContinue={handleBenefitsContinue}
            onClose={closeBenefits}
            source={benefitsSource}
          />
        )}
        {emailDialogOpen && (
          <EmailPasswordDialog
            open
            onClose={closeEmailDialog}
            initialTab={emailDialogTab}
          />
        )}
      </Suspense>
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
