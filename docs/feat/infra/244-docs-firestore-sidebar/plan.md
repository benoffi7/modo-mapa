# Plan: Docs: actualizar firestore.md + limpiar sidebar

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Actualizar firestore.md — colecciones faltantes

**Branch:** `feat/244-docs-firestore-sidebar`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Agregar 8 filas a la tabla de colecciones: `checkins`, `follows`, `recommendations`, `sharedLists`, `listItems`, `specials`, `achievements`, `_ipRateLimits`. Seguir formato existente (Doc ID, Campos, Reglas). Campos extraidos de `firestore.rules` y `src/types/`. |
| 2 | `docs/reference/firestore.md` | Agregar 1 fila a la tabla de subcollections: `activityFeed/{userId}/items`. |
| 3 | `docs/reference/firestore.md` | Agregar tipos TypeScript al bloque "Tipos principales": `CheckIn`, `Follow`, `ActivityFeedItem`, `Recommendation`, `SharedList`, `ListItem`, `Special`, `AchievementCondition`, `Achievement`. Copiar de `src/types/index.ts` y `src/types/admin.ts`. |
| 4 | `docs/reference/firestore.md` | Agregar converters faltantes a la seccion "Converters": `checkinConverter`, `sharedListConverter`, `listItemConverter`, `followConverter`, `activityFeedConverter`, `recommendationConverter`, `specialConverter`, `achievementConverter`. |

### Fase 2: Actualizar firestore.md — campos faltantes en colecciones existentes

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Actualizar fila `users` en tabla: agregar `displayNameLower`, `avatarId?`, `followersCount (server)`, `followingCount (server)` a la lista de campos. |
| 2 | `docs/reference/firestore.md` | Actualizar tipo `UserProfile` en seccion de tipos: no tiene `displayNameLower` ni `avatarId`. Agregar ambos como opcionales + comentario sobre followersCount/followingCount server-only. |
| 3 | `docs/reference/firestore.md` | Actualizar fila `userSettings` en tabla: agregar `notifyFollowers`, `notifyRecommendations`, `locality?`, `localityLat?`, `localityLng?`. |
| 4 | `docs/reference/firestore.md` | Actualizar tipo `UserSettings` en seccion de tipos: agregar los 5 campos faltantes. |
| 5 | `docs/reference/firestore.md` | Actualizar fila `feedback` en tabla: agregar `rating? (1-5)`, `businessId?`, `businessName? (1-100)`. Corregir `mediaType` de `(image/video)` a `(image/pdf)`. |
| 6 | `docs/reference/firestore.md` | Actualizar tipo `Feedback` en seccion de tipos: agregar `rating?: number`, `businessId?: string`, `businessName?: string`. Corregir `mediaType` de `'image' \| 'video'` a `'image' \| 'pdf'`. |
| 7 | `docs/reference/firestore.md` | Actualizar fila `comments` en tabla: agregar `type? ('comment'/'question')`. |
| 8 | `docs/reference/firestore.md` | Actualizar tipo `Comment` en seccion de tipos: agregar `type?: 'comment' \| 'question'`. |

### Fase 3: Limpiar sidebar de links rotos

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/_sidebar.md` | Reescribir el archivo completo manteniendo SOLO las entradas cuyo archivo destino existe en disco. Eliminar las 224 entradas rotas. Eliminar secciones vacias (Admin completa, Postmortem, Issues). Mantener estructura: Reference, Procedures, Content, Infra, Security, Social, Discovery, UX, Fixes, Reports, Legacy PRDs, Tech Debt New Home. |
| 2 | `docs/_sidebar.md` | Agregar entradas de specs y plan de este issue (#244) en la seccion Infra. |

### Fase 4: Actualizar datos desactualizados en reference docs

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/project-reference.md` | Cambiar version de `2.32.0` a `2.32.1` en linea 3. |
| 2 | `docs/reference/project-reference.md` | Cambiar "11 tabs" a "16 tabs" en la descripcion del admin (linea 71). Agregar Social, Especiales, Logros a la lista de tabs mencionadas. |
| 3 | `docs/reference/features.md` | Cambiar "13 tabs" a "16 tabs" en linea 197. |
| 4 | `docs/reference/features.md` | Agregar 3 filas a la tabla de tabs admin: Social, Especiales, Logros (despues de Notificaciones, linea 213). |

### Fase 5: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar script de verificacion de links: `grep -oP '\(/[^)]+\.md\)' docs/_sidebar.md \| tr -d '()' \| while read link; do file="docs${link}"; if [ ! -f "$file" ]; then echo "BROKEN: $link"; fi; done`. Debe dar 0 resultados. |
| 2 | N/A | Verificar que todas las colecciones de `firestore.rules` tienen entrada en la tabla de `firestore.md`. |

### Fase 6: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Ya actualizado en Fases 1-2 (este ES el archivo principal de este issue) |
| 2 | `docs/_sidebar.md` | Ya actualizado en Fase 3. Agregar entradas de specs.md y plan.md de #244 |

---

## Orden de implementacion

1. `docs/reference/firestore.md` — Agregar colecciones faltantes (Fase 1)
2. `docs/reference/firestore.md` — Completar campos faltantes (Fase 2)
3. `docs/_sidebar.md` — Limpiar links rotos (Fase 3)
4. `docs/reference/project-reference.md` — Corregir version y tabs (Fase 4)
5. `docs/reference/features.md` — Corregir tabs y agregar filas (Fase 4)
6. Verificacion manual (Fase 5)

No hay dependencias entre fases; pueden ejecutarse en cualquier orden. El orden propuesto agrupa por tipo de cambio.

---

## Estimacion de tamano de archivos resultantes

| Archivo | Tamano actual (aprox) | Tamano estimado post-cambio | > 400 lineas? |
|---------|----------------------|---------------------------|---------------|
| `docs/reference/firestore.md` | ~315 lineas | ~470 lineas | Si, pero es referencia de schema — no aplica decomposicion |
| `docs/_sidebar.md` | ~561 lineas | ~280 lineas (eliminando 224 links rotos) | No |
| `docs/reference/project-reference.md` | ~80 lineas | ~80 lineas | No |
| `docs/reference/features.md` | ~300 lineas | ~310 lineas | No |

Nota: `firestore.md` superaria 400 lineas pero es un archivo de referencia de datos, no codigo. El file-size-directive aplica a archivos de codigo fuente (.ts/.tsx), no a documentacion de referencia.

---

## Riesgos

1. **Informacion desactualizada en los tipos agregados**: Si los tipos en `src/types/` cambiaron desde la ultima vez que se verificaron, la documentacion podria quedar inconsistente. Mitigacion: los tipos se copian directamente del codigo fuente actual, no de memoria.

2. **Secciones de sidebar eliminadas que alguien referencia**: Si algun documento externo linkea a una seccion de la sidebar que se elimina, ese link se rompera. Mitigacion: solo se eliminan entradas cuyo archivo destino no existe; los archivos que SI existen mantienen sus entradas.

3. **Conteo de tabs admin podria cambiar pronto**: Si se agrega un tab nuevo antes de que este PR se mergee, el conteo quedaria desactualizado. Mitigacion: verificar conteo al momento del merge.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (N/A - solo docs)
- [x] Archivos nuevos en carpeta de dominio correcta (docs/feat/infra/244-*)
- [x] Logica de negocio en hooks/services, no en componentes (N/A)
- [x] Ningun archivo resultante supera 400 lineas de codigo fuente (N/A - solo .md)

---

## Criterios de done

- [x] Las 8 colecciones faltantes documentadas en firestore.md con campos, tipos y rules reference
- [x] Los campos faltantes de `users`, `userSettings`, `feedback` y `comments` documentados
- [x] `_sidebar.md` tiene 0 links rotos (verificable con script)
- [x] `project-reference.md` muestra version 2.32.1 y 16 tabs admin
- [x] `features.md` muestra 16 tabs admin con las 3 filas faltantes agregadas
- [x] Tipos TypeScript en firestore.md coinciden con `src/types/index.ts` y `src/types/admin.ts`
- [x] Sidebar actualizada con entradas de specs/plan de #244
- [ ] No lint errors (N/A - solo .md)
- [ ] Build succeeds (N/A - solo .md)
