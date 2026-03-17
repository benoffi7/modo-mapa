# Plan: Sugerencias contextuales para usuarios nuevos

**Specs:** [Specs](./specs.md)
**Branch:** `feat/sugerencias-contextuales`

---

## Pasos de implementacion

### Paso 1: Constantes de localStorage

1. En `src/constants/storage.ts`, agregar:
   ```typescript
   export const STORAGE_KEY_HINT_FIRST_RATING = 'hint_shown_first_rating';
   export const STORAGE_KEY_HINT_POST_FIRST_RATING = 'hint_shown_post_first_rating';
   export const STORAGE_KEY_HINT_POST_FIRST_COMMENT = 'hint_shown_post_first_comment';
   ```

### Paso 2: MapHint en AppShell (S1)

1. Agregar imports: `Snackbar`, `Alert`, `IconButton`, `CloseIcon`, `useAuth`, `useUserProfile`, `useSelection` (ya importado), `AUTO_DISMISS_MS`, `STORAGE_KEY_HINT_FIRST_RATING`
2. Crear componente local `MapHint`:
   - Lee `localStorage.getItem(STORAGE_KEY_HINT_FIRST_RATING)` en `useState` inicializador
   - Si ya mostrado, retorna `null`
   - Usa `useAuth()` para obtener `user` y `displayName`
   - Usa `useUserProfile(user?.uid, displayName)` para obtener `profile`
   - Si `!profile` o `profile.stats.ratings > 0`, retorna `null`
   - Renderiza `Snackbar` con `Alert severity="info"` y texto "Toca un comercio en el mapa para calificarlo"
   - `autoHideDuration={AUTO_DISMISS_MS}` (5000ms)
   - `onClose` setea localStorage flag y oculta
3. Agregar efecto: cuando `selectedBusiness` pasa de null a no-null, cerrar el hint (setear flag + ocultar)
4. Renderizar `<MapHint />` dentro del `Box` de AppShell, despues de `<NameDialog />`

### Paso 3: Toast post-primer-rating (S2)

1. En `BusinessRating.tsx`, agregar import de `STORAGE_KEY_HINT_POST_FIRST_RATING`
2. En `handleRate`, despues del `await upsertRating` exitoso:
   ```typescript
   if (serverMyRating === null && localStorage.getItem(STORAGE_KEY_HINT_POST_FIRST_RATING) !== 'true') {
     localStorage.setItem(STORAGE_KEY_HINT_POST_FIRST_RATING, 'true');
     toast.info('Genial! Tambien podes dejar un comentario.');
   }
   ```
3. La condicion `serverMyRating === null` garantiza que solo se dispara en la primera calificacion a este comercio. Combinada con el flag de localStorage, se muestra como maximo una vez globalmente.

### Paso 4: Toast post-primer-comentario (S3)

1. En `BusinessComments.tsx`, agregar import de `STORAGE_KEY_HINT_POST_FIRST_COMMENT`
2. En el handler de submit (despues del `await addComment` exitoso):
   ```typescript
   if (localStorage.getItem(STORAGE_KEY_HINT_POST_FIRST_COMMENT) !== 'true') {
     localStorage.setItem(STORAGE_KEY_HINT_POST_FIRST_COMMENT, 'true');
     toast.info('Guarda tus favoritos tocando el corazon.');
   }
   ```

### Paso 5: Verificacion

1. `npx tsc --noEmit` — sin errores de tipos
2. `npm run lint` — sin warnings nuevos
3. `npm run test:run` — tests existentes pasan
4. Test manual:
   - Usuario nuevo (0 ratings): ver hint en el mapa al cargar
   - Tocar marker: hint desaparece
   - Calificar: ver toast "tambien podes dejar un comentario"
   - Comentar: ver toast "guarda tus favoritos"
   - Recargar: ninguna sugerencia aparece de nuevo

---

## Criterios de completitud

- [ ] Hint "Toca un comercio" visible para usuarios con 0 ratings
- [ ] Hint se auto-dismissea a los 5 segundos
- [ ] Hint se cierra al seleccionar un marker
- [ ] Toast post-primer-rating aparece una vez
- [ ] Toast post-primer-comentario aparece una vez
- [ ] Recargar la app no vuelve a mostrar ninguna sugerencia
- [ ] No interfiere con OnboardingChecklist existente
- [ ] 3 keys nuevas en `constants/storage.ts`
- [ ] Compilacion limpia (tsc + lint + tests)
