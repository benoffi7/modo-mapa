# PRD: Conectar IconPicker a la UI de listas

**Feature:** conectar-iconpicker-listas
**Categoria:** content
**Fecha:** 2026-03-29
**Issue:** #230
**Prioridad:** Media

---

## Contexto

El proyecto ya cuenta con un componente `IconPicker` completo (`src/components/lists/IconPicker.tsx`) y constantes de iconos (`src/constants/listIcons.ts` con 30 opciones), pero nunca fueron montados en la UI. El tipo `SharedList` ya tiene el campo `icon?: string` y las Firestore rules de `sharedLists` ya incluyen `icon` en el whitelist tanto de `create` como de `update`. `ListCardGrid` ya consume `getListIconById(list.icon)` para mostrar el emoji si existe. Lo unico que falta es conectar el picker al flujo de creacion/edicion y persistir la seleccion.

## Problema

- Los usuarios no tienen forma de elegir un icono para sus listas, a pesar de que el componente ya existe
- Las listas sin icono muestran un `FolderOutlinedIcon` generico en `ListCardGrid`, lo cual reduce la diferenciacion visual entre listas
- El servicio `createList` y `updateList` no pasan el campo `icon` a Firestore, por lo que aunque se eligiera un icono no se persistiria

## Solucion

### S1: Montar IconPicker en CreateListDialog

Agregar un boton de seleccion de icono en `CreateListDialog`. El boton muestra el emoji seleccionado (o un placeholder). Al hacer click, abre `IconPicker`. Al seleccionar, el emoji aparece en el boton y se pasa a `createList` al confirmar.

- Boton debajo del campo "Descripcion", con layout horizontal: emoji + texto "Elegir icono"
- Si ya hay icono seleccionado, mostrar el emoji y un label "Cambiar icono"
- Patron existente: mismo approach que `ColorPicker` en `ListDetailScreen`

### S2: Montar IconPicker en ListDetailScreen

Agregar un boton de icono en la toolbar de `ListDetailScreen`, junto al boton de color existente. Solo visible para el owner (canEdit). Al cambiar icono, persistir con `updateList` y hacer optimistic update local.

- Boton en la toolbar, al lado del `PaletteOutlinedIcon`
- Mostrar el emoji actual o un icono generico (`InsertEmoticonOutlined`) si no hay icono
- Al seleccionar, actualizar estado local (`currentIcon`) y llamar a `updateList`
- Propagar el cambio al parent via `onBack` (igual que `currentColor`)

### S3: Actualizar servicio sharedLists

- `createList`: aceptar parametro opcional `icon?: string`, validar contra `VALID_ICON_IDS` antes de enviar
- `updateList`: aceptar parametro opcional `icon?: string`, incluir en el objeto de update
- Validacion client-side: solo IDs validos de `LIST_ICON_OPTIONS` (usar `getListIconById` para validar)

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S3: Agregar `icon` a `createList` y `updateList` en servicio | Alta | S |
| S1: Montar IconPicker en CreateListDialog con boton | Alta | S |
| S2: Montar IconPicker en ListDetailScreen toolbar | Alta | S |
| Propagar `icon` en `onBack` de ListDetailScreen | Alta | S |
| Propagar `icon` en `onCreated` de CreateListDialog | Media | S |
| Analytics event `list_icon_changed` | Baja | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Crear iconos custom (subir imagen propia) — esto seria un feature independiente
- Agregar mas opciones de iconos a `LIST_ICON_OPTIONS` — la lista actual de 30 es suficiente
- Mostrar el icono en deep links o previews de listas compartidas
- Modificar el componente `IconPicker` en si (ya esta completo y funcional)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/sharedLists.ts` | Service | `createList` con icon, `updateList` con icon, validacion de icon ID invalido |
| `src/constants/listIcons.ts` | Util | `getListIconById` con IDs validos, invalidos, undefined, strings vacios |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para `icon` ID (solo IDs del set valido)
- Todos los paths condicionales cubiertos (con icon, sin icon, icon invalido)
- Side effects verificados (cache invalidation, analytics)

---

## Seguridad

- [x] Firestore rules ya incluyen `icon` en `hasOnly()` de create y update para `sharedLists`
- [x] Firestore rules ya validan ownership en update (`isListOwner()`)
- [ ] Validar client-side que el icon ID pertenece al set `LIST_ICON_OPTIONS` antes de escribir (prevenir inyeccion de strings arbitrarios)

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `updateList` con icon arbitrario | Inyectar strings que no son icon IDs validos | Validacion client-side con `getListIconById`. Firestore rules aceptan cualquier string en `icon` (no validan contra set) — riesgo bajo porque el campo solo se usa para lookup de emoji, IDs invalidos simplemente no muestran icono |

### Nota sobre Firestore rules

Las rules actuales permiten cualquier string en `icon`. Esto es aceptable porque:

1. `getListIconById` retorna `undefined` para IDs no reconocidos, y `ListCardGrid` ya maneja este caso mostrando `FolderOutlinedIcon`
2. El campo no se renderiza como HTML (solo como emoji via JSX)
3. Agregar validacion server-side de icon IDs en rules requeriria hardcodear la lista en las rules, lo cual es fragil

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| Firestore rules field whitelist audit (backlog deuda tecnica) | ya mitigado | `sharedLists` ya tiene `icon` en el whitelist de create y update |
| `sharedLists.ts` sin tests (tests.md) | empeora si no se considera | Agregar tests para las funciones modificadas (`createList`, `updateList`) |

### Mitigacion incorporada

- Agregar tests para `createList` y `updateList` como parte de este feature, reduciendo la deuda de test coverage del servicio `sharedLists.ts`

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Crear lista con icono | write | Firestore persistent cache encola la escritura | Toast de error si falla, lista aparece sin icono |
| Cambiar icono de lista existente | write | Firestore persistent cache encola la escritura | Optimistic UI muestra el icono nuevo, revierte si falla |
| Mostrar icono en ListCardGrid | read | Dato viene del cache de listas ya cargadas | `FolderOutlinedIcon` si no hay icono |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (listas ya se cargan con persistent cache)
- [x] Writes: tienen optimistic UI (mismo patron que color)
- [x] APIs externas: N/A (no hay APIs externas involucradas)
- [x] UI: el fallback a `FolderOutlinedIcon` funciona como indicador implicito
- [x] Datos criticos: iconos son datos decorativos, no criticos

### Esfuerzo offline adicional: S

No se requiere esfuerzo adicional. El patron existente de Firestore persistent cache + optimistic UI cubre este caso.

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services: la persistencia va en `services/sharedLists.ts`
- [x] Componentes nuevos son reutilizables: no se crean componentes nuevos, se usa `IconPicker` existente
- [x] No se agregan useState de logica de negocio a TabShell o MapAppShell
- [x] Props explicitas: `IconPicker` ya usa props explicitas (`open`, `onClose`, `onSelect`, `selectedId`)
- [x] Cada prop de accion tiene handler real: `onSelect` conectara a `updateList`/`createList`
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos modificados estan en carpeta de dominio correcta (`components/lists/`, `services/`)
- [x] No se necesita estado global nuevo
- [x] Ningun archivo nuevo (solo modificaciones)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Se conectan componentes existentes, no se crean dependencias nuevas |
| Estado global | = | Estado del icono es local a cada dialog/screen |
| Firebase coupling | = | Escrituras van por service layer existente |
| Organizacion por dominio | = | Todo queda en `lists/` y `services/` |

---

## Success Criteria

1. El usuario puede elegir un icono al crear una lista nueva desde `CreateListDialog`
2. El usuario puede cambiar el icono de una lista existente desde `ListDetailScreen`
3. El icono seleccionado persiste en Firestore y se muestra en `ListCardGrid` al recargar
4. Si no se elige icono, el comportamiento actual (FolderOutlinedIcon) se mantiene sin regresion
5. Tests cubren >= 80% del codigo nuevo en `sharedLists.ts` para los paths con `icon`
