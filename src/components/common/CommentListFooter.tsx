import { Button, Snackbar } from '@mui/material';
import UserProfileSheet from '../user/UserProfileSheet';

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
}

export default function CommentListFooter({
  deleteSnackbarProps,
  profileUser,
  onCloseProfile,
}: CommentListFooterProps) {
  return (
    <>
      <Snackbar
        open={deleteSnackbarProps.open}
        message={deleteSnackbarProps.message}
        autoHideDuration={deleteSnackbarProps.autoHideDuration}
        onClose={deleteSnackbarProps.onClose}
        action={
          <Button color="primary" size="small" onClick={deleteSnackbarProps.onUndo}>
            Deshacer
          </Button>
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
