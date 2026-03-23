import { useState, useMemo, memo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConnectivity } from '../../hooks/useConnectivity';
import { addUserTag, removeUserTag, createCustomTag, updateCustomTag, deleteCustomTag } from '../../services/tags';
import { withOfflineSupport } from '../../services/offlineInterceptor';
import { PREDEFINED_TAGS } from '../../types';
import { MAX_CUSTOM_TAGS_PER_BUSINESS } from '../../constants/validation';
import type { CustomTag, UserTag } from '../../types';
import CustomTagDialog from './CustomTagDialog';
import DeleteTagDialog from './DeleteTagDialog';

interface Props {
  businessId: string;
  businessName?: string;
  seedTags: string[];
  userTags: UserTag[];
  customTags: CustomTag[];
  isLoading: boolean;
  onTagsChange: () => void;
}

interface TagCount {
  tagId: string;
  count: number;
  userAdded: boolean;
}

export default memo(function BusinessTags({ businessId, businessName, seedTags, userTags, customTags, isLoading, onTagsChange }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [dialogValue, setDialogValue] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTag, setMenuTag] = useState<CustomTag | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);

  const tagCounts = useMemo<TagCount[]>(() => {
    const counts: Record<string, { count: number; userAdded: boolean }> = {};
    seedTags.forEach((tagId) => {
      counts[tagId] = { count: 0, userAdded: false };
    });
    userTags.forEach((ut) => {
      if (!counts[ut.tagId]) {
        counts[ut.tagId] = { count: 0, userAdded: false };
      }
      counts[ut.tagId].count++;
      if (user && ut.userId === user.uid) {
        counts[ut.tagId].userAdded = true;
      }
    });
    return Object.entries(counts).map(([tagId, { count, userAdded }]) => ({
      tagId,
      count,
      userAdded,
    }));
  }, [seedTags, userTags, user]);

  const handleToggleTag = async (tagId: string) => {
    if (!user) return;
    setPendingTagId(tagId);
    const existing = tagCounts.find((t) => t.tagId === tagId);
    try {
      if (existing?.userAdded) {
        await withOfflineSupport(
          isOffline, 'tag_remove',
          { userId: user.uid, businessId, businessName },
          { tagId },
          () => removeUserTag(user.uid, businessId, tagId),
          toast,
        );
      } else {
        await withOfflineSupport(
          isOffline, 'tag_add',
          { userId: user.uid, businessId, businessName },
          { tagId },
          () => addUserTag(user.uid, businessId, tagId),
          toast,
        );
      }
      onTagsChange();
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error toggling tag:', err);
    }
    setPendingTagId(null);
  };

  // ── Dialog handlers ───────────────────────────────────────────────────

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingTag(null);
    setDialogValue('');
  }, []);

  const handleOpenCreateDialog = () => {
    setEditingTag(null);
    setDialogValue('');
    setDialogOpen(true);
  };

  const handleOpenEditDialog = () => {
    if (!menuTag) return;
    setEditingTag(menuTag);
    setDialogValue(menuTag.label);
    setMenuAnchor(null);
    setMenuTag(null);
    setDialogOpen(true);
  };

  const handleSaveCustomTag = useCallback(async () => {
    if (!user) return;
    const label = dialogValue.trim();
    if (!label || label.length > 30) return;
    if (!editingTag && customTags.length >= MAX_CUSTOM_TAGS_PER_BUSINESS) return;

    if (editingTag) {
      await updateCustomTag(editingTag.id, label);
    } else {
      await createCustomTag(user.uid, businessId, label);
    }
    handleCloseDialog();
    onTagsChange();
  }, [user, dialogValue, editingTag, customTags.length, businessId, onTagsChange, handleCloseDialog]);

  const handleOpenDeleteConfirm = () => {
    setMenuAnchor(null);
    setConfirmDeleteOpen(true);
  };

  const handleDelete = useCallback(async () => {
    if (!menuTag) return;
    await deleteCustomTag(menuTag.id);
    setConfirmDeleteOpen(false);
    setMenuTag(null);
    onTagsChange();
  }, [menuTag, onTagsChange]);

  const handleCustomTagClick = (event: React.MouseEvent<HTMLElement>, tag: CustomTag) => {
    setMenuAnchor(event.currentTarget);
    setMenuTag(tag);
  };

  if (isLoading) return null;

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Etiquetas
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {PREDEFINED_TAGS.map((tag) => {
          const tagData = tagCounts.find((t) => t.tagId === tag.id);
          const isSeed = seedTags.includes(tag.id);
          const count = tagData?.count || 0;
          const userAdded = tagData?.userAdded || false;
          const isVisible = isSeed || count > 0;

          if (!isVisible && !user) return null;

          return (
            <Chip
              key={tag.id}
              label={`${tag.label}${count > 0 ? ` (${count})` : ''}`}
              size="small"
              icon={userAdded ? <CheckIcon fontSize="small" /> : <AddIcon fontSize="small" />}
              onClick={() => handleToggleTag(tag.id)}
              disabled={pendingTagId === tag.id}
              variant={isSeed || userAdded ? 'filled' : 'outlined'}
              color={userAdded ? 'primary' : 'default'}
              sx={{ opacity: isVisible ? 1 : 0.6 }}
            />
          );
        })}

        {customTags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.label}
            size="small"
            icon={<LabelOutlinedIcon fontSize="small" />}
            onClick={(e) => handleCustomTagClick(e, tag)}
            variant="outlined"
            color="secondary"
          />
        ))}

        {user && customTags.length < MAX_CUSTOM_TAGS_PER_BUSINESS && (
          <Chip
            label="Agregar"
            size="small"
            icon={<AddIcon fontSize="small" />}
            onClick={handleOpenCreateDialog}
            variant="outlined"
            sx={{ borderStyle: 'dashed' }}
          />
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => { setMenuAnchor(null); setMenuTag(null); }}
      >
        <MenuItem onClick={handleOpenEditDialog}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Editar
        </MenuItem>
        <MenuItem onClick={handleOpenDeleteConfirm}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Eliminar
        </MenuItem>
      </Menu>

      <CustomTagDialog
        open={dialogOpen}
        isEditing={editingTag !== null}
        value={dialogValue}
        onChange={setDialogValue}
        onSave={handleSaveCustomTag}
        onClose={handleCloseDialog}
      />

      <DeleteTagDialog
        open={confirmDeleteOpen}
        tagLabel={menuTag?.label}
        onConfirm={handleDelete}
        onClose={() => { setConfirmDeleteOpen(false); setMenuTag(null); }}
      />
    </Box>
  );
});
