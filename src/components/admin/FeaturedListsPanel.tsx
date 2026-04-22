import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../context/ToastContext';
import { MSG_ADMIN } from '../../constants/messages';
import AdminPanelWrapper from './AdminPanelWrapper';
import ListStatsSection from './ListStatsSection';
import { fetchListItems } from '../../services/sharedLists';
import { fetchPublicLists, toggleFeaturedList } from '../../services/adminFeatured';
import { getBusinessById } from '../../utils/businessMap';
import { CATEGORY_LABELS } from '../../constants/business';
import type { SharedList, ListItem as ListItemType } from '../../types';

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
      await toggleFeaturedList(list.id, !list.featured);
      toast.success(MSG_ADMIN.featuredToggleSuccess(list.featured));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MSG_ADMIN.featuredToggleError);
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
    <Box>
      <ListStatsSection />
      <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudieron cargar las listas destacadas.">
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
                          const business = getBusinessById(item.businessId);
                          if (!business) return null;
                          return (
                            <ListItem key={item.id} disablePadding>
                              <ListItemText
                                primary={business.name}
                                secondary={`${CATEGORY_LABELS[business.category]} · ${business.address}`}
                                slotProps={{
                                  primary: { sx: { fontSize: '0.85rem' } },
                                  secondary: { sx: { fontSize: '0.75rem' } },
                                }}
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
    </Box>
  );
}
