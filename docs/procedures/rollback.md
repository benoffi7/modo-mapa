# Procedimiento de Rollback

## Force Update (minVersion en Firestore)

### Cuándo hacer rollback de force-update

Rollback es necesario cuando un deploy introduce una regresión y el `minVersion` en Firestore ya fue actualizado, lo que hace que todos los clientes con versión anterior sean forzados a actualizar hacia una versión con el bug.

### Procedimiento (orden crítico)

**Importante: revertir `minVersion` ANTES del rollback de hosting para evitar que los clientes recarguen hacia la versión con error.**

1. **Identificar la versión estable anterior**

   ```bash
   # Ver historial de deploys en GitHub Actions
   # O consultar git log para la versión anterior
   git log --oneline --grep="chore: bump version" -5
   ```

2. **Revertir `minVersion` en Firestore**

   ```bash
   node scripts/update-min-version.js --set=X.Y.Z
   ```

   Reemplazar `X.Y.Z` con la versión estable anterior. Este paso detiene inmediatamente el force-update hacia la versión con error.

3. **Rollback de hosting** (Firebase Hosting)

   Desde la consola de Firebase o CLI:

   ```bash
   firebase hosting:releases:rollback
   ```

   O redeployar el commit anterior:

   ```bash
   git checkout <commit-estable>
   firebase deploy --only hosting
   ```

4. **Verificar**

   - Abrir la app en una tab nueva (sin caché)
   - Verificar que `document.title` o el número de versión visible refleja la versión estable
   - Verificar en Firebase Console > Firestore > `config/appVersion` que `minVersion` es la versión correcta

5. **Post-rollback**

   - Crear issue con la regresión
   - El próximo deploy (con el fix) actualizará `minVersion` automáticamente vía CI

### Notas

- El script `update-min-version.js` con `--set=X.Y.Z` requiere service account con permisos de escritura a Firestore. En local, necesita `GOOGLE_APPLICATION_CREDENTIALS` configurado.
- Si el rollback de hosting falla, el paso 2 (revertir `minVersion`) sigue siendo suficiente para detener el force-update: los clientes con la versión nueva no son afectados por force-update, y los clientes con versión vieja ya tenían la versión estable.
- El busy-flag (`STORAGE_KEY_FORCE_UPDATE_BUSY`) protege uploads in-flight: si un usuario está en medio de un upload cuando se hace el rollback, no será interrumpido.
