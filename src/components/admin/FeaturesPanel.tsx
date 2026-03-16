import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import CasinoIcon from '@mui/icons-material/Casino';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchDailyMetrics, fetchCounters } from '../../services/admin';
import AdminPanelWrapper from './AdminPanelWrapper';
import type { ReactElement } from 'react';
import type { AdminCounters, DailyMetrics } from '../../types/admin';

interface FeatureCard {
  name: string;
  icon: ReactElement;
  getValue: (counters: AdminCounters) => number;
  getTrend: (metrics: DailyMetrics[]) => { today: number; yesterday: number };
  color: string;
}

function getWritesByDay(metrics: DailyMetrics[], field: keyof AdminCounters): { today: number; yesterday: number } {
  // dailyMetrics are sorted desc (newest first)
  const todayMetrics = metrics[0] as Record<string, unknown> | undefined;
  const yesterdayMetrics = metrics[1] as Record<string, unknown> | undefined;

  // Use writesByCollection if available, otherwise estimate from counters delta
  const todayWrites = (todayMetrics?.writesByCollection as Record<string, number> | undefined)?.[field] ?? 0;
  const yesterdayWrites = (yesterdayMetrics?.writesByCollection as Record<string, number> | undefined)?.[field] ?? 0;

  return { today: todayWrites, yesterday: yesterdayWrites };
}

const FEATURES: FeatureCard[] = [
  {
    name: 'Calificaciones',
    icon: <StarOutlineIcon />,
    getValue: (c) => c.ratings,
    getTrend: (m) => getWritesByDay(m, 'ratings'),
    color: '#FFC107',
  },
  {
    name: 'Comentarios',
    icon: <ChatBubbleOutlineIcon />,
    getValue: (c) => c.comments,
    getTrend: (m) => getWritesByDay(m, 'comments'),
    color: '#2196F3',
  },
  {
    name: 'Likes',
    icon: <ThumbUpOutlinedIcon />,
    getValue: (c) => c.commentLikes,
    getTrend: (m) => getWritesByDay(m, 'commentLikes'),
    color: '#E91E63',
  },
  {
    name: 'Favoritos',
    icon: <FavoriteIcon />,
    getValue: (c) => c.favorites,
    getTrend: (m) => getWritesByDay(m, 'favorites'),
    color: '#F44336',
  },
  {
    name: 'Tags',
    icon: <LabelOutlinedIcon />,
    getValue: (c) => c.customTags + c.userTags,
    getTrend: (m) => getWritesByDay(m, 'customTags'),
    color: '#9C27B0',
  },
  {
    name: 'Feedback',
    icon: <FeedbackOutlinedIcon />,
    getValue: (c) => c.feedback,
    getTrend: (m) => getWritesByDay(m, 'feedback'),
    color: '#4CAF50',
  },
];

// Features that don't have server-side counters but exist as trackEvent
const FEATURE_LABELS: { name: string; icon: ReactElement; description: string }[] = [
  { name: 'Sorpréndeme', icon: <CasinoIcon />, description: 'Evento: surprise_me' },
  { name: 'Listas', icon: <BookmarkBorderIcon />, description: 'Eventos: list_created, list_item_added' },
  { name: 'Búsqueda', icon: <SearchIcon />, description: 'Evento: business_search' },
  { name: 'Compartir', icon: <ShareIcon />, description: 'Evento: business_share' },
  { name: 'Fotos', icon: <CameraAltOutlinedIcon />, description: 'Evento: menu_photo_upload' },
  { name: 'Dark Mode', icon: <DarkModeOutlinedIcon />, description: 'Evento: dark_mode_toggle' },
];

function TrendIcon({ today, yesterday }: { today: number; yesterday: number }) {
  if (today > yesterday) return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
  if (today < yesterday) return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
  return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
}

interface FetchResult {
  counters: AdminCounters | null;
  dailyMetrics: DailyMetrics[];
}

export default function FeaturesPanel() {
  const fetcher = useCallback(async (): Promise<FetchResult> => {
    const [counters, dailyMetrics] = await Promise.all([
      fetchCounters(),
      fetchDailyMetrics('desc', 7),
    ]);
    return { counters, dailyMetrics };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const activeUsers = useMemo(() => {
    if (!data?.dailyMetrics.length) return 0;
    return (data.dailyMetrics[0] as unknown as Record<string, number>).activeUsers ?? 0;
  }, [data]);

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando métricas de features.">
      {data?.counters && (
        <>
          {/* Summary */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Chip label={`${data.counters.users} usuarios`} />
            <Chip label={`${activeUsers} activos hoy`} color="primary" />
            <Chip label={`${data.dailyMetrics[0]?.dailyWrites ?? 0} escrituras hoy`} variant="outlined" />
          </Box>

          {/* Feature cards with counters */}
          <Typography variant="h6" gutterBottom>Métricas por funcionalidad</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {FEATURES.map((feature) => {
              const total = feature.getValue(data.counters!);
              const trend = feature.getTrend(data.dailyMetrics);
              return (
                <Grid key={feature.name} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined" sx={{ borderLeft: `4px solid ${feature.color}` }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ color: feature.color }}>{feature.icon}</Box>
                        <Typography variant="subtitle2">{feature.name}</Typography>
                        {(trend.today > 0 || trend.yesterday > 0) && (
                          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TrendIcon today={trend.today} yesterday={trend.yesterday} />
                          </Box>
                        )}
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {total.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        total acumulado
                        {trend.today > 0 && ` · ${trend.today} hoy`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Analytics-only features (no server counters yet) */}
          <Typography variant="h6" gutterBottom>Features sin métricas server-side</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Estos features solo se trackean via Firebase Analytics (GA4). Para verlos acá, necesitan agregación en dailyMetrics.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {FEATURE_LABELS.map((feature) => (
              <Grid key={feature.name} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined" sx={{ opacity: 0.7 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {feature.icon}
                      <Typography variant="subtitle2">{feature.name}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {feature.description}
                    </Typography>
                    <Chip label="Solo GA4" size="small" variant="outlined" sx={{ mt: 0.5, display: 'flex', width: 'fit-content' }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Adoption funnel */}
          <Typography variant="h6" gutterBottom>Adopción</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{data.counters.users}</Typography>
                  <Typography variant="body2" color="text.secondary">Usuarios totales</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{activeUsers}</Typography>
                  <Typography variant="body2" color="text.secondary">Activos hoy</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {data.counters.users > 0 ? Math.round((activeUsers / data.counters.users) * 100) : 0}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Tasa de actividad</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </AdminPanelWrapper>
  );
}
