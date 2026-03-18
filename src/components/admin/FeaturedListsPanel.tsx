import { useCallback, useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  Switch,
  Chip,
  Typography,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../context/ToastContext';
import AdminPanelWrapper from './AdminPanelWrapper';
import { getDocs, query, where, collection, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { sharedListConverter } from '../../config/converters';
import type { SharedList } from '../../types';

const toggleFeatured = httpsCallable<{ listId: string; featured: boolean }, { success: boolean }>(
  functions,
  'toggleFeaturedList',
);

async function fetchPublicLists(): Promise<SharedList[]> {
  const snap = await getDocs(
    query(
      collection(db, 'sharedLists').withConverter(sharedListConverter),
      where('isPublic', '==', true),
      orderBy('updatedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export default function FeaturedListsPanel() {
  const fetcher = useCallback(() => fetchPublicLists(), []);
  const { data, loading, error, refetch } = useAsyncData(fetcher);
  const toast = useToast();
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (list: SharedList) => {
    setToggling(list.id);
    try {
      await toggleFeatured({ listId: list.id, featured: !list.featured });
      toast.success(list.featured ? 'Quitada de destacadas' : 'Marcada como destacada');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
    setToggling(null);
  };

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando listas.">
      <Typography variant="h6" sx={{ mb: 2 }}>
        <StarIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Listas Destacadas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Solo listas públicas pueden marcarse como destacadas. Las listas destacadas aparecen en la sección superior de "Mis Listas" para todos los usuarios.
      </Typography>

      {!data || data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No hay listas públicas.
        </Typography>
      ) : (
        <List>
          {data.map((list) => (
            <ListItem
              key={list.id}
              secondaryAction={
                <Switch
                  edge="end"
                  checked={list.featured}
                  onChange={() => handleToggle(list)}
                  disabled={toggling === list.id}
                />
              }
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {list.name}
                    {list.featured && <Chip label="Destacada" size="small" color="primary" />}
                  </Box>
                }
                secondary={`${list.itemCount} comercios · Owner: ${list.ownerId}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </AdminPanelWrapper>
  );
}
