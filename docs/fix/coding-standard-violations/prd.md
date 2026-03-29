# PRD: 3 coding standard violations (large components, noop callbacks, layer breach)

**Feature:** coding-standard-violations
**Categoria:** fix
**Fecha:** 2026-03-29
**Issue:** #227
**Prioridad:** Media

---

## Contexto

Una auditoria de codigo vs documentacion realizada el 2026-03-29 encontro 3 violaciones activas de los coding standards del proyecto. Dos componentes superan el limite de 300 lineas (BusinessComments con 398 y BusinessQuestions con 392), BusinessQuestions usa callbacks noop `() => {}` (prohibido por la politica del proyecto y por ESLint `no-empty-function`), y FollowedList importa un tipo de `firebase/firestore` directamente (violando la regla de service layer). Estas violaciones se acumularon durante los refactors de #195 que redujeron los archivos pero no lo suficiente, y durante la implementacion de follows (#129).

## Problema

- **BusinessComments.tsx (398 lineas)** supera el limite de 300 lineas por componente. Ya tuvo extracciones previas (#195: CommentRow, CommentInput, hooks) pero sigue excediendo el umbral documentado en `coding-standards.md`.
- **BusinessQuestions.tsx (392 lineas)** supera el limite de 300 lineas y contiene 2 callbacks noop (`noopEdit`, `noopEditText`) usados como props de `CommentRow` para funcionalidad de edicion que las preguntas no soportan. Esto viola la politica de "never wire components with noop callbacks" y el ESLint rule `no-empty-function`.
- **FollowedList.tsx (linea 15)** importa `QueryDocumentSnapshot` directamente de `firebase/firestore`. La regla del proyecto dicta que los componentes nunca importen de `firebase/firestore` -- solo `services/`, `hooks/`, `config/` y `context/` pueden hacerlo.

## Solucion

### S1. BusinessComments.tsx (398 -> ~250 lineas)

Extraer logica remanente a subcomponentes o hooks. El archivo ya usa hooks extraidos (`useOptimisticLikes`, `useCommentSort`, `useCommentEdit`, `useCommentThreads`) y subcomponentes (`CommentRow`, `CommentInput`, `InlineReplyForm`). La reduccion requiere extraer la logica de rendering de la lista de comentarios y el manejo de threads expandidos a un subcomponente `CommentThreadList` que encapsule el loop de renderizado + thread expansion.

Patron existente: la decomposicion de #195 (DT-9 pattern) ya establecio como extraer subcomponentes de estos archivos.

### S2. BusinessQuestions.tsx (392 -> ~250 lineas + eliminar noops)

Dos cambios:

1. **Eliminar noops**: `CommentRow` requiere props de edicion (`onStartEdit`, `onSaveEdit`, `onCancelEdit`, `onEditTextChange`) que las preguntas no usan. La solucion es hacer esas props opcionales en `CommentRow` y que el componente no renderice los controles de edicion cuando no se pasan. Esto elimina la necesidad de los 2 callbacks noop y cumple con la politica de "every prop must be functional".

2. **Reducir tamano**: Extraer un subcomponente `QuestionThread` que encapsule el rendering de una pregunta con sus respuestas, similar a como `CommentRow` encapsula un comentario individual. Esto saca el loop de rendering del archivo principal.

### S3. FollowedList.tsx (fix import layer breach)

Mover el tipo `QueryDocumentSnapshot` a la capa correcta. El tipo se usa para tipar el cursor de paginacion. Opciones:

- Opcion A: Mover el tipado al hook/service que produce el cursor, exponiendo un tipo generico o el valor ya transformado.
- Opcion B: Re-exportar el tipo desde un archivo de `types/` o `config/` (ya que los types files pueden importar de firebase).

La opcion A es preferible porque elimina la dependencia transitiva del componente con Firestore SDK.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S2a: Hacer props de edicion opcionales en CommentRow | Alta | S |
| S2b: Eliminar noopEdit/noopEditText de BusinessQuestions | Alta | S |
| S3: Mover QueryDocumentSnapshot fuera de FollowedList | Alta | S |
| S1: Extraer CommentThreadList de BusinessComments | Media | M |
| S2c: Extraer QuestionThread de BusinessQuestions | Media | M |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Refactorizar SettingsPanel o CommentsList (no listados en el issue)
- Agregar funcionalidad de edicion a preguntas (el fix es hacer las props opcionales, no implementar edicion)
- Cambiar la interfaz de CommentRow mas alla de hacer opcionales las props de edicion
- Migrar otros componentes que importen tipos de firebase/firestore (solo FollowedList esta en scope)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/business/CommentRow.tsx` | Componente | Que no renderiza controles de edicion cuando las props opcionales no se pasan |
| `src/components/business/BusinessQuestions.tsx` | Componente | Que compila y funciona sin callbacks noop |
| `src/components/social/FollowedList.tsx` | Componente | Que compila sin import directo de firebase/firestore |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (subcomponentes extraidos)
- Verificar que CommentRow renderiza correctamente en ambos modos (con y sin props de edicion)
- Todos los paths condicionales cubiertos en la logica de optional props
- Side effects verificados (no hay nuevos side effects en este fix)

Nota: el esfuerzo principal de testing es asegurar que el refactor no rompe funcionalidad existente. Los tests de CommentRow existentes deben seguir pasando. Se agregan tests para el nuevo path (props ausentes).

---

## Seguridad

Este fix es puramente de refactorizacion interna. No agrega superficies nuevas, endpoints, ni escrituras a Firestore. No hay consideraciones de seguridad adicionales.

- [x] No se agregan colecciones ni campos nuevos
- [x] No se modifica logica de autenticacion o autorizacion
- [x] No se exponen datos adicionales

### Vectores de ataque automatizado

No aplica. Este fix no expone superficies nuevas.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #195 (split-large-components) | Origen de las extracciones parciales que dejaron los archivos en 398/392 lineas | Continuar el trabajo de #195 hasta cumplir el limite de 300 |

### Mitigacion incorporada

- Eliminar los 2 callbacks noop de BusinessQuestions resuelve una violacion de `no-empty-function`
- Reducir BusinessComments y BusinessQuestions por debajo de 300 lineas resuelve la violacion de file-size-directive
- Mover el import de firebase/firestore fuera de FollowedList resuelve la violacion de layer breach

---

## Offline

### Data flows

No hay data flows nuevos. Este fix es puramente de refactorizacion.

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| N/A | N/A | N/A | N/A |

### Checklist offline

- [x] No aplica: no se agregan lecturas ni escrituras nuevas

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado -- nunca noop `() => {}`
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (`business/`, `social/`)
- [x] Si el feature necesita estado global, evaluar si un contexto existente lo cubre antes de crear uno nuevo
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Reduce acoplamiento: CommentRow ya no requiere noops, FollowedList no depende de firebase SDK |
| Estado global | = | No cambia estado global |
| Firebase coupling | - | Elimina import directo de firebase/firestore en FollowedList |
| Organizacion por dominio | = | Archivos en carpetas existentes correctas |

---

## Success Criteria

1. BusinessComments.tsx tiene menos de 300 lineas y todos los tests existentes pasan
2. BusinessQuestions.tsx tiene menos de 300 lineas y no contiene callbacks noop `() => {}`
3. FollowedList.tsx no importa nada de `firebase/firestore` directamente
4. CommentRow acepta props de edicion opcionales y no renderiza controles de edicion cuando estan ausentes
5. `npm run lint` y `npm run test:run` pasan sin errores
