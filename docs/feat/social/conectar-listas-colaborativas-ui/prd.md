# PRD: Conectar listas colaborativas a la UI

**Feature:** conectar-listas-colaborativas-ui
**Categoria:** social
**Fecha:** 2026-03-29
**Issue:** #229
**Prioridad:** Media

---

## Contexto

El proyecto ya cuenta con componentes frontend (`EditorsDialog`, `InviteEditorDialog`) y Cloud Functions (`inviteListEditor`, `removeListEditor`) para gestionar editores de listas colaborativas, pero estos componentes nunca se montaron en la UI. El backend esta deployado y testeado, y los servicios frontend (`sharedLists.ts`) ya exponen `inviteEditor`, `removeEditor` y `fetchEditorName`. Solo falta conectar las piezas existentes en `ListDetailScreen`.

## Problema

- Los usuarios no pueden invitar editores a sus listas porque no hay ningun punto de entrada visible en la UI
- Los componentes `EditorsDialog` e `InviteEditorDialog` existen pero no estan importados ni renderizados en ninguna pantalla
- `ListDetailScreen` solo muestra acciones de owner (color, visibilidad, compartir, eliminar) pero no tiene acciones de gestion de editores
- La logica de `canEdit` en `ListDetailScreen` solo considera `isOwner`, sin distinguir permisos de editor (los editores deberian poder agregar/quitar items pero no gestionar editores ni configurar la lista)

---

## Solucion

### S1. Montar dialogs en ListDetailScreen

Importar `EditorsDialog` e `InviteEditorDialog` en `ListDetailScreen.tsx`. Agregar estado para controlar la apertura de cada dialog. Pasar `list.editorIds` (del tipo `SharedList`) a `EditorsDialog` y `list.id` a `InviteEditorDialog`. Cuando un editor se agrega o remueve, refrescar los datos de la lista para actualizar `editorIds` en el estado local.

### S2. Agregar botones de accion en la toolbar

En la toolbar de `ListDetailScreen`, agregar dos IconButtons visibles solo para el owner:
- Boton de "gestionar editores" (icono `GroupIcon` o similar) que abre `EditorsDialog`
- Boton de "invitar editor" (icono `PersonAddIcon`) que abre `InviteEditorDialog`

Los botones se ubican junto a los existentes (palette, visibilidad, compartir, eliminar). Si `editorIds` tiene elementos, mostrar un badge con el count en el boton de gestionar editores.

### S3. Distinguir permisos owner vs editor en ListDetailScreen

Actualmente `canEdit = isOwner && !readOnly`. Agregar una variable `isEditor` que sea `true` si el usuario actual esta en `list.editorIds`. Un editor puede:
- Ver la lista y sus items
- Agregar items (desde `AddToListDialog`, que ya existe)
- Quitar items de la lista

Un editor NO puede:
- Cambiar nombre, descripcion, color o icono
- Cambiar visibilidad publica/privada
- Invitar o remover otros editores
- Eliminar la lista
- Compartir el link

Refactorizar la toolbar para que muestre las acciones correctas segun `isOwner` vs `isEditor` vs `readOnly`.

### S4. Refrescar editorIds despues de cambios

Cuando `onEditorRemoved` o `onInvited` se disparan, recargar los datos de la lista (via `fetchSharedList`) para obtener los `editorIds` actualizados del servidor. Actualizar el estado local para que los dialogs reflejen los cambios sin cerrar y reabrir.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Montar `EditorsDialog` en `ListDetailScreen` con estado de apertura | Alta | S |
| Montar `InviteEditorDialog` en `ListDetailScreen` con estado de apertura | Alta | S |
| Agregar IconButtons en toolbar (owner-only) para abrir ambos dialogs | Alta | S |
| Distinguir `isOwner` vs `isEditor` en `ListDetailScreen` (toolbar + item actions) | Alta | S |
| Refrescar `editorIds` despues de invitar/remover editor | Alta | S |
| Verificar flujo end-to-end con emuladores (invite, accept, add item, remove editor) | Alta | S |
| Agregar badge de count de editores en el boton de gestionar | Baja | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Modificar los componentes `EditorsDialog` o `InviteEditorDialog` (ya estan implementados)
- Modificar las Cloud Functions `inviteListEditor` o `removeListEditor` (ya estan deployadas y testeadas)
- Agregar notificaciones al invitar un editor
- Permitir que un editor se auto-remueva de una lista
- Agregar tests para `sharedLists.ts` (deuda tecnica existente, no bloqueante para esta integracion)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/lists/ListDetailScreen.tsx` | Componente | Renderiza botones de editor solo para owner, no para editor ni readOnly. Abre EditorsDialog al click. Abre InviteEditorDialog al click. Editor puede ver boton de quitar item. Editor no ve botones de config (color, visibilidad, delete). |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para la logica `isOwner` vs `isEditor` vs `readOnly`
- Todos los paths condicionales cubiertos (owner ve todo, editor ve items + remove item, readOnly no ve nada)
- Side effects verificados (refetch de lista despues de invite/remove)

---

## Seguridad

Las Cloud Functions y Firestore rules ya estan implementadas y validadas:

- [x] `inviteListEditor` verifica ownership antes de agregar editor
- [x] `removeListEditor` verifica ownership antes de remover editor
- [x] `editorIds` solo escribible via admin SDK (Cloud Functions), no por clientes directos
- [x] Firestore rules de `sharedLists` permiten update por editor solo de `itemCount` y `updatedAt`
- [x] Firestore rules de `listItems` validan que el creador sea owner o editor del parent list
- [x] App Check habilitado en ambas callables (`ENFORCE_APP_CHECK`)

### Verificaciones adicionales requeridas

- [ ] Verificar que `InviteEditorDialog` no expone si un email existe o no (el mensaje de error de la Cloud Function ya es generico: "No se pudo enviar la invitacion")
- [ ] Verificar que un editor no puede llamar a `inviteListEditor` o `removeListEditor` directamente (la CF valida `ownerId !== request.auth.uid`)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `inviteListEditor` callable | Spam de invitaciones | Rate limit callable existente (5/min/user) + max 5 editores por lista |
| `removeListEditor` callable | Remover editores ajenos | CF valida ownership. Ninguna mitigacion adicional requerida |
| Email en `InviteEditorDialog` | Enumeracion de emails | CF devuelve mensaje generico, no revela si el email existe |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| `sharedLists.ts` sin tests (tests.md) | afecta | No bloquea esta integracion pero idealmente se testea el servicio como parte del flujo. Fuera de scope. |

### Mitigacion incorporada

No hay deuda tecnica que se resuelva como parte de este feature. El scope se limita estrictamente a conectar componentes existentes.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Cargar editores (fetchEditorName) | read | Firestore persistent cache | Loading spinner; si falla, muestra "Usuario" como fallback (ya implementado) |
| Invitar editor (Cloud Function) | write | No soportado offline | Boton deshabilitado cuando offline (ya implementado en InviteEditorDialog via `isOffline`) |
| Remover editor (Cloud Function) | write | No soportado offline | Mostrar toast de error si falla |
| Refrescar lista (fetchSharedList) | read | Firestore persistent cache | Datos stale del cache local |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (Firestore persistent cache en prod)
- [x] Writes: las Cloud Functions callable no funcionan offline; `InviteEditorDialog` ya deshabilita el boton via `isOffline`
- [ ] `EditorsDialog` no tiene guard de offline para el boton de remover — considerar agregar
- [x] Datos criticos: `editorIds` viene como parte del `SharedList` doc que ya esta en cache

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (los servicios `inviteEditor`, `removeEditor`, `fetchEditorName` ya estan en `services/sharedLists.ts`)
- [x] Componentes nuevos son reutilizables fuera del contexto actual (los dialogs ya existen y son independientes)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en `EditorsDialog` y `InviteEditorDialog` (ya implementadas)
- [x] Cada prop de accion tiene un handler real (`onEditorRemoved`, `onInvited`, `onClose`)
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos en carpeta de dominio correcta (`components/lists/`)
- [x] No se crea estado global nuevo
- [x] Ningun archivo supera 400 lineas (ListDetailScreen es ~200 lineas, agregamos ~30)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Conecta componentes ya aislados, no agrega imports cruzados |
| Estado global | = | Solo estado local en ListDetailScreen |
| Firebase coupling | = | Servicios ya existentes en services/sharedLists.ts |
| Organizacion por dominio | = | Todo en components/lists/, carpeta correcta |

---

## Success Criteria

1. El owner de una lista puede abrir `InviteEditorDialog` desde `ListDetailScreen` e invitar un editor por email
2. El owner puede abrir `EditorsDialog`, ver la lista de editores y remover cualquiera
3. Un editor puede ver los items de una lista y agregar/quitar items, pero no ve las acciones de configuracion (color, visibilidad, delete, gestionar editores)
4. Despues de invitar o remover un editor, la UI se actualiza sin necesidad de navegar hacia atras y volver
5. El flujo completo funciona end-to-end con emuladores de Firebase
