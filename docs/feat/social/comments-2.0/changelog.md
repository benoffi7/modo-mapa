# Changelog — Comentarios 2.0 + Compartir comercio

## Archivos creados

| Archivo | Descripcion |
|---------|-------------|
| `src/components/business/ShareButton.tsx` | Boton compartir comercio (Web Share API + clipboard) |
| `functions/src/triggers/commentLikes.ts` | Triggers onCreate/onDelete para likes (likeCount +/- counters) |
| `docs/feat-comments-2.0/prd.md` | PRD de la feature |
| `docs/feat-comments-2.0/specs.md` | Especificaciones tecnicas |
| `docs/feat-comments-2.0/plan.md` | Plan de implementacion |
| `docs/feat-comments-2.0/changelog.md` | Este archivo |

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `src/types/index.ts` | `Comment.updatedAt?`, `Comment.likeCount`, nuevo `CommentLike` interface |
| `src/config/collections.ts` | Agregado `COMMENT_LIKES` |
| `src/config/converters.ts` | `commentConverter` con likeCount/updatedAt, nuevo `commentLikeConverter` |
| `src/services/comments.ts` | `editComment`, `likeComment`, `unlikeComment` |
| `src/services/index.ts` | Exports de nuevas funciones |
| `src/hooks/useBusinessData.ts` | Fetch user likes por comentario, retorna `userCommentLikes: Set<string>` |
| `src/hooks/useBusinessDataCache.ts` | `userCommentLikes` en `BusinessCacheEntry` |
| `src/components/business/BusinessComments.tsx` | Edicion inline, undo delete, likes optimistas, sorting chips |
| `src/components/business/BusinessSheet.tsx` | Pasa `userCommentLikes` y renderiza `ShareButton` |
| `src/components/business/BusinessHeader.tsx` | Prop `shareButton?` |
| `src/components/layout/AppShell.tsx` | Deep link `?business={id}` via useSearchParams |
| `src/components/menu/CommentsList.tsx` | Undo delete (reemplaza dialog de confirmacion) |
| `firestore.rules` | Update rule para comments, nueva coleccion commentLikes |
| `functions/src/triggers/comments.ts` | `onCommentUpdated` trigger (re-moderacion) |
| `functions/src/index.ts` | Exports: `onCommentUpdated`, `onCommentLikeCreated`, `onCommentLikeDeleted` |
| `scripts/seed-admin-data.mjs` | Migrado a firebase-admin SDK, datos de likes y likeCount |
| `package.json` | Version bump 1.5.1 -> 2.0.0 |
| `docs/PROJECT_REFERENCE.md` | Actualizado con nuevas features, colecciones, patrones |
