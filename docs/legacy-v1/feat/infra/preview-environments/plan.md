# Plan: Preview environments para PRs

## Paso 1: Crear el workflow

Crear `.github/workflows/preview.yml` con la configuracion descrita en `specs.md`:

- Trigger en `pull_request` (opened, synchronize, reopened) a `main`.
- Steps: checkout, setup node, npm ci, lint, test, build, deploy preview.
- Usar `FirebaseExtended/action-hosting-deploy@v0` sin `channelId` y con `expires: 7d`.

## Paso 2: Test — Abrir un PR

Abrir un PR de prueba (puede ser un cambio trivial como agregar un comentario en el
codigo) para verificar que el workflow se ejecuta.

## Paso 3: Verificar comentario en el PR

Confirmar que el action de Firebase comenta automaticamente en el PR con la URL del
preview channel.

## Paso 4: Verificar la URL del preview

Abrir la URL generada y verificar que:

- La app carga correctamente.
- El mapa se renderiza con los marcadores.
- La autenticacion anonima funciona.
- Los datos de Firestore se cargan (favoritos, ratings, comentarios).

## Paso 5: Verificar auto-expiracion

Despues de 7 dias, verificar en Firebase Console que el preview channel fue eliminado
automaticamente (o confiar en la configuracion `expires: 7d` de Firebase).

## Estimacion

~30 minutos para implementar y probar.
