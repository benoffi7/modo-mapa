import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { moderateComment, moderateRating, moderateCustomTag } from '../../services/admin';
import { MODERATION_TARGET_LABELS } from '../../constants/admin';
import { MSG_ADMIN } from '../../constants/messages/admin';
import type { ModerationAction, ModerationTargetCollection } from '../../types/admin';

interface ModerationActionsProps {
  itemId: string;
  targetCollection: ModerationTargetCollection;
  allowHide?: boolean;
  emphasized?: boolean;
  onDeleted?: (id: string) => void;
  onHidden?: (id: string) => void;
}

export default function ModerationActions({
  itemId,
  targetCollection,
  allowHide = false,
  emphasized = false,
  onDeleted,
  onHidden,
}: ModerationActionsProps) {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ModerationAction | null>(null);
  const toast = useToast();
  const { isOffline } = useConnectivity();

  const targetLabel = MODERATION_TARGET_LABELS[targetCollection];

  const handleConfirm = async () => {
    if (!confirmAction) return;
    
    setLoading(true);
    try {
      if (targetCollection === 'comments') {
        await moderateComment(itemId, confirmAction);
      } else if (targetCollection === 'ratings' && confirmAction === 'delete') {
        await moderateRating(itemId);
      } else if (targetCollection === 'customTags' && confirmAction === 'delete') {
        await moderateCustomTag(itemId);
      }

      const successMsg = confirmAction === 'delete' 
        ? MSG_ADMIN.moderateDeleteSuccess(targetLabel)
        : MSG_ADMIN.moderateHideSuccess(targetLabel);
      
      toast.success(successMsg);
      
      if (confirmAction === 'delete') {
        onDeleted?.(itemId);
      } else {
        onHidden?.(itemId);
      }
    } catch (err) {
      console.error('Moderation error:', err);
      toast.error(MSG_ADMIN.moderateError);
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <>
      <Tooltip title="Eliminar">
        <span>
          <IconButton
            size="small"
            color={emphasized ? 'error' : 'default'}
            disabled={loading || isOffline}
            onClick={() => setConfirmAction('delete')}
          >
            <DeleteOutline fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      {allowHide && (
        <Tooltip title="Ocultar">
          <span>
            <IconButton
              size="small"
              disabled={loading || isOffline}
              onClick={() => setConfirmAction('hide')}
            >
              <VisibilityOff fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}

      <Dialog
        open={confirmAction !== null}
        onClose={() => !loading && setConfirmAction(null)}
        role="alertdialog"
      >
        <DialogTitle>
          {confirmAction === 'delete'
            ? MSG_ADMIN.moderateConfirmDeleteTitle
            : MSG_ADMIN.moderateConfirmHideTitle}
        </DialogTitle>
        <DialogContent>
          {confirmAction === 'delete'
            ? MSG_ADMIN.moderateConfirmDeleteBody(targetLabel.toLowerCase())
            : MSG_ADMIN.moderateConfirmHideBody(targetLabel.toLowerCase())}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            color={confirmAction === 'delete' ? 'error' : 'primary'}
            variant="contained"
            disabled={loading}
            startIcon={loading && <CircularProgress size={16} color="inherit" />}
          >
            {confirmAction === 'delete' ? 'Eliminar' : 'Ocultar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
