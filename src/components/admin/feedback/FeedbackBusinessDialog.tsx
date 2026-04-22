import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { Business } from '../../../types';

export interface FeedbackBusinessDialogProps {
  businessDetailId: string | null;
  businessDetail: Business | null;
  onClose: () => void;
}

/**
 * Dialog de detalle de comercio abierto desde una fila de feedback.
 * Extraído de FeedbackList para bajar LOC del archivo orquestador.
 */
export default function FeedbackBusinessDialog({ businessDetailId, businessDetail, onClose }: FeedbackBusinessDialogProps) {
  return (
    <Dialog open={!!businessDetailId} onClose={onClose} maxWidth="xs" fullWidth>
      {businessDetail ? (
        <>
          <DialogTitle>{businessDetail.name}</DialogTitle>
          <DialogContent>
            <List dense disablePadding>
              <ListItem disableGutters>
                <ListItemText primary="ID" secondary={businessDetail.id} />
              </ListItem>
              {businessDetail.address && (
                <ListItem disableGutters>
                  <ListItemText primary="Dirección" secondary={businessDetail.address} />
                </ListItem>
              )}
              {businessDetail.tags && businessDetail.tags.length > 0 && (
                <ListItem disableGutters>
                  <ListItemText
                    primary="Tags"
                    secondary={
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {businessDetail.tags.map((t) => <Chip key={t} label={t} size="small" />)}
                      </Box>
                    }
                  />
                </ListItem>
              )}
            </List>
          </DialogContent>
        </>
      ) : businessDetailId ? (
        <>
          <DialogTitle>Comercio no encontrado</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              ID: {businessDetailId}
            </Typography>
          </DialogContent>
        </>
      ) : null}
    </Dialog>
  );
}
