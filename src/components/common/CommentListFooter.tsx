import { Button, Snackbar } from '@mui/material';
import UserProfileSheet from '../user/UserProfileSheet';
import { MSG_OFFLINE } from '../../constants/messages';

interface DeleteSnackbarProps {
  open: boolean;
  message: string;
  onUndo: () => void;
  autoHideDuration: number;
  onClose: () => void;
}

interface CommentListFooterProps {
  deleteSnackbarProps: DeleteSnackbarProps;
  profileUser: { id: string; name: string } | null;
  onCloseProfile: () => void;
  /** Cuando offline: snackbar muestra copy "Eliminado offline..." y omite "Deshacer" (#323 S3.1). */
  isOffline?: boolean;
}

export default function CommentListFooter({
  deleteSnackbarProps,
  profileUser,
  onCloseProfile,
  isOffline = false,
}: CommentListFooterProps) {
  const message = isOffline
    ? MSG_OFFLINE.commentDeletedOffline
    : deleteSnackbarProps.message;

  return (
    <>
      <Snackbar
        open={deleteSnackbarProps.open}
        message={message}
        autoHideDuration={deleteSnackbarProps.autoHideDuration}
        onClose={deleteSnackbarProps.onClose}
        action={
          isOffline ? undefined : (
            <Button color="primary" size="small" onClick={deleteSnackbarProps.onUndo}>
              Deshacer
            </Button>
          )
        }
      />

      <UserProfileSheet
        userId={profileUser?.id ?? null}
        {...(profileUser?.name != null && { userName: profileUser.name })}
        onClose={onCloseProfile}
      />
    </>
  );
}
