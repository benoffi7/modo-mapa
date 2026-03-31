import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

interface ConfigDocViewerProps {
  docId: string;
  data: Record<string, unknown>;
}

function formatValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) {
    return <Typography variant="body2" color="text.secondary" component="span">null</Typography>;
  }

  if (typeof value === 'number') {
    return <Typography variant="body2" component="span">{value.toLocaleString()}</Typography>;
  }

  if (typeof value === 'boolean') {
    return <Typography variant="body2" component="span">{String(value)}</Typography>;
  }

  if (typeof value === 'string') {
    // Try to detect ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        const d = new Date(value);
        return (
          <Typography variant="body2" component="span">
            {d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })}
          </Typography>
        );
      } catch {
        // fall through
      }
    }
    return <Typography variant="body2" component="span">{value}</Typography>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Typography variant="body2" color="text.secondary" component="span">[]</Typography>;
    }
    return (
      <List dense disablePadding sx={{ pl: depth > 0 ? 2 : 0 }}>
        {value.map((item, i) => (
          <ListItem key={i} disableGutters sx={{ py: 0 }}>
            <ListItemText primary={formatValue(item, depth + 1)} />
          </ListItem>
        ))}
      </List>
    );
  }

  if (typeof value === 'object') {
    // Firestore Timestamp-like objects
    const obj = value as Record<string, unknown>;
    if ('seconds' in obj && 'nanoseconds' in obj) {
      const d = new Date((obj.seconds as number) * 1000);
      return (
        <Typography variant="body2" component="span">
          {d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })}
        </Typography>
      );
    }

    return (
      <Box sx={{ pl: depth > 0 ? 2 : 0 }}>
        {Object.entries(obj).map(([k, v]) => (
          <Box key={k} sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight="bold" component="span">{k}: </Typography>
            {formatValue(v, depth + 1)}
          </Box>
        ))}
      </Box>
    );
  }

  return <Typography variant="body2" component="span">{JSON.stringify(value)}</Typography>;
}

export default function ConfigDocViewer({ data }: ConfigDocViewerProps) {
  return (
    <Box>
      {Object.entries(data).map(([key, value]) => (
        <Box key={key} sx={{ mb: 1 }}>
          <Typography variant="body2" fontWeight="bold" component="span">{key}: </Typography>
          {formatValue(value)}
        </Box>
      ))}
    </Box>
  );
}
