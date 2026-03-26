import { Box, Typography, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { getListIconById } from '../../constants/listIcons';
import type { SharedList } from '../../types';

interface Props {
  lists: SharedList[];
  onListClick: (list: SharedList) => void;
  onCreateClick?: (() => void) | undefined;
  readOnly?: boolean;
}

export default function ListCardGrid({ lists, onListClick, onCreateClick, readOnly }: Props) {
  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {lists.map((list) => {
          const iconData = getListIconById(list.icon);
          const color = list.color || '#1e88e5';
          return (
            <Box
              key={list.id}
              onClick={() => onListClick(list)}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                p: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography fontSize={22}>
                  {iconData ? iconData.emoji : <FolderOutlinedIcon sx={{ color: 'common.white', fontSize: 22 }} />}
                </Typography>
              </Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 0.5 }} noWrap>
                {list.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {list.itemCount} lugar{list.itemCount !== 1 ? 'es' : ''}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {onCreateClick && !readOnly && (
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
          sx={{
            mt: 2,
            borderStyle: 'dashed',
            py: 1.5,
            color: 'text.secondary',
            borderColor: 'divider',
          }}
        >
          Crear nueva lista
        </Button>
      )}
    </Box>
  );
}
