import { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { NAV_CHIP_SX } from '../../constants/ui';
import { HELP_GROUPS } from './helpGroups';

declare const __APP_VERSION__: string;

/** Render puro del registry `HELP_GROUPS` (ver `./helpGroups.tsx` y guard #311). */
export default function HelpSection() {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_: unknown, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', pt: 1 }}>
        Modo Mapa v{__APP_VERSION__}
      </Typography>
      {HELP_GROUPS.map((group) => (
        <Box key={group.label}>
          <Chip
            label={group.label}
            size="small"
            variant="outlined"
            sx={{ ...NAV_CHIP_SX, mt: 2.5, mb: 1, ml: 2, fontWeight: 600 }}
          />
          {group.items.map((item) => (
            <Accordion
              key={item.id}
              expanded={expanded === item.id}
              onChange={handleChange(item.id)}
              disableGutters
              elevation={0}
              sx={{ '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-label={item.title}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {item.icon}
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ))}
    </Box>
  );
}
