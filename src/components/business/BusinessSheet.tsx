import { useState, useEffect } from 'react';
import { SwipeableDrawer, Box, Tooltip } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useSelection } from '../../context/SelectionContext';
import { STORAGE_KEY_DRAG_HANDLE_SEEN } from '../../constants/storage';
import BusinessSheetCompactContent from './BusinessSheetCompactContent';

function DragHandle({ onClose, showTooltip }: { onClose: () => void; showTooltip: boolean }) {
  return (
    <Tooltip
      title="Arrastrá hacia arriba para ver más"
      open={showTooltip}
      arrow
      placement="top"
    >
      <Box
        role="button"
        aria-label="Cerrar detalles"
        onClick={onClose}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: 'text.secondary',
            opacity: 0.5,
          }}
        />
        <KeyboardArrowUpIcon
          sx={{
            fontSize: 20,
            color: 'text.secondary',
            opacity: 0.6,
            mt: 0.25,
            animation: 'pulseUp 1.5s ease-in-out infinite',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            '@keyframes pulseUp': {
              '0%, 100%': { transform: 'translateY(0)', opacity: 0.6 },
              '50%': { transform: 'translateY(-3px)', opacity: 1 },
            },
          }}
        />
      </Box>
    </Tooltip>
  );
}

export default function BusinessSheet() {
  const { selectedBusiness, setSelectedBusiness } = useSelection();
  const isOpen = selectedBusiness !== null;
  const [showTooltip, setShowTooltip] = useState(() => !localStorage.getItem(STORAGE_KEY_DRAG_HANDLE_SEEN));

  useEffect(() => {
    if (showTooltip && isOpen) {
      const timer = setTimeout(() => {
        setShowTooltip(false);
        localStorage.setItem(STORAGE_KEY_DRAG_HANDLE_SEEN, '1');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip, isOpen]);

  const handleClose = () => setSelectedBusiness(null);
  const handleOpen = () => {};

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      disableSwipeToOpen
      swipeAreaWidth={0}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '50dvh',
          overflow: 'hidden',
        },
        role: 'dialog' as const,
        'aria-label': selectedBusiness ? `Detalle de ${selectedBusiness.name}` : undefined,
      }}
    >
      {selectedBusiness && (
        <Box sx={{ overflow: 'auto', maxHeight: '50dvh', pb: 'calc(24px + env(safe-area-inset-bottom))', bgcolor: 'background.paper' }}>
          <DragHandle onClose={handleClose} showTooltip={showTooltip && isOpen} />
          <BusinessSheetCompactContent key={selectedBusiness.id} business={selectedBusiness} />
        </Box>
      )}
    </SwipeableDrawer>
  );
}
