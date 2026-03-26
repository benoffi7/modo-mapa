import { SelectionProvider } from '../../context/SelectionContext';
import { OnboardingProvider } from '../../context/OnboardingContext';
import { TabProvider } from '../../context/TabContext';
import TabShell from './TabShell';

export default function MapAppShell() {
  return (
    <SelectionProvider>
      <TabProvider>
        <OnboardingProvider>
          <TabShell />
        </OnboardingProvider>
      </TabProvider>
    </SelectionProvider>
  );
}
