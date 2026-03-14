# Informe de Usabilidad, Mejoras Funcionales e Ideas — Modo Mapa

*Fecha: 2026-03-14*
*Considerando todos los issues hasta #99 como implementados (incl. #73, #79, #80, #84, #86-#99)*

---

## 1. USABILIDAD — Problemas detectados

| Problema | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| **Sin feedback visual en errores** | Alta | Pendiente | Si falla un rating, comment o favorite, el UI optimista no revierte. El usuario cree que se guardo |
| **Rate limit descubierto post-submit** | Media | Pendiente | El limite de 5 comments/dia solo se muestra despues de intentar postear. Deberia mostrarse antes |
| **Drag handle del BusinessSheet poco visible** | Media | Pendiente | La barra gris es muy sutil; usuarios no descubren que pueden arrastrar |
| **Sin pull-to-refresh** | Media | Parcial | Implementado en Rankings (#99). Falta en mapa y otras secciones |
| **Loading inconsistente** | Baja | Pendiente | Algunas secciones tienen skeleton loaders (Settings, Profile) pero el mapa y BusinessSheet no |
| **Comentarios largos no virtualizados** | Media | Pendiente | Threads con 50+ replies se vuelven lentos en dispositivos low-end |
| **Mapa no navegable por teclado** | Media | Pendiente | Markers solo accesibles por click/touch. Sin Tab navigation |
| **Sin onboarding** | Baja | Mitigado | #79 Help Section mitiga parcialmente. Falta onboarding interactivo |

---

## 2. MEJORAS FUNCIONALES (cara al usuario)

### A. Quick wins (bajo esfuerzo, alto impacto)

1. **Toast de error/exito global** — Snackbar MUI para confirmar acciones (rating guardado, comment publicado) y mostrar errores (sin conexion, rate limit alcanzado)
2. **Pre-check de rate limit** — Antes de mostrar el input de comentario, verificar si el usuario ya alcanzo el limite diario y mostrar mensaje
3. **Indicador de progreso en uploads** — Barra de progreso al subir foto de menu (hoy es solo spinner)
4. **Confirmacion al salir de formulario** — Si el usuario esta escribiendo un comentario largo y toca fuera, preguntar antes de descartar

### B. Mejoras de engagement

5. **"Primeros pasos" gamificado** — Checklist para nuevos usuarios: "Califica tu primer comercio", "Agrega un tag", "Deja un comentario" -> reward visual al completar
6. **Sugerencias contextuales** — Si el usuario tiene 0 ratings, mostrar tooltip en el mapa: "Toca un comercio para calificarlo"
7. ~~**Compartir perfil publico**~~ — IMPLEMENTADO: perfil publico con stats y rankings (#96)
8. ~~**Streak de actividad**~~ — IMPLEMENTADO: racha de actividad con contador en rankings (#93)

### C. Mejoras de datos/contenido

9. **Fotos del local** (no solo menu) — Galeria colaborativa de fotos del lugar
10. **Distancia al usuario** — Mostrar "a 300m" debajo de cada comercio en busqueda/favoritos
11. **Ordenar comercios por cercania** — Opcion en la lista de favoritos y sugerencias

---

## 3. IDEAS DE NUEVAS FUNCIONES

### Sociales

- **Listas compartidas** — "Mis favoritos de almuerzo" -> compartir lista con link
- **"Fui aca" check-in** — Registro de visita con timestamp (evolucion de "Recientes" pero activo)
- **Recomendaciones entre usuarios** — "Juan te recomienda Cafe Roma"
- **Seguir usuarios** — Ver actividad de amigos/colegas en un feed

### Descubrimiento

- **"Sorprendeme"** — Boton random que abre un comercio al azar que el usuario NO visito
- **"Trending"** — Comercios con mas actividad esta semana (mas ratings/comments recientes)

### Contenido

- **Reviews largos** — Ademas de comments cortos, permitir una "resena" mas elaborada por comercio (1 por usuario)
- **Preguntas y respuestas** — "Tienen opcion vegana?" -> otros usuarios responden
- **Menu digital** — Si el comercio tiene URL de menu, embeber o linkear

### Infraestructura/UX

- **Modo offline mejorado** — Cola de acciones pendientes que se sincronizan al reconectar
- **Widget de resumen** — En la home screen del telefono, mostrar "comercio sugerido del dia"

---

## 4. IMPLEMENTADO RECIENTEMENTE

| Feature | Issue/PR | Fecha |
|---------|----------|-------|
| Cross-device sync (email/password auth) | #80 / PR #83 | 2026-03-14 |
| Admin auth metrics y data coverage | #84 | 2026-03-14 |
| Rankings: tendencia, all-time, empty state, bar chart, badges, animaciones, streak, tiers, filtro zona, perfil, compartir logro, grafico evolucion, pull-to-refresh | #86-#99 / PR #114 | 2026-03-14 |
| Help section + Feedback status tracking | #79, #73 / PR #82 | 2026-03-14 |

---

## 5. Resumen de priorizacion sugerida

| Prioridad | Items |
|-----------|-------|
| **P0 — Critico** | Toast de errores (feedback visual), pre-check rate limit |
| **P1 — Alta** | Onboarding gamificado, distancia al usuario, pull-to-refresh global |
| **P2 — Media** | Fotos del local, "Sorprendeme", listas compartidas, comments virtualizados |
| **P3 — Nice to have** | Trending, Q&A, reviews largos, widget home screen |
