import { Box, IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import type { useSwipeActions } from '../../hooks/useSwipeActions';
import CommentsListItem from './CommentsListItem';
import type { CommentsListItemProps } from './CommentsListItem';

interface CommentsListItemSwipeableProps extends CommentsListItemProps {
  swipe: ReturnType<typeof useSwipeActions>;
  getSwipeRef: (id: string) => React.RefObject<HTMLElement | null>;
}

export default function CommentsListItemSwipeable({
  swipe, getSwipeRef, ...itemProps
}: CommentsListItemSwipeableProps) {
  const { id } = itemProps;
  const isSwiped = swipe.swipedId === id;
  const itemRef = getSwipeRef(id);
  // eslint-disable-next-line react-hooks/refs -- ref is only read inside touch event callbacks, not during render
  const handlers = swipe.getHandlers(id, itemRef);
  const style = swipe.getStyle(id);

  return (
    <Box
      sx={{ position: 'relative', overflow: 'hidden' }}
      onClick={() => isSwiped && swipe.reset()}
    >
      {isSwiped && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(swipe.direction === 'left'
              ? { right: 0, bgcolor: 'error.main' }
              : { left: 0, bgcolor: 'primary.main' }),
            width: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconButton
            sx={{ color: 'common.white' }}
            onClick={(e) => {
              e.stopPropagation();
              if (swipe.direction === 'left') {
                itemProps.onMarkForDelete(id, itemProps.comment);
              } else {
                itemProps.onStartEdit(itemProps.comment);
              }
              swipe.reset();
            }}
            aria-label={swipe.direction === 'left' ? 'Eliminar' : 'Editar'}
          >
            {swipe.direction === 'left'
              ? <DeleteOutlineIcon />
              : <EditOutlinedIcon />}
          </IconButton>
        </Box>
      )}

      <Box
        ref={itemRef}
        {...handlers}
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          zIndex: 1,
        }}
        style={style}
      >
        <CommentsListItem {...itemProps} />
      </Box>
    </Box>
  );
}
