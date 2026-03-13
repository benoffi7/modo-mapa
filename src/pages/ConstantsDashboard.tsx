import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { CONSTANT_MODULES } from './constantsRegistry';
import type { ConstantEntry } from './constantsRegistry';

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info'> = {
    number: 'primary',
    string: 'success',
    object: 'warning',
    array: 'info',
    boolean: 'secondary',
  };
  return <Chip label={type} size="small" color={colorMap[type] ?? 'primary'} variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />;
}

function ConstantRow({ entry, onCopy }: { entry: ConstantEntry; onCopy: (text: string, label: string) => void }) {
  const isComplex = entry.type === 'object' || entry.type === 'array';
  const displayValue = formatValue(entry.value);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        py: 0.75,
        px: 1,
        '&:hover': { bgcolor: 'action.hover' },
        borderRadius: 1,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontFamily: 'monospace', fontWeight: 600, minWidth: 0, flex: '0 1 auto', wordBreak: 'break-all' }}
      >
        {entry.name}
      </Typography>

      <Box sx={{ flex: 1 }} />

      <TypeBadge type={entry.type} />

      {isComplex ? (
        <Box sx={{ maxWidth: '100%', overflow: 'auto' }}>
          <Typography
            component="pre"
            variant="caption"
            sx={{
              fontFamily: 'monospace',
              bgcolor: 'action.hover',
              p: 1,
              borderRadius: 1,
              maxHeight: 200,
              overflow: 'auto',
              fontSize: '0.7rem',
              m: 0,
            }}
          >
            {displayValue}
          </Typography>
        </Box>
      ) : (
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap' }}
        >
          {displayValue}
        </Typography>
      )}

      <Tooltip title="Copiar import">
        <IconButton
          size="small"
          onClick={() => onCopy(`import { ${entry.name} } from '../constants/${entry.module}';`, entry.name)}
        >
          <ContentCopyIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function findDuplicates(): Array<{ value: string; entries: Array<{ name: string; module: string }> }> {
  const valueMap = new Map<string, Array<{ name: string; module: string }>>();

  for (const mod of CONSTANT_MODULES) {
    for (const entry of mod.entries) {
      if (entry.type !== 'number' && entry.type !== 'string') continue;
      const key = String(entry.value);
      const list = valueMap.get(key) ?? [];
      list.push({ name: entry.name, module: entry.module });
      valueMap.set(key, list);
    }
  }

  return Array.from(valueMap.entries())
    .filter(([, entries]) => entries.length > 1 && entries.some((a, _, arr) => arr.some((b) => a.module !== b.module)))
    .map(([value, entries]) => ({ value, entries }));
}

export default function ConstantsDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set(CONSTANT_MODULES.map((m) => m.name)));
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const duplicates = useMemo(() => findDuplicates(), []);

  const toggleModule = (name: string) => {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return CONSTANT_MODULES
      .filter((m) => activeModules.has(m.name))
      .map((m) => ({
        ...m,
        entries: q
          ? m.entries.filter(
              (e) => e.name.toLowerCase().includes(q) || String(e.value).toLowerCase().includes(q),
            )
          : m.entries,
      }))
      .filter((m) => m.entries.length > 0);
  }, [searchQuery, activeModules]);

  const totalConstants = CONSTANT_MODULES.reduce((sum, m) => sum + m.entries.length, 0);
  const visibleConstants = filteredModules.reduce((sum, m) => sum + m.entries.length, 0);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar(`Copiado: ${label}`);
  };

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" href="/" sx={{ mr: 1 }}>
            <HomeIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            Constants Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2, maxWidth: 900, mx: 'auto', width: '100%' }}>
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar constantes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 2 }}
        />

        {/* Module filter chips */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {CONSTANT_MODULES.map((m) => (
            <Chip
              key={m.name}
              label={`${m.name} (${m.entries.length})`}
              size="small"
              variant={activeModules.has(m.name) ? 'filled' : 'outlined'}
              color={activeModules.has(m.name) ? 'primary' : 'default'}
              onClick={() => toggleModule(m.name)}
            />
          ))}
        </Box>

        {/* Duplicates banner */}
        {duplicates.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {duplicates.length} posible(s) duplicado(s) entre m&oacute;dulos:
            {duplicates.map((d) => (
              <Typography key={d.value} variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
                Valor {d.value}: {d.entries.map((e) => `${e.module}.${e.name}`).join(', ')}
              </Typography>
            ))}
          </Alert>
        )}

        {/* Modules */}
        {filteredModules.map((mod) => (
          <Accordion key={mod.name} defaultExpanded disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 1, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {mod.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1, alignSelf: 'center' }}>
                {mod.description} ({mod.entries.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {mod.entries.map((entry) => (
                <ConstantRow key={entry.name} entry={entry} onCopy={handleCopy} />
              ))}
            </AccordionDetails>
          </Accordion>
        ))}

        {/* Stats footer */}
        <Paper variant="outlined" sx={{ mt: 2, p: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {visibleConstants} de {totalConstants} constantes
            {' · '}
            {CONSTANT_MODULES.length} m&oacute;dulos
            {duplicates.length > 0 && ` · ${duplicates.length} posibles duplicados`}
          </Typography>
        </Paper>
      </Box>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={2000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}
