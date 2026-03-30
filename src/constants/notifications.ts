import type { NotificationType } from '../types';

export const DIGEST_LABELS: Record<NotificationType, {
  singular: string;
  plural: string;
  icon: string;
}> = {
  comment_reply: { singular: 'respuesta a tu comentario', plural: 'respuestas a tus comentarios', icon: 'ChatBubble' },
  like: { singular: 'me gusta en tu calificación', plural: 'me gusta en tus calificaciones', icon: 'ThumbUp' },
  new_follower: { singular: 'nuevo seguidor', plural: 'nuevos seguidores', icon: 'PersonAdd' },
  ranking: { singular: 'cambio en el ranking', plural: 'cambios en el ranking', icon: 'EmojiEvents' },
  recommendation: { singular: 'nueva recomendación', plural: 'nuevas recomendaciones', icon: 'CardGiftcard' },
  photo_approved: { singular: 'foto aprobada', plural: 'fotos aprobadas', icon: 'CheckCircle' },
  photo_rejected: { singular: 'foto rechazada', plural: 'fotos rechazadas', icon: 'Cancel' },
  feedback_response: { singular: 'respuesta a tu feedback', plural: 'respuestas a tu feedback', icon: 'Feedback' },
};

export const DIGEST_MAX_GROUPS = 3;
