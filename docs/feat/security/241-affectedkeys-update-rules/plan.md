# Plan: affectedKeys() Update Rules para ratings, customTags y priceLevels

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Modificar Firestore rules

**Branch:** `fix/241-affectedkeys-update-rules`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `firestore.rules` | **ratings update** (linea ~87): reemplazar bloque de update para agregar `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['score', 'updatedAt', 'criteria'])` y remover la validacion redundante `request.resource.data.userId == resource.data.userId` |
| 2 | `firestore.rules` | **customTags update** (linea ~204): reemplazar bloque de update para agregar `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['label'])` y remover la validacion redundante `request.resource.data.userId == resource.data.userId` |
| 3 | `firestore.rules` | **priceLevels update** (linea ~274): reemplazar bloque de update para agregar `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['level', 'updatedAt'])` y remover la validacion redundante `request.resource.data.userId == resource.data.userId` |

### Fase 2: Verificacion en emuladores

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | Terminal | Ejecutar `npm run dev:full` para levantar emuladores + app |
| 2 | App local | Verificar que calificar un comercio (crear + actualizar rating) funciona |
| 3 | App local | Verificar que crear y editar una etiqueta custom funciona |
| 4 | App local | Verificar que votar nivel de gasto (crear + cambiar) funciona |

### Fase 3: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/firestore.md` | Actualizar descripcion de reglas de ratings, customTags y priceLevels para reflejar `affectedKeys()` en updates |
| 2 | `docs/reference/security.md` | Agregar entrada sobre el fix de `affectedKeys()` en las tres colecciones si corresponde |

---

## Orden de implementacion

1. `firestore.rules` — las tres modificaciones son independientes entre si pero van en el mismo archivo
2. Verificacion en emuladores — depende de paso 1
3. Documentacion — depende de paso 1

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas resultantes | Supera 400? |
|---------|----------------|-------------------|-------------|
| `firestore.rules` | 527 | ~527 (sin cambio neto significativo) | SI (ya lo supera, no se agrava) |

El archivo `firestore.rules` ya supera 400 lineas pero es un archivo de configuracion de seguridad que no se puede descomponer facilmente. No se agravan lineas.

---

## Riesgos

1. **Regression en updates legitimos**: Si los campos en `affectedKeys().hasOnly()` no coinciden exactamente con lo que los servicios envian, los updates seran rechazados silenciosamente. **Mitigacion**: se verifico cada servicio (`ratings.ts`, `tags.ts`, `priceLevels.ts`) y los campos coinciden exactamente.

2. **Writes offline en cola**: Si un usuario tiene writes pendientes en la cola offline de Firestore que incluyen campos no permitidos (por un bug previo o un cliente viejo), seran rechazados al sincronizar. **Mitigacion**: los servicios nunca enviaron campos extra; el riesgo es solo para atacantes manuales.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] No hay archivos nuevos (solo modificacion de `firestore.rules`)
- [x] Logica de negocio en hooks/services, no en componentes (N/A)
- [x] No se toca ningun archivo con deuda tecnica conocida
- [x] Ningun archivo resultante supera 400 lineas (el unico que supera ya lo hacia)

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/security.md` | Documentar el fix de `affectedKeys()` en ratings, customTags y priceLevels |
| 2 | `docs/reference/firestore.md` | Actualizar columna "Reglas" de ratings, customTags y priceLevels para mencionar `affectedKeys()` en update |

---

## Criterios de done

- [ ] Las tres reglas de update tienen `affectedKeys().hasOnly()` con los campos correctos
- [ ] La validacion redundante de `userId` immutability fue removida en las tres reglas
- [ ] Deploy de rules a emuladores exitoso
- [ ] Updates legitimos desde la app funcionan (rating, customTag label, priceLevel)
- [ ] Intentar cambiar `businessId` via update es rechazado
- [ ] Documentacion de referencia actualizada
- [ ] No lint errors en archivos modificados
