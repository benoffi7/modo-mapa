# PRD: Preview environments para PRs

## Problema

Actualmente, el unico deploy ocurre cuando se hace merge a `main`. No existe forma de
previsualizar cambios de un PR antes de mergearlo. Esto obliga a revisar el codigo sin
poder interactuar con la app, lo que aumenta el riesgo de mergear bugs visuales o de
interaccion.

## Solucion

Usar **Firebase Hosting preview channels** para generar automaticamente una URL de
preview por cada Pull Request. Firebase Hosting soporta esto de forma nativa con el
action `FirebaseExtended/action-hosting-deploy@v0`.

## Funcionamiento

- Cada PR que apunte a `main` dispara un workflow de GitHub Actions.
- El workflow hace build y deploy a un **preview channel** de Firebase Hosting.
- Firebase genera una URL unica por PR, por ejemplo:
  `modo-mapa-app--pr123-abc123.web.app`
- El action comenta automaticamente en el PR con la URL del preview.
- El preview **expira automaticamente a los 7 dias**.

## Alcance

### Incluido

- URL de preview automatica por cada PR (open, synchronize, reopen).
- Lint y tests corren antes del deploy (mismos checks que produccion).
- Build con las mismas variables de entorno que produccion (secrets de GitHub).
- Comentario automatico en el PR con el link al preview.
- Auto-expiracion del preview channel a los 7 dias.

### Fuera de alcance

- Base de datos Firestore separada por preview (ver issue #29 para staging completo).
- Deploy de Cloud Functions por PR.
- Deploy de Firestore rules/indexes por PR.
- Datos de prueba aislados por preview.

## Nota importante

Los preview environments comparten la **misma base de datos Firestore, Auth y Cloud
Functions** que produccion. Son exclusivamente para previsualizar cambios de frontend.
Esto es diferente del issue #29, que propone un staging environment completo con base de
datos separada.

## Archivos afectados

- **Crear:** `.github/workflows/preview.yml`
- **Modificar:** ninguno

## Complejidad

Baja (~30 minutos). Firebase Hosting preview channels ya estan soportados por el action
existente.
