import { Box, Typography, Button, ButtonBase } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { getListIconById } from '../../constants/listIcons';
import { sanitizeListColor } from './ColorPicker';
import { getContrastText } from '../../utils/contrast';
import { cardSx, iconCircleSx, dashedButtonSx } from '../../theme/cards';
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
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.5 }}>
        {lists.map((list) => {
          const iconData = getListIconById(list.icon);
          const color = sanitizeListColor(list.color);
          return (
            <ButtonBase
              key={list.id}
              aria-label={list.name}
              onClick={() => onListClick(list)}
              sx={{ ...cardSx, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, aspectRatio: '1 / 1', textAlign: 'center', width: '100%' }}
            >
              <Box sx={iconCircleSx(color)}>
                <Typography fontSize={22}>
                  {iconData ? iconData.emoji : <FolderOutlinedIcon sx={{ color: getContrastText(color), fontSize: 22 }} />}
                </Typography>
              </Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 0.5 }} noWrap>
                {list.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {list.itemCount} lugar{list.itemCount !== 1 ? 'es' : ''}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      {onCreateClick && !readOnly && (
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onCreateClick}
          sx={{ mt: 2, ...dashedButtonSx }}
        >
          Crear nueva lista
        </Button>
      )}
    </Box>
  );
}
