import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import { ABUSE_TYPE_COLORS, ABUSE_TYPE_LABELS } from '../../../constants';
import {
  ALL_TYPES,
  DATE_PRESETS,
  SEVERITY_CONFIG,
  SEVERITY_FILTER_OPTIONS,
  STATUS_OPTIONS,
} from './alertsHelpers';
import type {
  AbuseType,
  DatePreset,
  SeverityFilter,
  StatusFilter,
} from './alertsHelpers';

export interface AlertsFiltersProps {
  datePreset: DatePreset;
  onDatePresetChange: (preset: DatePreset) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  typeFilter: AbuseType | 'all';
  onTypeFilterChange: (type: AbuseType | 'all') => void;
  severityFilter: SeverityFilter;
  onSeverityFilterChange: (severity: SeverityFilter) => void;
  collectionFilter: string;
  onCollectionFilterChange: (collection: string) => void;
  userSearch: string;
  onUserSearchChange: (q: string) => void;
  collections: string[];
  typeCounts: Record<string, number>;
  totalLogs: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  onExport: () => void;
  exportDisabled: boolean;
}

export default function AlertsFilters({
  datePreset,
  onDatePresetChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  severityFilter,
  onSeverityFilterChange,
  collectionFilter,
  onCollectionFilterChange,
  userSearch,
  onUserSearchChange,
  collections,
  typeCounts,
  totalLogs,
  hasActiveFilters,
  onClear,
  onExport,
  exportDisabled,
}: AlertsFiltersProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
      {/* Row 1: Periodo + Estado */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Periodo</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {DATE_PRESETS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              size="small"
              variant={datePreset === p.key ? 'filled' : 'outlined'}
              color={datePreset === p.key ? 'primary' : 'default'}
              onClick={() => onDatePresetChange(datePreset === p.key ? 'all' : p.key)}
            />
          ))}
        </Box>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Estado</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              size="small"
              variant={statusFilter === o.key ? 'filled' : 'outlined'}
              color={statusFilter === o.key ? o.color : 'default'}
              onClick={() => onStatusFilterChange(o.key)}
            />
          ))}
        </Box>
      </Box>

      {/* Row 2: Tipo + Severidad */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Tipo</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Badge badgeContent={totalLogs} max={999} sx={{ '& .MuiBadge-badge': { bgcolor: 'text.primary', color: 'background.paper' } }}>
            <Chip label="Todas" variant={typeFilter === 'all' ? 'filled' : 'outlined'} onClick={() => onTypeFilterChange('all')} size="small" />
          </Badge>
          {ALL_TYPES.map((type) => (
            <Badge key={type} badgeContent={typeCounts[type]} color={ABUSE_TYPE_COLORS[type]} max={999}>
              <Chip
                label={ABUSE_TYPE_LABELS[type]}
                color={ABUSE_TYPE_COLORS[type]}
                variant={typeFilter === type ? 'filled' : 'outlined'}
                onClick={() => onTypeFilterChange(typeFilter === type ? 'all' : type)}
                size="small"
              />
            </Badge>
          ))}
        </Box>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Severidad</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {SEVERITY_FILTER_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              size="small"
              variant={severityFilter === o.key ? 'filled' : 'outlined'}
              color={severityFilter === o.key && o.key !== 'all' ? SEVERITY_CONFIG[o.key].color : 'default'}
              onClick={() => onSeverityFilterChange(o.key)}
            />
          ))}
        </Box>
      </Box>

      {/* Row 3: Colección + búsqueda + acciones — full width */}
      <Box sx={{ gridColumn: { md: '1 / -1' }, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {collections.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Colección</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {collections.map((col) => (
                <Chip
                  key={col}
                  label={col}
                  size="small"
                  variant={collectionFilter === col ? 'filled' : 'outlined'}
                  onClick={() => onCollectionFilterChange(collectionFilter === col ? '' : col)}
                />
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Buscar por userId..."
            value={userSearch}
            onChange={(e) => onUserSearchChange(e.target.value)}
            sx={{ minWidth: 200 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          {hasActiveFilters && <Button size="small" onClick={onClear}>Limpiar</Button>}
          <Tooltip title="Exportar CSV">
            <span>
              <IconButton size="small" onClick={onExport} disabled={exportDisabled} aria-label="Exportar CSV">
                <FileDownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
