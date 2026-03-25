import { useCallback, useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Switch,
  Chip,
  Typography,
  Collapse,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../context/ToastContext';
import AdminPanelWrapper from './AdminPanelWrapper';
import StatCard from './StatCard';
import { TopList } from '../stats';
import { fetchListStats, fetchTopLists } from '../../services/admin';
import type { ListStats } from '../../types/admin';
import { fetchListItems } from '../../services/sharedLists';
import { allBusinesses } from '../../hooks/useBusinesses';
import { CATEGORY_LABELS } from '../../types';
import type { SharedList, ListItem as ListItemType } from '../../types';

const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || undefined;

const toggleFeatured = httpsCallable<
  { listId: string; featured: boolean; databaseId?: string },
  { success: boolean }
>(functions, 'toggleFeaturedList');

const getPublicListsFn = httpsCallable<
  { databaseId?: string },
  { lists: SharedList[] }
>(functions, 'getPublicLists');

async function fetchPublicLists(): Promise<SharedList[]> {
  const result = await getPublicListsFn({ databaseId });
  return result.data.lists.map((l) => ({
    ...l,
    createdAt: new Date(),
    updatedAt: new Date(),
    editorIds: l.editorIds ?? [],
  }));
}

function ListStatsSection() {
  const statsFetcher = useCallback(async () => {
    const [stats, topLists] = await Promise.all([
      fetchListStats(),
      fetchTopLists(10),
    ]);
    return { stats, topLists };
  }, []);

  const { data, loading, error } = useAsyncData(statsFetcher);
  const stats = data?.stats;
  const topLists = data?.topLists ?? [];

  if (loading || error || !stats) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Estadisticas de Listas</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Total listas" value={stats.totalLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Publicas" value={stats.publicLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Privadas" value={stats.privateLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Colaborativas" value={stats.collaborativeLists} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Total items" value={stats.totalItems} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label="Prom. items/lista" value={stats.avgItemsPerList} />
        </Grid>
      </Grid>
      {topLists.length > 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TopList
              title="Top 10 — Listas mas grandes"
              items={topLists.map((l) => ({
                label: `${l.name}${l.isPublic ? '' : ' (privada)'}`,
                value: l.itemCount,
                secondary: `Owner: ${l.ownerId.slice(0, 8)}...`,
              }))}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default function FeaturedListsPanel() {
  const fetcher = useCallback(() => fetchPublicLists(), []);
  const { data, loading, error, refetch } = useAsyncData(fetcher);
  const toast = useToast();
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Map<string, ListItemType[]>>(new Map());
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  const handleToggle = async (list: SharedList) => {
    setToggling(list.id);
    try {
      await toggleFeatured({ listId: list.id, featured: !list.featured, databaseId });
      toast.success(list.featured ? 'Quitada de destacadas' : 'Marcada como destacada');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
    setToggling(null);
  };

  const handleToggleExpand = async (listId: string) => {
    if (expandedId === listId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(listId);
    if (!expandedItems.has(listId)) {
      setLoadingItems(listId);
      try {
        const items = await fetchListItems(listId);
        setExpandedItems((prev) => new Map(prev).set(listId, items));
      } catch {
        /* ignore */
      }
      setLoadingItems(null);
    }
  };

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando listas.">
      <ListStatsSection />
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
          {data.map((list) => {
            const isExpanded = expandedId === list.id;
            const items = expandedItems.get(list.id) ?? [];
            return (
              <Box key={list.id}>
                <ListItem
                  disablePadding
                  secondaryAction={
                    <Switch
                      edge="end"
                      checked={list.featured}
                      onChange={() => handleToggle(list)}
                      disabled={toggling === list.id}
                    />
                  }
                >
                  <ListItemButton onClick={() => handleToggleExpand(list.id)} sx={{ pr: 8 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {list.name}
                          {list.featured && <Chip label="Destacada" size="small" color="primary" />}
                          {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </Box>
                      }
                      secondary={`${list.itemCount} comercios · Owner: ${list.ownerId.slice(0, 8)}…`}
                    />
                  </ListItemButton>
                </ListItem>

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 4, pr: 2, pb: 1 }}>
                    {loadingItems === list.id ? (
                      <Box sx={{ py: 1, textAlign: 'center' }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : items.length === 0 ? (
                      <Typography variant="caption" color="text.secondary" sx={{ py: 1, display: 'block' }}>
                        Lista vacía.
                      </Typography>
                    ) : (
                      <List disablePadding dense>
                        {items.map((item) => {
                          const business = allBusinesses.find((b) => b.id === item.businessId);
                          if (!business) return null;
                          return (
                            <ListItem key={item.id} disablePadding>
                              <ListItemText
                                primary={business.name}
                                secondary={`${CATEGORY_LABELS[business.category]} · ${business.address}`}
                                primaryTypographyProps={{ fontSize: '0.85rem' }}
                                secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                sx={{ pl: 1, py: 0.5 }}
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </List>
      )}
    </AdminPanelWrapper>
  );
}
