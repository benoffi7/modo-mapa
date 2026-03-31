import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import TrendIcon from './TrendIcon';
import LineChartCard from '../charts/LineChartCard';
import { buildGA4FeatureData } from '../FeaturesPanel';
import type { GA4FeatureDef } from './ga4FeatureDefinitions';
import type { GA4EventCount } from '../../../types/admin';

interface GA4FeatureCardProps {
  feature: GA4FeatureDef;
  events: GA4EventCount[];
  isExpanded: boolean;
  onToggle: () => void;
}

export default function GA4FeatureCard({ feature, events, isExpanded, onToggle }: GA4FeatureCardProps) {
  const ga4Data = buildGA4FeatureData(events, feature.eventNames);

  return (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <Card
        variant="outlined"
        sx={{ borderLeft: `4px solid ${feature.color}`, cursor: 'pointer', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 2 } }}
        onClick={onToggle}
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
            hoy (GA4) · {ga4Data.total.toLocaleString()} últimos 30d
          </Typography>
        </CardContent>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ px: 2, pb: 2 }}>
            <LineChartCard
              title={`${feature.name} — últimos 30 días`}
              data={ga4Data.trend}
              lines={[{ dataKey: 'value', color: feature.color, label: feature.name }]}
              xAxisKey="date"
            />
          </Box>
        </Collapse>
      </Card>
    </Grid>
  );
}
