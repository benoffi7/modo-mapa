import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, Toolbar, Divider, List, ListItemButton,
  ListItemText, CircularProgress, Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import ShareIcon from '@mui/icons-material/Share';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fetchListItems, removeBusinessFromList, toggleListPublic, deleteList } from '../../services/sharedLists';
import { allBusinesses } from '../../hooks/useBusinesses';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { CATEGORY_LABELS } from '../../constants/business';
import type { SharedList, ListItem, BusinessCategory } from '../../types';

interface Props {
  list: SharedList;
  onBack: () => void;
  onDeleted: () => void;
  readOnly?: boolean;
}

export default function ListDetailScreen({ list, onBack, onDeleted, readOnly }: Props) {
  useAuth();
  const toast = useToast();
  const { navigateToBusiness } = useNavigateToBusiness();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchListItems(list.id));
    } finally {
      setLoading(false);
    }
  }, [list.id]);

  useEffect(() => { load(); }, [load]);

  const handleTogglePublic = async () => {
    await toggleListPublic(list.id, !list.isPublic);
    toast.success(list.isPublic ? 'Lista privada' : 'Lista publica');
  };

  const handleShare = () => {
    const url = `${window.location.origin}/?list=${list.id}`;
    if (navigator.share) {
      navigator.share({ title: list.name, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copiado');
    }
  };

  const handleDelete = async () => {
    await deleteList(list.id);
    toast.success('Lista eliminada');
    onDeleted();
  };

  const handleRemoveItem = async (item: ListItem) => {
    await removeBusinessFromList(list.id, item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast.success('Comercio removido');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar variant="dense" sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={onBack}><ArrowBackIcon /></IconButton>
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }} noWrap>{list.name}</Typography>
        {!readOnly && (
          <>
            <IconButton size="small" onClick={handleTogglePublic}>
              {list.isPublic ? <PublicIcon fontSize="small" color="success" /> : <LockIcon fontSize="small" />}
            </IconButton>
            {list.isPublic && (
              <IconButton size="small" onClick={handleShare}><ShareIcon fontSize="small" /></IconButton>
            )}
            <IconButton size="small" color="error" onClick={handleDelete}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </>
        )}
      </Toolbar>
      <Divider />

      {list.description && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" color="text.secondary">{list.description}</Typography>
        </Box>
      )}

      <Box sx={{ px: 2, py: 0.5 }}>
        <Chip
          size="small"
          label={list.isPublic ? 'Publica' : 'Privada'}
          icon={list.isPublic ? <PublicIcon /> : <LockIcon />}
          variant="outlined"
        />
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Lista vacia</Typography>
            <Typography variant="caption" color="text.disabled">Agrega comercios desde el mapa</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {items.map((item) => {
              const biz = allBusinesses.find((b) => b.id === item.businessId);
              if (!biz) return null;
              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => navigateToBusiness(biz)}
                  sx={{ py: 1 }}
                >
                  <ListItemText
                    primary={biz.name}
                    secondary={CATEGORY_LABELS[biz.category as BusinessCategory] ?? biz.category}
                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
                  />
                  {!readOnly && (
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(item); }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
}
