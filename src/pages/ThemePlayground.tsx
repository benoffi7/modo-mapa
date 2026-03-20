import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Paper,
  Chip,
  Button,
  Rating,
  Avatar,
  IconButton,
  Fab,
  Divider,
  Card,
  CardContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Slider,
  Tooltip,
  Snackbar,
  Alert,
  Switch,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FavoriteIcon from '@mui/icons-material/Favorite';
import StarIcon from '@mui/icons-material/Star';
import AddIcon from '@mui/icons-material/Add';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';

// ─── Color utils ───────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generatePalette(baseHex: string) {
  const [h, s, l] = hexToHsl(baseHex);
  return {
    50: hslToHex(h, Math.min(s + 10, 100), Math.min(l + 40, 97)),
    100: hslToHex(h, Math.min(s + 5, 100), Math.min(l + 30, 93)),
    200: hslToHex(h, s, Math.min(l + 20, 85)),
    300: hslToHex(h, s, Math.min(l + 10, 75)),
    400: hslToHex(h, s, l + 5),
    500: baseHex,
    600: hslToHex(h, s, Math.max(l - 8, 10)),
    700: hslToHex(h, s, Math.max(l - 16, 10)),
    800: hslToHex(h, Math.max(s - 5, 0), Math.max(l - 24, 10)),
    900: hslToHex(h, Math.max(s - 10, 0), Math.max(l - 32, 5)),
  };
}

// ─── Small components ──────────────────────────────────────

function ColorSwatch({ label, color, onCopy }: { label: string; color: string; onCopy: (t: string) => void }) {
  const [, , l] = hexToHsl(color);
  const textColor = l > 55 ? '#000' : '#fff';
  return (
    <Tooltip title="Click to copy">
      <Box
        onClick={() => onCopy(color)}
        sx={{
          bgcolor: color, color: textColor, px: 1.5, py: 0.75, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          '&:hover': { opacity: 0.85 },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{color}</Typography>
      </Box>
    </Tooltip>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ minWidth: 130 }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box
          component="input"
          type="color"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          sx={{ width: 32, height: 32, border: 'none', cursor: 'pointer', p: 0, bgcolor: 'transparent' }}
        />
        <TextField size="small" value={value} onChange={(e) => onChange(e.target.value)} sx={{ width: 95 }}
          slotProps={{ htmlInput: { sx: { fontFamily: 'monospace', fontSize: '0.8rem', py: 0.5 } } }}
        />
      </Box>
    </Box>
  );
}

// ─── Component preview (reusable for both modes) ──────────

interface PreviewProps {
  mode: 'light' | 'dark';
  bg: string;
  paper: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  secondary: string;
}

function ComponentPreview({ mode, bg, paper, textPrimary, textSecondary, primary, secondary }: PreviewProps) {
  return (
    <Box sx={{ bgcolor: bg, borderRadius: 2, p: 2, border: '1px solid', borderColor: mode === 'light' ? '#e0e0e0' : '#333', flex: 1, minWidth: 300 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {mode === 'dark' ? <DarkModeIcon sx={{ color: '#ffb74d', fontSize: 18 }} /> : <LightModeIcon sx={{ color: '#fb8c00', fontSize: 18 }} />}
        <Typography variant="subtitle2" sx={{ color: textPrimary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
          {mode}
        </Typography>
      </Box>

      {/* Search bar */}
      <Paper elevation={0} sx={{ bgcolor: paper, p: 1, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: mode === 'light' ? '#e0e0e0' : '#333' }}>
        <MenuIcon sx={{ color: textSecondary, fontSize: 20 }} />
        <Typography variant="body2" sx={{ color: textSecondary, flex: 1, fontSize: '0.8rem' }}>Buscar comercios...</Typography>
        <SearchIcon sx={{ color: textSecondary, fontSize: 20 }} />
      </Paper>

      {/* Chips */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Chip label="Activo" size="small" sx={{ bgcolor: primary, color: '#fff', fontSize: '0.7rem', height: 26 }} />
        <Chip label="Cafes" size="small" variant="outlined" sx={{ borderColor: textSecondary, color: textPrimary, fontSize: '0.7rem', height: 26 }} />
        <Chip label="Shops" size="small" variant="outlined" sx={{ borderColor: textSecondary, color: textPrimary, fontSize: '0.7rem', height: 26 }} />
      </Box>

      {/* Business card */}
      <Card elevation={0} sx={{ bgcolor: paper, mb: 1.5, border: '1px solid', borderColor: mode === 'light' ? '#e0e0e0' : '#333' }}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Avatar sx={{ bgcolor: primary, width: 32, height: 32, fontSize: '0.85rem' }}>M</Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: textPrimary, fontSize: '0.85rem' }} noWrap>Mi Comercio</Typography>
              <Typography variant="caption" sx={{ color: textSecondary }}>Av. Corrientes 1234</Typography>
            </Box>
            <IconButton size="small"><FavoriteIcon sx={{ color: secondary, fontSize: 18 }} /></IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: textPrimary, fontWeight: 600 }}>4.2</Typography>
            <Rating value={4.2} precision={0.1} readOnly size="small" />
            <Typography variant="caption" sx={{ color: textSecondary }}>(15)</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: textSecondary }}>Tu rating:</Typography>
            <Rating value={3} size="small" icon={<StarIcon sx={{ color: '#fbbc04', fontSize: 16 }} />} emptyIcon={<StarIcon sx={{ color: textSecondary, opacity: 0.3, fontSize: 16 }} />} />
          </Box>
        </CardContent>
      </Card>

      {/* Buttons */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="contained" sx={{ bgcolor: primary, fontSize: '0.7rem' }}>Contained</Button>
        <Button size="small" variant="outlined" sx={{ borderColor: primary, color: primary, fontSize: '0.7rem' }}>Outlined</Button>
        <Button size="small" sx={{ color: primary, fontSize: '0.7rem' }}>Text</Button>
      </Box>

      {/* List */}
      <Paper elevation={0} sx={{ bgcolor: paper, mb: 1.5, border: '1px solid', borderColor: mode === 'light' ? '#e0e0e0' : '#333' }}>
        <List disablePadding dense>
          <ListItemButton dense>
            <ListItemIcon sx={{ minWidth: 32 }}><FavoriteIcon sx={{ color: secondary, fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="Favoritos" slotProps={{ primary: { sx: { color: textPrimary, fontSize: '0.8rem' } } }} />
          </ListItemButton>
          <ListItemButton dense>
            <ListItemIcon sx={{ minWidth: 32 }}><ChatBubbleOutlineIcon sx={{ color: primary, fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="Comentarios" slotProps={{ primary: { sx: { color: textPrimary, fontSize: '0.8rem' } } }} />
          </ListItemButton>
          <ListItemButton dense>
            <ListItemIcon sx={{ minWidth: 32 }}><StarIcon sx={{ color: '#fbbc04', fontSize: 18 }} /></ListItemIcon>
            <ListItemText primary="Calificaciones" slotProps={{ primary: { sx: { color: textPrimary, fontSize: '0.8rem' } } }} />
          </ListItemButton>
          <Divider />
          <ListItemButton dense>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {mode === 'dark' ? <DarkModeIcon sx={{ color: '#ffb74d', fontSize: 18 }} /> : <LightModeIcon sx={{ color: '#fb8c00', fontSize: 18 }} />}
            </ListItemIcon>
            <ListItemText primary="Modo oscuro" slotProps={{ primary: { sx: { color: textPrimary, fontSize: '0.8rem' } } }} />
            <Switch size="small" checked={mode === 'dark'} disabled />
          </ListItemButton>
        </List>
      </Paper>

      {/* FABs + Slider */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Fab size="small" sx={{ bgcolor: paper, color: textPrimary, width: 36, height: 36, boxShadow: 1 }}><MyLocationIcon sx={{ fontSize: 18 }} /></Fab>
        <Fab size="small" sx={{ bgcolor: primary, color: '#fff', width: 36, height: 36 }}><AddIcon sx={{ fontSize: 18 }} /></Fab>
        <Box sx={{ flex: 1, ml: 1 }}>
          <Slider size="small" defaultValue={60} sx={{ color: primary }} />
        </Box>
      </Box>
    </Box>
  );
}

// ─── Main playground ───────────────────────────────────────

export default function ThemePlayground() {
  const [primaryColor, setPrimaryColor] = useState('#1a73e8');
  const [secondaryColor, setSecondaryColor] = useState('#ea4335');
  const [bgLight, setBgLight] = useState('#ffffff');
  const [bgDark, setBgDark] = useState('#121212');
  const [paperDark, setPaperDark] = useState('#1e1e1e');
  const [textPrimaryLight, setTextPrimaryLight] = useState('#202124');
  const [textSecondaryLight, setTextSecondaryLight] = useState('#5f6368');
  const [textPrimaryDark, setTextPrimaryDark] = useState('#e8eaed');
  const [textSecondaryDark, setTextSecondaryDark] = useState('#9aa0a6');
  const [copied, setCopied] = useState(false);

  const primaryPalette = useMemo(() => generatePalette(primaryColor), [primaryColor]);
  const secondaryPalette = useMemo(() => generatePalette(secondaryColor), [secondaryColor]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const fullOutput = `// theme/index.ts — paste inside getDesignTokens()
// Light mode
palette: {
  mode: 'light',
  primary: {
    main: '${primaryColor}',
    light: '${primaryPalette[300]}',
    dark: '${primaryPalette[700]}',
  },
  secondary: {
    main: '${secondaryColor}',
  },
  background: {
    default: '${bgLight}',
    paper: '${bgLight}',
  },
  text: {
    primary: '${textPrimaryLight}',
    secondary: '${textSecondaryLight}',
  },
}

// Dark mode
palette: {
  mode: 'dark',
  primary: {
    main: '${primaryColor}',
    light: '${primaryPalette[300]}',
    dark: '${primaryPalette[700]}',
  },
  secondary: {
    main: '${secondaryColor}',
  },
  background: {
    default: '${bgDark}',
    paper: '${paperDark}',
  },
  text: {
    primary: '${textPrimaryDark}',
    secondary: '${textSecondaryDark}',
  },
}`;

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Left: controls + previews (scrollable) ── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Theme Playground</Typography>

        {/* Color controls */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>Colores primarios</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <ColorInput label="Primary" value={primaryColor} onChange={setPrimaryColor} />
            <ColorInput label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
          </Box>

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>Light mode</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <ColorInput label="Background" value={bgLight} onChange={setBgLight} />
            <ColorInput label="Text Primary" value={textPrimaryLight} onChange={setTextPrimaryLight} />
            <ColorInput label="Text Secondary" value={textSecondaryLight} onChange={setTextSecondaryLight} />
          </Box>

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>Dark mode</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <ColorInput label="Background" value={bgDark} onChange={setBgDark} />
            <ColorInput label="Paper" value={paperDark} onChange={setPaperDark} />
            <ColorInput label="Text Primary" value={textPrimaryDark} onChange={setTextPrimaryDark} />
            <ColorInput label="Text Secondary" value={textSecondaryDark} onChange={setTextSecondaryDark} />
          </Box>
        </Paper>

        {/* Palettes side by side */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Paper sx={{ flex: 1, overflow: 'hidden' }}>
            <Box sx={{ p: 1, bgcolor: primaryColor, color: '#fff' }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>Primary</Typography>
            </Box>
            {Object.entries(primaryPalette).map(([shade, color]) => (
              <ColorSwatch key={shade} label={shade} color={color} onCopy={handleCopy} />
            ))}
          </Paper>
          <Paper sx={{ flex: 1, overflow: 'hidden' }}>
            <Box sx={{ p: 1, bgcolor: secondaryColor, color: '#fff' }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>Secondary</Typography>
            </Box>
            {Object.entries(secondaryPalette).map(([shade, color]) => (
              <ColorSwatch key={shade} label={shade} color={color} onCopy={handleCopy} />
            ))}
          </Paper>
        </Box>

        {/* Side-by-side previews: light and dark */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Preview de componentes</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <ComponentPreview
            mode="light"
            bg={bgLight}
            paper={bgLight}
            textPrimary={textPrimaryLight}
            textSecondary={textSecondaryLight}
            primary={primaryColor}
            secondary={secondaryColor}
          />
          <ComponentPreview
            mode="dark"
            bg={bgDark}
            paper={paperDark}
            textPrimary={textPrimaryDark}
            textSecondary={textSecondaryDark}
            primary={primaryColor}
            secondary={secondaryColor}
          />
        </Box>
      </Box>

      {/* ── Right: sticky output panel ── */}
      <Box
        sx={{
          width: 380,
          borderLeft: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#1e1e1e',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #333' }}>
          <Typography variant="subtitle2" sx={{ color: '#e8eaed', fontWeight: 700 }}>
            Output — theme/index.ts
          </Typography>
          <Tooltip title="Copiar todo">
            <IconButton size="small" onClick={() => handleCopy(fullOutput)} sx={{ color: '#9aa0a6' }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          component="pre"
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2,
            m: 0,
            color: '#d4d4d4',
            fontSize: '0.75rem',
            fontFamily: '"Fira Code", "Consolas", monospace',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {fullOutput}
        </Box>
      </Box>

      {/* Copied snackbar */}
      <Snackbar open={copied} autoHideDuration={1500} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" sx={{ fontSize: '0.8rem' }}>Copiado al clipboard</Alert>
      </Snackbar>
    </Box>
  );
}
