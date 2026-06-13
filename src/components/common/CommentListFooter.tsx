import { useState } from 'react';
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
  // #340 W1: congelamos el modo offline AL ABRIR el snackbar. Si la conectividad
  // cambia (online→offline) durante la ventana de undo de 5s, el boton "Deshacer"
  // NO debe desaparecer: la acción ya quedó en curso con el modo del momento.
  // Patrón "adjust state during render": al detectar la transición CERRADO→ABIERTO
  // recongelamos isOffline; mientras sigue abierto, ignoramos sus cambios.
  const isSnackbarOpen = deleteSnackbarProps.open;
  const [prevOpen, setPrevOpen] = useState(isSnackbarOpen);
  const [frozenOffline, setFrozenOffline] = useState(isOffline);
  if (isSnackbarOpen !== prevOpen) {
    setPrevOpen(isSnackbarOpen);
    if (isSnackbarOpen) setFrozenOffline(isOffline);
  }

  const message = frozenOffline
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
          frozenOffline ? undefined : (
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
