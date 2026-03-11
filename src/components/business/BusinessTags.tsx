import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { PREDEFINED_TAGS } from '../../types';
import type { CustomTag } from '../../types';

interface Props {
  businessId: string;
  seedTags: string[];
}

interface TagCount {
  tagId: string;
  count: number;
  userAdded: boolean;
}

export default function BusinessTags({ businessId, seedTags }: Props) {
  const { user } = useAuth();
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [dialogValue, setDialogValue] = useState('');

  // Context menu state
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTag, setMenuTag] = useState<CustomTag | null>(null);

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadTags = useCallback(async () => {
    const q = query(collection(db, 'userTags'), where('businessId', '==', businessId));
    const snapshot = await getDocs(q);

    const counts: Record<string, { count: number; userAdded: boolean }> = {};

    // Init with seed tags
    seedTags.forEach((tagId) => {
      counts[tagId] = { count: 0, userAdded: false };
    });

    snapshot.forEach((d) => {
      const data = d.data();
      if (!counts[data.tagId]) {
        counts[data.tagId] = { count: 0, userAdded: false };
      }
      counts[data.tagId].count++;
      if (user && data.userId === user.uid) {
        counts[data.tagId].userAdded = true;
      }
    });

    setTagCounts(
      Object.entries(counts).map(([tagId, { count, userAdded }]) => ({
        tagId,
        count,
        userAdded,
      }))
    );
  }, [businessId, seedTags, user]);

  const loadCustomTags = useCallback(async () => {
    if (!user) {
      setCustomTags([]);
      return;
    }
    const q = query(
      collection(db, 'customTags'),
      where('userId', '==', user.uid),
      where('businessId', '==', businessId)
    );
    try {
      const snapshot = await getDocs(q);
      const loaded: CustomTag[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      })) as CustomTag[];
      loaded.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setCustomTags(loaded);
    } catch (error) {
      console.error('Error loading custom tags:', error);
      setCustomTags([]);
    }
  }, [businessId, user]);

  useEffect(() => {
    loadTags();
    loadCustomTags();
  }, [loadTags, loadCustomTags]);

  const handleToggleTag = async (tagId: string) => {
    if (!user) return;
    const docId = `${user.uid}__${businessId}__${tagId}`;
    const tagRef = doc(db, 'userTags', docId);

    const existing = tagCounts.find((t) => t.tagId === tagId);
    if (existing?.userAdded) {
      await deleteDoc(tagRef);
    } else {
      await setDoc(tagRef, {
        userId: user.uid,
        businessId,
        tagId,
        createdAt: serverTimestamp(),
      });
    }
    loadTags();
  };

  // Custom tag handlers
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

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTag(null);
    setDialogValue('');
  };

  const handleSaveCustomTag = async () => {
    if (!user) return;
    const label = dialogValue.trim();
    if (!label || label.length > 30) return;

    if (editingTag) {
      await updateDoc(doc(db, 'customTags', editingTag.id), { label });
      setCustomTags((prev) =>
        prev.map((t) => (t.id === editingTag.id ? { ...t, label } : t))
      );
    } else {
      const docRef = await addDoc(collection(db, 'customTags'), {
        userId: user.uid,
        businessId,
        label,
        createdAt: serverTimestamp(),
      });
      setCustomTags((prev) => [
        ...prev,
        { id: docRef.id, userId: user.uid, businessId, label, createdAt: new Date() },
      ]);
    }
    handleCloseDialog();
  };

  const handleOpenDeleteConfirm = () => {
    setMenuAnchor(null);
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!menuTag) return;
    await deleteDoc(doc(db, 'customTags', menuTag.id));
    setCustomTags((prev) => prev.filter((t) => t.id !== menuTag.id));
    setConfirmDeleteOpen(false);
    setMenuTag(null);
  };

  const handleCustomTagClick = (event: React.MouseEvent<HTMLElement>, tag: CustomTag) => {
    setMenuAnchor(event.currentTarget);
    setMenuTag(tag);
  };

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Etiquetas
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {/* Predefined tags */}
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
              variant={isSeed || userAdded ? 'filled' : 'outlined'}
              color={userAdded ? 'primary' : 'default'}
              sx={{
                opacity: isVisible ? 1 : 0.6,
              }}
            />
          );
        })}

        {/* Custom tags */}
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

        {/* Add custom tag button */}
        {user && (
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

      {/* Context menu for custom tags */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setMenuTag(null);
        }}
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

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingTag ? 'Editar etiqueta' : 'Agregar etiqueta'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Ej: Tiene estacionamiento"
            value={dialogValue}
            onChange={(e) => setDialogValue(e.target.value.slice(0, 30))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveCustomTag();
              }
            }}
            helperText={`${dialogValue.length}/30`}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            onClick={handleSaveCustomTag}
            variant="contained"
            disabled={!dialogValue.trim()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Eliminar etiqueta</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar etiqueta &ldquo;{menuTag?.label}&rdquo;?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmDeleteOpen(false); setMenuTag(null); }}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
