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
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import RecommendOutlinedIcon from '@mui/icons-material/RecommendOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchDailyMetrics, fetchCounters, fetchAnalyticsReport } from '../../services/admin';
import AdminPanelWrapper from './AdminPanelWrapper';
import LineChartCard from './charts/LineChartCard';
import type { ReactElement } from 'react';
import type { AdminCounters, DailyMetrics, GA4EventCount } from '../../types/admin';

// ── Firestore feature definitions ─────────────────────────────────────

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
  { key: 'checkins', name: 'Check-ins', icon: <PlaceOutlinedIcon />, getValue: (c) => c.checkins, collectionKey: 'checkins', color: '#009688' },
  { key: 'follows', name: 'Follows', icon: <PeopleOutlinedIcon />, getValue: (c) => c.follows, collectionKey: 'follows', color: '#3F51B5' },
  { key: 'recommendations', name: 'Recomendaciones', icon: <RecommendOutlinedIcon />, getValue: (c) => c.recommendations, collectionKey: 'recommendations', color: '#FF9800' },
  { key: 'priceLevels', name: 'Nivel de gasto', icon: <AttachMoneyOutlinedIcon />, getValue: (c) => c.priceLevels, collectionKey: 'priceLevels', color: '#4CAF50' },
];

// ── GA4 feature definitions ───────────────────────────────────────────

interface GA4FeatureDef {
  key: string;
  name: string;
  icon: ReactElement;
  eventNames: string[];
  color: string;
}

const GA4_FEATURES: GA4FeatureDef[] = [
  { key: 'surprise', name: 'Sorprendeme', icon: <CasinoIcon />, eventNames: ['surprise_me'], color: '#FF5722' },
  { key: 'lists', name: 'Listas', icon: <BookmarkBorderIcon />, eventNames: ['list_created', 'list_item_added'], color: '#795548' },
  { key: 'search', name: 'Busqueda', icon: <SearchIcon />, eventNames: ['business_search'], color: '#607D8B' },
  { key: 'share', name: 'Compartir', icon: <ShareIcon />, eventNames: ['business_share'], color: '#00BCD4' },
  { key: 'photos', name: 'Fotos', icon: <CameraAltOutlinedIcon />, eventNames: ['menu_photo_upload'], color: '#8BC34A' },
  { key: 'darkMode', name: 'Dark Mode', icon: <DarkModeOutlinedIcon />, eventNames: ['dark_mode_toggle'], color: '#424242' },
  { key: 'questions', name: 'Preguntas', icon: <HelpOutlineIcon />, eventNames: ['question_created', 'question_answered'], color: '#00BCD4' },
];

// ── Shared components ─────────────────────────────────────────────────

function TrendIcon({ today, yesterday }: { today: number; yesterday: number }) {
  if (today > yesterday) return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
  if (today < yesterday) return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
  return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
}

// ── Helpers ───────────────────────────────────────────────────────────

function buildFeatureTrend(metrics: DailyMetrics[], collectionKey: string): { date: string; value: number }[] {
  return [...metrics].reverse().map((m) => ({
    date: (m as unknown as { id?: string }).id ?? '',
    value: m.writesByCollection?.[collectionKey] ?? 0,
  }));
}

function buildGA4FeatureData(
  events: GA4EventCount[],
  eventNames: string[],
): { today: number; yesterday: number; total: number; trend: { date: string; value: number }[] } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10).replace(/-/g, '');

  const relevant = events.filter((e) => eventNames.includes(e.eventName));

  const byDate = new Map<string, number>();
  let total = 0;
  for (const e of relevant) {
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.eventCount);
    total += e.eventCount;
  }

  const todayCount = byDate.get(todayStr) ?? 0;
  const yesterdayCount = byDate.get(yesterdayStr) ?? 0;

  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      value,
    }));

  return { today: todayCount, yesterday: yesterdayCount, total, trend };
}

// ── Main component ────────────────────────────────────────────────────

export default function FeaturesPanel() {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    const [firestoreResult, ga4Result] = await Promise.allSettled([
      Promise.all([fetchCounters(), fetchDailyMetrics('desc', 30)]),
      fetchAnalyticsReport(),
    ]);

    const firestoreData = firestoreResult.status === 'fulfilled' ? firestoreResult.value : null;
    const ga4Data = ga4Result.status === 'fulfilled' ? ga4Result.value : null;

    if (!firestoreData) {
      throw new Error('Error cargando datos de Firestore');
    }

    return {
      counters: firestoreData[0],
      dailyMetrics: firestoreData[1],
      analyticsReport: ga4Data,
      ga4Error: ga4Result.status === 'rejected' ? true : false,
    };
  }, []);

  const { data, loading, error } = useAsyncData(fetcher);

  const activeUsers = useMemo(() => {
    if (!data?.dailyMetrics.length) return 0;
    return data.dailyMetrics[0].activeUsers ?? 0;
  }, [data]);

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="Error cargando metricas de features.">
      {data?.counters && (
        <>
          {/* Summary */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Chip label={`${data.counters.users} usuarios`} />
            <Chip label={`${activeUsers} activos hoy`} color="primary" />
            <Chip label={`${data.dailyMetrics[0]?.dailyWrites ?? 0} escrituras hoy`} variant="outlined" />
          </Box>

          {/* Feature cards */}
          <Typography variant="h6" gutterBottom>Metricas por funcionalidad</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Toca una card para ver el grafico de los ultimos 30 dias.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Firestore features */}
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
                          title={`${feature.name} — ultimos 30 dias`}
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

            {/* GA4 features */}
            {data.ga4Error && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="warning">
                  No se pudieron cargar las metricas de GA4. Los datos de colecciones estan disponibles.
                </Alert>
              </Grid>
            )}
            {data.analyticsReport && GA4_FEATURES.map((feature) => {
              const ga4Data = buildGA4FeatureData(data.analyticsReport!.events, feature.eventNames);
              const isExpanded = expandedFeature === feature.key;

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
                        {(ga4Data.today > 0 || ga4Data.yesterday > 0) && (
                          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TrendIcon today={ga4Data.today} yesterday={ga4Data.yesterday} />
                          </Box>
                        )}
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {ga4Data.today}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        hoy (GA4) · {ga4Data.total.toLocaleString()} ultimos 30d
                      </Typography>
                    </CardContent>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ px: 2, pb: 2 }}>
                        <LineChartCard
                          title={`${feature.name} — ultimos 30 dias`}
                          data={ga4Data.trend}
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

          {/* Adoption */}
          <Typography variant="h6" gutterBottom>Adopcion</Typography>
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
