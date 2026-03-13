import { useState, useMemo, useCallback } from 'react';
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
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import HomeIcon from '@mui/icons-material/Home';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/Restore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { CONSTANT_MODULES } from './constantsRegistry';
import type { ConstantEntry } from './constantsRegistry';

type OverrideKey = `${string}.${string}`;
type Overrides = Map<OverrideKey, unknown>;

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function entryKey(entry: ConstantEntry): OverrideKey {
  return `${entry.module}.${entry.name}`;
}

function isHexColor(value: unknown): boolean {
  return typeof value === 'string' && HEX_RE.test(value);
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function detectSubtype(name: string, value: unknown): string | null {
  if (typeof value === 'string' && HEX_RE.test(value)) return 'color';
  if (typeof value === 'number') {
    const lower = name.toLowerCase();
    if (lower.includes('_ms') || lower.includes('ttl') || lower.includes('interval') || lower.includes('duration')) return 'ms';
  }
  return null;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(ms % 60_000 === 0 ? 0 : 1)}min`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

interface ValidationResult {
  valid: boolean;
  error: string | null;
  hint: string | null;
  parsed: unknown;
}

function validate(raw: string, type: string, name: string): ValidationResult {
  if (raw === '') return { valid: false, error: 'El valor no puede estar vacío', hint: null, parsed: undefined };

  if (type === 'number') {
    const n = Number(raw);
    if (Number.isNaN(n)) return { valid: false, error: 'Debe ser un número válido', hint: 'Ej: 42, 3.14, -1', parsed: undefined };
    if (!Number.isFinite(n)) return { valid: false, error: 'El número debe ser finito', hint: null, parsed: undefined };
    const subtype = detectSubtype(name, n);
    const hint = subtype === 'ms' ? formatMs(n) : null;
    return { valid: true, error: null, hint, parsed: n };
  }

  if (type === 'boolean') {
    if (raw === 'true') return { valid: true, error: null, hint: null, parsed: true };
    if (raw === 'false') return { valid: true, error: null, hint: null, parsed: false };
    return { valid: false, error: 'Debe ser true o false', hint: null, parsed: undefined };
  }

  if (type === 'string') {
    const subtype = detectSubtype(name, raw);
    if (subtype === 'color') return { valid: true, error: null, hint: raw, parsed: raw };
    if (name.toLowerCase().includes('color') && !HEX_RE.test(raw)) {
      return { valid: true, error: null, hint: 'No parece un color hex válido (#RGB o #RRGGBB)', parsed: raw };
    }
    return { valid: true, error: null, hint: null, parsed: raw };
  }

  // object / array — validate JSON
  try {
    const parsed = JSON.parse(raw);
    if (type === 'array' && !Array.isArray(parsed)) {
      return { valid: false, error: 'Se esperaba un array []', hint: null, parsed: undefined };
    }
    if (type === 'object' && (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)) {
      return { valid: false, error: 'Se esperaba un objeto {}', hint: null, parsed: undefined };
    }
    const keys = type === 'array' ? parsed.length : Object.keys(parsed).length;
    return { valid: true, error: null, hint: `${keys} ${type === 'array' ? 'elementos' : 'claves'}`, parsed };
  } catch {
    return { valid: false, error: 'JSON inválido', hint: 'Revisá comillas, comas y llaves', parsed: undefined };
  }
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: 0.5,
        bgcolor: color,
        border: 1,
        borderColor: 'divider',
        flexShrink: 0,
      }}
    />
  );
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

const TYPE_PLACEHOLDERS: Record<string, string> = {
  number: 'Ej: 42, 3.14',
  boolean: 'true o false',
  string: 'Texto...',
  object: '{ "key": "value" }',
  array: '[ "item1", "item2" ]',
};

interface ConstantRowProps {
  entry: ConstantEntry;
  isModified: boolean;
  overrideValue: unknown | undefined;
  onCopy: (text: string, label: string) => void;
  onEdit: (key: OverrideKey, value: unknown) => void;
  onReset: (key: OverrideKey) => void;
}

function ConstantRow({ entry, isModified, overrideValue, onCopy, onEdit, onReset }: ConstantRowProps) {
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');

  const currentValue = isModified ? overrideValue : entry.value;
  const isComplex = entry.type === 'object' || entry.type === 'array';
  const displayValue = formatValue(currentValue);
  const subtype = detectSubtype(entry.name, currentValue);

  const validation = useMemo(
    () => (editing ? validate(editBuffer, entry.type, entry.name) : null),
    [editing, editBuffer, entry.type, entry.name],
  );

  const startEdit = () => {
    setEditBuffer(isComplex ? JSON.stringify(currentValue, null, 2) : (entry.type === 'string' ? String(currentValue) : String(currentValue)));
    setEditing(true);
  };

  const confirmEdit = () => {
    if (!validation?.valid) return;
    onEdit(entryKey(entry), validation.parsed);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const key = entryKey(entry);

  if (editing) {
    const isColor = entry.type === 'string' && isHexColor(editBuffer);

    return (
      <Box sx={{ py: 0.75, px: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            {entry.name}
          </Typography>
          <TypeBadge type={entry.type} />
          {validation && (
            validation.valid
              ? <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
              : <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />
          )}
        </Box>
        <TextField
          fullWidth
          size="small"
          multiline={isComplex}
          minRows={isComplex ? 3 : undefined}
          maxRows={isComplex ? 10 : undefined}
          placeholder={TYPE_PLACEHOLDERS[entry.type]}
          value={editBuffer}
          onChange={(e) => setEditBuffer(e.target.value)}
          error={!!validation?.error}
          helperText={validation?.error || validation?.hint || ' '}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isComplex) { e.preventDefault(); confirmEdit(); }
            if (e.key === 'Escape') cancelEdit();
          }}
          slotProps={{
            input: {
              sx: { fontFamily: 'monospace', fontSize: '0.85rem' },
              startAdornment: isColor ? (
                <InputAdornment position="start">
                  <ColorSwatch color={editBuffer} />
                </InputAdornment>
              ) : undefined,
            },
            formHelperText: {
              sx: { color: validation?.error ? 'error.main' : 'text.secondary' },
            },
          }}
          sx={{ mb: 0.5 }}
        />
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
            {isComplex ? 'Escape cancelar · Ctrl+Enter no soportado aún' : 'Enter guardar · Escape cancelar'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" onClick={cancelEdit}>Cancelar</Button>
            <Button size="small" variant="contained" disabled={!validation?.valid} onClick={confirmEdit}>Guardar</Button>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 1fr) auto auto auto auto',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 1,
        '&:hover': { bgcolor: 'action.hover' },
        borderRadius: 1,
        borderLeft: isModified ? 3 : 0,
        borderColor: 'warning.main',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {entry.name}
        </Typography>
        {isModified && (
          <Chip label="modificado" size="small" color="warning" sx={{ fontSize: '0.6rem', height: 18 }} />
        )}
      </Box>

      <TypeBadge type={entry.type} />

      {isComplex ? (
        <Box sx={{ maxWidth: 400, overflow: 'auto', cursor: 'pointer' }} onClick={startEdit}>
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
        <Box
          onClick={startEdit}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            overflow: 'hidden',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {subtype === 'color' && <ColorSwatch color={String(currentValue)} />}
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              color: isModified ? 'warning.main' : 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayValue}
          </Typography>
          {subtype === 'ms' && (
            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
              ({formatMs(currentValue as number)})
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 0.25 }}>
        <Tooltip title="Editar">
          <IconButton size="small" onClick={startEdit}>
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {isModified && (
          <Tooltip title="Restaurar original">
            <IconButton size="small" onClick={() => onReset(key)} color="warning">
              <RestoreIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Copiar nombre">
          <IconButton
            size="small"
            onClick={() => onCopy(entry.name, entry.name)}
          >
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Copiar valor">
          <IconButton
            size="small"
            onClick={() => onCopy(displayValue, `valor ${entry.name}`)}
          >
            <ContentCopyIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
          </IconButton>
        </Tooltip>
      </Box>
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
  const [overrides, setOverrides] = useState<Overrides>(new Map());

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

  const handleEdit = useCallback((key: OverrideKey, value: unknown) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
    setSnackbar('Valor modificado (runtime only)');
  }, []);

  const handleReset = useCallback((key: OverrideKey) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setSnackbar('Valor restaurado');
  }, []);

  const handleResetAll = () => {
    setOverrides(new Map());
    setSnackbar('Todos los valores restaurados');
  };

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" href="/" sx={{ mr: 1 }}>
            <HomeIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', flex: 1 }}>
            Constants Dashboard
          </Typography>
          {overrides.size > 0 && (
            <Chip
              label={`${overrides.size} modificada(s)`}
              size="small"
              color="warning"
              onDelete={handleResetAll}
              sx={{ mr: 1 }}
            />
          )}
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
            {duplicates.length} posible(s) duplicado(s) entre módulos:
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
              {mod.entries.map((entry) => {
                const key = entryKey(entry);
                return (
                  <ConstantRow
                    key={entry.name}
                    entry={entry}
                    isModified={overrides.has(key)}
                    overrideValue={overrides.get(key)}
                    onCopy={handleCopy}
                    onEdit={handleEdit}
                    onReset={handleReset}
                  />
                );
              })}
            </AccordionDetails>
          </Accordion>
        ))}

        {/* Stats footer */}
        <Paper variant="outlined" sx={{ mt: 2, p: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {visibleConstants} de {totalConstants} constantes
            {' · '}
            {CONSTANT_MODULES.length} módulos
            {overrides.size > 0 && ` · ${overrides.size} modificada(s)`}
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
