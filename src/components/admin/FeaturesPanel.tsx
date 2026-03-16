import { useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
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
import LineChartCard from './charts/LineChartCard';
import type { ReactElement } from 'react';
import type { AdminCounters, DailyMetrics } from '../../types/admin';

interface FeatureDef {
  key: string;
  name: string;
  icon: ReactElement;
  getValue: (counters: AdminCounters) => number;
  collectionKey: string;
  color: string;
}

const FEATURES: FeatureDef[] = [
  { key: 'ratings', name: 'Calificaciones', icon: <StarOutlineIcon />, getValue: (c) => c.ratings, collectionKey: 'ratings', color: '#FFC107' },
  { key: 'comments', name: 'Comentarios', icon: <ChatBubbleOutlineIcon />, getValue: (c) => c.comments, collectionKey: 'comments', color: '#2196F3' },
  { key: 'likes', name: 'Likes', icon: <ThumbUpOutlinedIcon />, getValue: (c) => c.commentLikes, collectionKey: 'commentLikes', color: '#E91E63' },
  { key: 'favorites', name: 'Favoritos', icon: <FavoriteIcon />, getValue: (c) => c.favorites, collectionKey: 'favorites', color: '#F44336' },
  { key: 'tags', name: 'Tags', icon: <LabelOutlinedIcon />, getValue: (c) => c.customTags + c.userTags, collectionKey: 'customTags', color: '#9C27B0' },
  { key: 'feedback', name: 'Feedback', icon: <FeedbackOutlinedIcon />, getValue: (c) => c.feedback, collectionKey: 'feedback', color: '#4CAF50' },
];

const GA4_FEATURES: { name: string; icon: ReactElement; description: string }[] = [
  { name: 'Sorpréndeme', icon: <CasinoIcon />, description: 'surprise_me' },
  { name: 'Listas', icon: <BookmarkBorderIcon />, description: 'list_created, list_item_added' },
  { name: 'Búsqueda', icon: <SearchIcon />, description: 'business_search' },
  { name: 'Compartir', icon: <ShareIcon />, description: 'business_share' },
  { name: 'Fotos', icon: <CameraAltOutlinedIcon />, description: 'menu_photo_upload' },
  { name: 'Dark Mode', icon: <DarkModeOutlinedIcon />, description: 'dark_mode_toggle' },
];

function TrendIcon({ today, yesterday }: { today: number; yesterday: number }) {
  if (today > yesterday) return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
  if (today < yesterday) return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
  return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
}

function buildFeatureTrend(metrics: DailyMetrics[], collectionKey: string): { date: string; value: number }[] {
  // metrics sorted desc, reverse for chart (oldest first)
  return [...metrics].reverse().map((m) => ({
    date: (m as unknown as { id?: string }).id ?? '',
    value: m.writesByCollection?.[collectionKey] ?? 0,
  }));
}

export default function FeaturesPanel() {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    const [counters, dailyMetrics] = await Promise.all([
      fetchCounters(),
      fetchDailyMetrics('desc', 30),
    ]);
    return { counters, dailyMetrics };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const activeUsers = useMemo(() => {
    if (!data?.dailyMetrics.length) return 0;
    return data.dailyMetrics[0].activeUsers ?? 0;
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

          {/* Feature cards */}
          <Typography variant="h6" gutterBottom>Métricas por funcionalidad</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tocá una card para ver el gráfico de los últimos 30 días.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {FEATURES.map((feature) => {
              const total = feature.getValue(data.counters!);
              const today = data.dailyMetrics[0]?.writesByCollection?.[feature.collectionKey] ?? 0;
              const yesterday = data.dailyMetrics[1]?.writesByCollection?.[feature.collectionKey] ?? 0;
              const isExpanded = expandedFeature === feature.key;
              const trendData = isExpanded ? buildFeatureTrend(data.dailyMetrics, feature.collectionKey) : [];

              return (
                <Grid key={feature.key} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{ borderLeft: `4px solid ${feature.color}`, cursor: 'pointer', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 2 } }}
                    onClick={() => setExpandedFeature(isExpanded ? null : feature.key)}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ color: feature.color }}>{feature.icon}</Box>
                        <Typography variant="subtitle2">{feature.name}</Typography>
                        {(today > 0 || yesterday > 0) && (
                          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TrendIcon today={today} yesterday={yesterday} />
                          </Box>
                        )}
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {today}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        hoy · {total.toLocaleString()} total
                      </Typography>
                    </CardContent>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ px: 2, pb: 2 }}>
                        <LineChartCard
                          title={`${feature.name} — últimos 30 días`}
                          data={trendData}
                          lines={[{ dataKey: 'value', color: feature.color, label: feature.name }]}
                          xAxisKey="date"
                        />
                      </Box>
                    </Collapse>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* GA4-only features */}
          <Typography variant="h6" gutterBottom>Features solo en GA4</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Estos eventos se trackean en Firebase Analytics (GA4) pero no tienen agregación server-side todavía.
            Se pueden traer via Google Analytics Data API con una Cloud Function callable (mejora futura).
          </Alert>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {GA4_FEATURES.map((feature) => (
              <Grid key={feature.name} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined" sx={{ opacity: 0.7 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {feature.icon}
                      <Typography variant="subtitle2">{feature.name}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Eventos: {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Adoption */}
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
