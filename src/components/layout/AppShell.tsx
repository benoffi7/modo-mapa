import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Snackbar, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MapView from '../map/MapView';
import LocationFAB from '../map/LocationFAB';
import OfficeFAB from '../map/OfficeFAB';
import SearchBar from '../search/SearchBar';
import FilterChips from '../search/FilterChips';
import BusinessSheet from '../business/BusinessSheet';
import NameDialog from '../auth/NameDialog';
const SideMenu = lazy(() => import('./SideMenu'));
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { useSelection } from '../../context/MapContext';
import { allBusinesses } from '../../hooks/useBusinesses';
import { AUTO_DISMISS_MS } from '../../constants/timing';
import { useActivityReminder } from '../../hooks/useActivityReminder';
import { useOnboardingHint } from '../../hooks/useOnboardingHint';
import { useOnboardingFlow } from '../../hooks/useOnboardingFlow';

const AccountBanner = lazy(() => import('../onboarding/AccountBanner'));
const ActivityReminder = lazy(() => import('../onboarding/ActivityReminder'));
const BenefitsDialog = lazy(() => import('../onboarding/BenefitsDialog'));

function MapHint() {
  const { show, dismiss } = useOnboardingHint();
  const { selectedBusiness } = useSelection();

  // Close hint when a marker is selected
  const prevBusiness = useRef(selectedBusiness);
  useEffect(() => {
    if (selectedBusiness && !prevBusiness.current && show) dismiss();
    prevBusiness.current = selectedBusiness;
  }, [selectedBusiness, show, dismiss]);

  if (!show) return null;

  return (
    <Snackbar
      open
      autoHideDuration={AUTO_DISMISS_MS}
      onClose={dismiss}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <IconButton size="small" color="inherit" onClick={dismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        Tocá un comercio en el mapa para calificarlo
      </Alert>
    </Snackbar>
  );
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialSection, setMenuInitialSection] = useState<string | undefined>(undefined);
  const [sharedListId, setSharedListId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedBusiness: currentBusiness, setSelectedBusiness, activeSharedListId, setActiveSharedListId } = useSelection();

  // Onboarding: benefits dialog + account creation flow (single source of truth)
  const {
    benefitsOpen, benefitsSource, emailDialogOpen, emailDialogTab,
    handleCreateAccount, handleLogin, handleBenefitsContinue,
    closeBenefits, closeEmailDialog,
  } = useOnboardingFlow();
  const { showReminder, dismissReminder } = useActivityReminder();

  // Reopen shared list when BusinessSheet closes.
  // A ref stores the list ID to return to — immune to React batching/closure issues.
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
      // BusinessSheet just closed AND we have a list to return to
      const listId = returnToListId.current;
      returnToListId.current = null;
      hadBusiness.current = false;
      setActiveSharedListId(null);
      setSharedListId(listId);
      setMenuInitialSection('lists');
      setMenuOpen(true);
    }
  }, [currentBusiness, setActiveSharedListId]);

  // Deep link: ?business=biz_001 opens the business sheet
  // Deep link: ?list=xxx opens SideMenu on lists section
  useEffect(() => {
    const bizId = searchParams.get('business');
    if (bizId) {
      const biz = allBusinesses.find((b) => b.id === bizId);
      if (biz) {
        setSelectedBusiness(biz);
      }
      searchParams.delete('business');
      setSearchParams(searchParams, { replace: true });
    }

    const listId = searchParams.get('list');
    if (listId) {
      setSharedListId(listId);
      setMenuInitialSection('lists');
      setMenuOpen(true);
      searchParams.delete('list');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  }, []);

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
      <SearchBar onMenuClick={() => {
        setSharedListId(undefined);
        setActiveSharedListId(null);
        setMenuInitialSection(undefined);
        setMenuOpen(true);
      }} />
      <FilterChips />
      <MapView />
      <LocationFAB />
      <OfficeFAB />
      <BusinessSheet />
      <NameDialog />
      <MapHint />
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
      </Suspense>
      <Suspense fallback={null}>
      <SideMenu
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setMenuInitialSection(undefined);
          // Don't clear sharedListId/activeSharedListId here —
          // they get cleared by the navigate-back effect or when the menu
          // opens fresh from hamburger button.
        }}
        onOpen={() => setMenuOpen(true)}
        onClearSharedList={() => { setSharedListId(undefined); setActiveSharedListId(null); }}
        initialSection={menuInitialSection}
        sharedListId={sharedListId}
        onCreateAccount={handleCreateAccount}
        onLogin={handleLogin}
        emailDialogOpen={emailDialogOpen}
        emailDialogTab={emailDialogTab}
        onEmailDialogClose={closeEmailDialog}
      />
      </Suspense>
    </Box>
  );
}
