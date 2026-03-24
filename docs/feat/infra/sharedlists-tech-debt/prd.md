# PRD: SharedListsView tech debt — reducir tamano y mover queries a service

**Feature:** sharedlists-tech-debt
**Categoria:** infra
**Fecha:** 2026-03-24
**Issue:** #175
**Prioridad:** Media

---

## Contexto

`SharedListsView.tsx` tiene 703 lineas, superando el limite de 400 de la directiva de tamano de archivos. Ademas, importa Firestore SDK directamente (getDoc, getDocs, query, where, orderBy, db) bypaseando el service layer existente en `services/sharedLists.ts`. Detectado durante el merge audit de #174.

## Problema

- El componente tiene 703 lineas, casi el doble del limite de 400
- Importa `firebase/firestore` directamente en lineas 52-54, violando el patron de service layer
- Mezcla logica de fetching (featured lists, shared-with-me) con UI de presentacion
- Dificil de mantener y testear por su tamano

## Solucion

### S1. Mover queries inline a services/sharedLists.ts

Mover las queries de Firestore que estan inline en el componente al service existente. Esto incluye las queries para cargar listas por deep link y listas de otros usuarios.

### S2. Extraer subcomponentes

Extraer secciones autocontenidas del componente:

- `CreateListDialog` — dialog de crear nueva lista (estado + validacion + JSX)
- `FeaturedListsSection` — seccion horizontal de listas destacadas
- `SharedWithMeSection` — seccion de listas compartidas conmigo

### S3. Extraer hook useSharedListActions

Mover la logica de copy list y add-all-to-favorites a un hook `useSharedListActions` que encapsule estas operaciones batch.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1. Mover queries a services/sharedLists.ts | Must | S |
| S2. Extraer CreateListDialog | Must | S |
| S2. Extraer FeaturedListsSection | Must | S |
| S2. Extraer SharedWithMeSection | Must | S |
| S3. Extraer useSharedListActions | Should | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Cambiar la logica de negocio de listas compartidas
- Agregar tests a SharedListsView (deuda existente, no parte de este refactor)
- Modificar services/sharedLists.ts mas alla de agregar las funciones movidas
- Cambiar la UI visual

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/sharedLists.ts` | Service | Funciones nuevas movidas del componente |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo en services
- Tests existentes pasan sin modificacion
- Las funciones movidas al service mantienen la misma firma/comportamiento

---

## Seguridad

- [ ] Las queries movidas al service mantienen los mismos filtros de auth/ownership
- [ ] No se exponen datos de listas privadas de otros usuarios

---

## Offline

### Data flows

No hay cambios en data flows. Solo se mueve donde vive el codigo.

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion

Este PRD ES un refactor de modularizacion. El resultado debe cumplir:

### Checklist modularizacion

- [ ] Queries de Firestore exclusivamente en services/sharedLists.ts
- [ ] Subcomponentes extraidos reciben datos via props
- [ ] Hook useSharedListActions encapsula operaciones batch
- [ ] SharedListsView queda como orquestador sin logica de fetching inline

---

## Success Criteria

1. SharedListsView <= 400 lineas
2. 0 imports de `firebase/firestore` en SharedListsView
3. Todos los tests existentes pasan
4. Build exitoso
5. La funcionalidad es identica visualmente
