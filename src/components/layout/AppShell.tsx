import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Box } from '@mui/material';
import SearchScreen from '../search/SearchScreen';
import NameDialog from '../auth/NameDialog';
const SideMenu = lazy(() => import('./SideMenu'));
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { useSelection } from '../../context/SelectionContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useDeepLinks } from '../../hooks/useDeepLinks';

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialSection, setMenuInitialSection] = useState<string | undefined>(undefined);
  const [sharedListId, setSharedListId] = useState<string | undefined>(undefined);
  const { selectedBusiness: currentBusiness, activeSharedListId, setActiveSharedListId } = useSelection();
  const { handleCreateAccount, handleLogin } = useOnboarding();

  // Deep links
  useDeepLinks();

  // Reopen shared list when BusinessSheet closes.
  const returnToListId = useRef<string | null>(null);
  const hadBusiness = useRef(false);

  useEffect(() => {
    if (activeSharedListId) {
      returnToListId.current = activeSharedListId;
    }
  }, [activeSharedListId]);

  useEffect(() => {
    if (currentBusiness) {
      hadBusiness.current = true;
    } else if (hadBusiness.current && returnToListId.current) {
      const listId = returnToListId.current;
      returnToListId.current = null;
      hadBusiness.current = false;
      setActiveSharedListId(null);
      setSharedListId(listId);
      setMenuInitialSection('lists');
      setMenuOpen(true);
    }
  }, [currentBusiness, setActiveSharedListId]);

  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <OfflineIndicator />
      <SearchScreen />
      <NameDialog />
      <Suspense fallback={null}>
      <SideMenu
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setMenuInitialSection(undefined);
        }}
        onOpen={() => setMenuOpen(true)}
        onClearSharedList={() => { setSharedListId(undefined); setActiveSharedListId(null); }}
        initialSection={menuInitialSection}
        sharedListId={sharedListId}
        onCreateAccount={handleCreateAccount}
        onLogin={handleLogin}
      />
      </Suspense>
    </Box>
  );
}
