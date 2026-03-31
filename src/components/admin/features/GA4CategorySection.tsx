import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GA4FeatureCard from './GA4FeatureCard';
import type { GA4FeatureCategory } from './ga4FeatureDefinitions';
import type { GA4EventCount } from '../../../types/admin';

interface GA4CategorySectionProps {
  category: GA4FeatureCategory;
  events: GA4EventCount[];
  expandedFeature: string | null;
  onToggleFeature: (key: string) => void;
  defaultExpanded?: boolean | undefined;
}

export default function GA4CategorySection({
  category,
  events,
  expandedFeature,
  onToggleFeature,
  defaultExpanded,
}: GA4CategorySectionProps) {
  const [open, setOpen] = useState(defaultExpanded ?? true);

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>{category.label}</Typography>
        <Chip label={category.features.length} size="small" variant="outlined" />
        <IconButton size="small" onClick={() => setOpen(!open)}>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Grid container spacing={2}>
          {category.features.map((feature) => (
            <GA4FeatureCard
              key={feature.key}
              feature={feature}
              events={events}
              isExpanded={expandedFeature === feature.key}
              onToggle={() => onToggleFeature(feature.key)}
            />
          ))}
        </Grid>
      </Collapse>
    </Box>
  );
}
