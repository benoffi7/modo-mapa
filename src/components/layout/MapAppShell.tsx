import { SelectionProvider } from '../../context/SelectionContext';
import { OnboardingProvider } from '../../context/OnboardingContext';
import AppShell from './AppShell';

export default function MapAppShell() {
  return (
    <SelectionProvider>
      <OnboardingProvider>
        <AppShell />
      </OnboardingProvider>
    </SelectionProvider>
  );
}
