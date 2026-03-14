# Informe de Usabilidad, Mejoras Funcionales e Ideas — Modo Mapa

*Fecha: 2026-03-14*
*Considerando #79 (Help Section) y #73 (Feedback Status + Media) como implementados*

---

## 1. USABILIDAD — Problemas detectados

| Problema | Severidad | Detalle |
|----------|-----------|---------|
| **Sin feedback visual en errores** | Alta | Si falla un rating, comment o favorite, el UI optimista no revierte. El usuario cree que se guardó |
| **Rate limit descubierto post-submit** | Media | El límite de 5 comments/día solo se muestra después de intentar postear. Debería mostrarse antes |
| **Drag handle del BusinessSheet poco visible** | Media | La barra gris es muy sutil; usuarios no descubren que pueden arrastrar |
| **Sin pull-to-refresh** | Media | En mobile, el gesto natural de "tirar hacia abajo" no refresca datos |
| **Loading inconsistente** | Baja | Algunas secciones tienen skeleton loaders (Settings, Profile) pero el mapa y BusinessSheet no |
| **Comentarios largos no virtualizados** | Media | Threads con 50+ replies se vuelven lentos en dispositivos low-end |
| **Mapa no navegable por teclado** | Media | Markers solo accesibles por click/touch. Sin Tab navigation |
| **Sin onboarding** | Baja | Usuario nuevo no recibe guía de qué puede hacer (#79 Help mitiga parcialmente) |

---

## 2. MEJORAS FUNCIONALES (cara al usuario)

### A. Quick wins (bajo esfuerzo, alto impacto)

1. **Toast de error/éxito global** — Snackbar MUI para confirmar acciones (rating guardado, comment publicado) y mostrar errores (sin conexión, rate limit alcanzado)
2. **Pre-check de rate limit** — Antes de mostrar el input de comentario, verificar si el usuario ya alcanzó el límite diario y mostrar mensaje
3. **Indicador de progreso en uploads** — Barra de progreso al subir foto de menú (hoy es solo spinner)
4. **Confirmación al salir de formulario** — Si el usuario está escribiendo un comentario largo y toca fuera, preguntar antes de descartar

### B. Mejoras de engagement

5. **"Primeros pasos" gamificado** — Checklist para nuevos usuarios: "Calificá tu primer comercio", "Agregá un tag", "Dejá un comentario" → reward visual al completar
6. **Sugerencias contextuales** — Si el usuario tiene 0 ratings, mostrar tooltip en el mapa: "Tocá un comercio para calificarlo"
7. **Compartir perfil público** — Botón para compartir link al perfil público con stats y rankings
8. **Streak de actividad** — "Llevas 5 días consecutivos usando Modo Mapa" en el panel de stats

### C. Mejoras de datos/contenido

9. **Fotos del local** (no solo menú) — Galería colaborativa de fotos del lugar
10. **Distancia al usuario** — Mostrar "a 300m" debajo de cada comercio en búsqueda/favoritos
11. **Ordenar comercios por cercanía** — Opción en la lista de favoritos y sugerencias

---

## 3. IDEAS DE NUEVAS FUNCIONES

### Sociales

- **Listas compartidas** — "Mis favoritos de almuerzo" → compartir lista con link
- **"Fui acá" check-in** — Registro de visita con timestamp (evolución de "Recientes" pero activo)
- **Recomendaciones entre usuarios** — "Juan te recomienda Café Roma"
- **Seguir usuarios** — Ver actividad de amigos/colegas en un feed

### Descubrimiento

- **"Sorprendeme"** — Botón random que abre un comercio al azar que el usuario NO visitó
- **"Trending"** — Comercios con más actividad esta semana (más ratings/comments recientes)

### Contenido

- **Reviews largos** — Además de comments cortos, permitir una "reseña" más elaborada por comercio (1 por usuario)
- **Preguntas y respuestas** — "¿Tienen opción vegana?" → otros usuarios responden
- **Menú digital** — Si el comercio tiene URL de menú, embeber o linkear

### Infraestructura/UX

- **Modo offline mejorado** — Cola de acciones pendientes que se sincronizan al reconectar
- **Widget de resumen** — En la home screen del teléfono, mostrar "comercio sugerido del día"

## 5. Resumen de priorización sugerida

| Prioridad | Items |
|-----------|-------|
| **P0 — Crítico** | Toast de errores, cross-device sync (#80) |
| **P1 — Alta** | Pre-check rate limit, onboarding gamificado, distancia al usuario |
| **P2 — Media** | Horarios, fotos del local, "Sorprendeme", listas compartidas |
| **P3 — Nice to have** | Trending, Q&A, reviews largos |
