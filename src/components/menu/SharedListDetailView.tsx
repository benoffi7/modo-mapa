import { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { copyList } from '../../services/sharedLists';
import { addFavoritesBatch, addFavorite, removeFavorite, fetchUserFavoriteIds } from '../../services/favorites';
import { allBusinesses } from '../../hooks/useBusinesses';
import { CATEGORY_LABELS } from '../../types';
import type { SharedList, ListItem, Business } from '../../types';

interface Props {
  list: SharedList;
  items: ListItem[];
  loading: boolean;
  sharedListId?: string | undefined;
  onSelectBusiness: (business: Business, fromListId?: string) => void;
  onCopyComplete: () => void;
}

export default function SharedListDetailView({ list, items, loading, sharedListId, onSelectBusiness, onCopyComplete }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [isAddingFavs, setIsAddingFavs] = useState(false);
  const [userFavIds, setUserFavIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    fetchUserFavoriteIds(user.uid).then((ids) => {
      if (!ignore) setUserFavIds(new Set(ids));
    }).catch((err) => console.error('[SharedListDetailView] load favorites failed:', err));
    return () => { ignore = true; };
  }, [user]);

  const handleToggleFavorite = async (businessId: string) => {
    if (!user) return;
    const isFav = userFavIds.has(businessId);
    try {
      if (isFav) {
        await removeFavorite(user.uid, businessId);
        setUserFavIds((prev) => { const next = new Set(prev); next.delete(businessId); return next; });
      } else {
        await addFavorite(user.uid, businessId);
        setUserFavIds((prev) => new Set(prev).add(businessId));
      }
    } catch {
      toast.error('Error al actualizar favorito');
    }
  };

  const handleCopyList = async () => {
    if (!user) return;
    setIsCopying(true);
    try {
      await copyList(list.id, user.uid);
      toast.success('Lista copiada a Mis Listas');
      onCopyComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo copiar');
    }
    setIsCopying(false);
  };

  const handleAddAllFavorites = async () => {
    if (!user) return;
    setIsAddingFavs(true);
    try {
      const bizIds = items.map((i) => i.businessId);
      const added = await addFavoritesBatch(user.uid, bizIds);
      toast.success(added > 0
        ? `${added} favorito${added !== 1 ? 's' : ''} agregado${added !== 1 ? 's' : ''}`
        : 'Ya tenés todos como favoritos');
    } catch {
      toast.error('Error al agregar favoritos');
    }
    setIsAddingFavs(false);
  };

  if (loading) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        {list.name}
      </Typography>
      {list.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {list.description}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label={`${items.length} comercio${items.length !== 1 ? 's' : ''}`} size="small" />
        {user && list.ownerId !== user.uid && (
          <Button
            size="small"
            startIcon={isCopying ? <CircularProgress size={14} /> : <ContentCopyIcon />}
            onClick={handleCopyList}
            disabled={isCopying}
          >
            Copiar lista
          </Button>
        )}
        {items.length > 0 && (
          <Button
            size="small"
            startIcon={isAddingFavs ? <CircularProgress size={14} /> : <FavoriteIcon />}
            onClick={handleAddAllFavorites}
            disabled={isAddingFavs}
          >
            Marcar todos como favoritos
          </Button>
        )}
      </Box>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Lista vacía.</Typography>
      ) : (
        <List disablePadding dense>
          {items.map((item) => {
            const business = allBusinesses.find((b) => b.id === item.businessId);
            if (!business) return null;
            return (
              <ListItemButton key={item.id} onClick={() => onSelectBusiness(business, sharedListId)} sx={{ borderRadius: 1 }}>
                <ListItemText
                  primary={business.name}
                  secondary={`${CATEGORY_LABELS[business.category]} · ${business.address}`}
                  primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
                {user && (
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.businessId); }}
                    sx={{ color: userFavIds.has(item.businessId) ? 'error.main' : 'action.disabled' }}
                    aria-label={userFavIds.has(item.businessId) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    {userFavIds.has(item.businessId) ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                  </IconButton>
                )}
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}
