import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, Toolbar, Divider,
  CircularProgress, Chip, Dialog, DialogTitle, DialogActions, Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import ShareIcon from '@mui/icons-material/Share';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Badge } from '@mui/material';
import ColorPicker, { sanitizeListColor } from './ColorPicker';
import EditorsDialog from './EditorsDialog';
import InviteEditorDialog from './InviteEditorDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchListItems, fetchSharedList, removeBusinessFromList, toggleListPublic, deleteList, updateList } from '../../services/sharedLists';
import { logger } from '../../utils/logger';
import { allBusinesses } from '../../hooks/useBusinesses';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { CATEGORY_LABELS } from '../../constants/business';
import { cardSx } from '../../theme/cards';
import { MSG_LIST } from '../../constants/messages';
import type { SharedList, ListItem, BusinessCategory } from '../../types';

interface Props {
  list: SharedList;
  onBack: (updated?: Partial<SharedList>) => void;
  onDeleted: () => void;
  readOnly?: boolean;
}

export default function ListDetailScreen({ list, onBack, onDeleted, readOnly }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.uid === list.ownerId;
  const canEditConfig = isOwner && !readOnly;
  const [editorIds, setEditorIds] = useState(list.editorIds ?? []);
  const isEditor = !isOwner && !!user && editorIds.includes(user.uid);
  const canEditItems = (isOwner || isEditor) && !readOnly;
  const { navigateToBusiness } = useNavigateToBusiness();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState(() => sanitizeListColor(list.color));
  const [isPublic, setIsPublic] = useState(list.isPublic);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editorsOpen, setEditorsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchListItems(list.id));
    } finally {
      setLoading(false);
    }
  }, [list.id]);

  useEffect(() => { load(); }, [load]);

  const handleColorChange = async (hex: string) => {
    setCurrentColor(hex);
    try {
      await updateList(list.id, list.name, list.description, hex);
    } catch {
      toast.error(MSG_LIST.colorError);
    }
  };

  const handleTogglePublic = async () => {
    const prev = isPublic;
    const newValue = !prev;
    setIsPublic(newValue);
    try {
      await toggleListPublic(list.id, newValue);
      toast.success(newValue ? MSG_LIST.visibilityPublic : MSG_LIST.visibilityPrivate);
    } catch {
      setIsPublic(prev);
      toast.error(MSG_LIST.visibilityError);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/?list=${list.id}`;
    if (navigator.share) {
      navigator.share({ title: list.name, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success(MSG_LIST.linkCopied);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteList(list.id, list.ownerId);
      toast.success(MSG_LIST.deleteSuccess);
      onDeleted();
    } catch {
      toast.error(MSG_LIST.deleteError);
    }
    setConfirmDeleteOpen(false);
  };

  const handleRemoveItem = async (item: ListItem) => {
    await removeBusinessFromList(list.id, item.businessId);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.success(MSG_LIST.itemRemoved);
  };

  const handleEditorsChanged = async () => {
    try {
      const result = await fetchSharedList(list.id);
      if (result) setEditorIds(result.editorIds ?? []);
    } catch (err) {
      logger.warn('Failed to refetch editorIds', err);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={() => onBack({
          id: list.id, color: currentColor, itemCount: items.length, isPublic, editorIds,
        })}><ArrowBackIcon /></IconButton>
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }} noWrap>{list.name}</Typography>
        {canEditConfig && (
          <>
            <IconButton size="small" onClick={() => setColorPickerOpen(true)}>
              <PaletteOutlinedIcon fontSize="small" sx={{ color: currentColor }} />
            </IconButton>
            <IconButton size="small" onClick={handleTogglePublic}>
              {isPublic ? <PublicIcon fontSize="small" color="success" /> : <LockIcon fontSize="small" />}
            </IconButton>
            {isPublic && (
              <IconButton size="small" onClick={handleShare}><ShareIcon fontSize="small" /></IconButton>
            )}
            <IconButton size="small" onClick={() => setEditorsOpen(true)}>
              <Badge badgeContent={editorIds.length} color="primary" invisible={editorIds.length === 0}>
                <GroupIcon fontSize="small" />
              </Badge>
            </IconButton>
            <IconButton size="small" onClick={() => setInviteOpen(true)}>
              <PersonAddIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => setConfirmDeleteOpen(true)}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </>
        )}
      </Toolbar>
      <Divider />

      {list.description && list.description !== list.name && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" color="text.secondary">{list.description}</Typography>
        </Box>
      )}

      <Box sx={{ px: 2, py: 0.5, mt: 0.5 }}>
        <Chip
          size="small"
          label={isPublic ? 'Pública' : 'Privada'}
          icon={isPublic ? <PublicIcon /> : <LockIcon />}
          variant="outlined"
          sx={{ borderRadius: 1, px: 1 }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Lista vacía</Typography>
            <Typography variant="caption" color="text.disabled">Agrega comercios desde el mapa</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 2, py: 1 }}>
            {items.map((item) => {
              const biz = allBusinesses.find((b) => b.id === item.businessId);
              if (!biz) return null;
              return (
                <Box
                  key={item.id}
                  onClick={() => navigateToBusiness(biz)}
                  sx={cardSx}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} noWrap>{biz.name}</Typography>
                      <Typography variant="caption" color="primary.main">
                        {CATEGORY_LABELS[biz.category as BusinessCategory] ?? biz.category}
                      </Typography>
                    </Box>
                    {canEditItems && (
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleRemoveItem(item); }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <ColorPicker
        open={colorPickerOpen}
        onClose={() => setColorPickerOpen(false)}
        onSelect={handleColorChange}
        selectedHex={currentColor}
      />

      <EditorsDialog
        open={editorsOpen}
        onClose={() => setEditorsOpen(false)}
        listId={list.id}
        editorIds={editorIds}
        onEditorRemoved={handleEditorsChanged}
      />

      <InviteEditorDialog
        listId={inviteOpen ? list.id : null}
        onClose={() => setInviteOpen(false)}
        onInvited={handleEditorsChanged}
      />

      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>&iquest;Eliminar lista &ldquo;{list.name}&rdquo;?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
