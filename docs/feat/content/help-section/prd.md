# PRD: Seccion Ayuda en Menu Lateral

## Objetivo

Agregar una seccion "Ayuda" al menu lateral que explique brevemente cada funcionalidad de la app. Debe ser corta, clara y mantenerse actualizada automaticamente via un agente dedicado.

## Problema

Los usuarios nuevos no tienen forma de descubrir todas las funcionalidades disponibles (sugerencias, threads, multi-criterio, compartir, fotos de menu, etc.) sin explorar la app entera. Una guia rapida en el propio menu reduce friccion.

## Alcance

### En scope

- Nueva seccion "Ayuda" en el menu lateral (entre Configuracion y Agregar comercio)
- Componente `HelpSection.tsx` lazy-loaded como las demas secciones
- Contenido organizado por area funcional (mapa, comercio, social, etc.)
- Cada area con titulo, icono y 2-3 lineas de texto
- Agente `help-docs-reviewer` que valide que el contenido refleje las features actuales
- Estilo visual consistente con el resto del menu (MUI, dark mode compatible)

### Fuera de scope

- FAQ con preguntas y respuestas
- Chat de soporte o formulario de contacto
- Tutoriales interactivos o tooltips
- Internacionalizacion (todo en espanol)

## Secciones de contenido

Cada seccion es un bloque colapsable (Accordion) con icono + titulo + descripcion breve:

| Seccion | Contenido clave |
|---------|----------------|
| Mapa | Buscar comercios, filtrar por tags y precio, ver tu ubicacion |
| Comercio | Calificar (global + multi-criterio), comentar (con threads), marcar favorito, compartir, ver/subir foto de menu, votar nivel de gasto |
| Menu lateral | Recientes, sugeridos para vos, favoritos, comentarios, calificaciones, rankings, estadisticas |
| Notificaciones | Campana en barra de busqueda, tipos de notificaciones (likes, fotos, rankings) |
| Perfil | Click en nombre de usuario para ver perfil publico, medallas top-3 |
| Configuracion | Perfil publico/privado, preferencias de notificaciones, modo oscuro |
| Feedback | Enviar sugerencias o reportar bugs desde el menu |

## Requisitos no funcionales

- Lazy-loaded (no impacta main chunk)
- Dark mode compatible
- Mobile-first (max-width del drawer)
- Contenido hardcodeado en el componente (no fetch externo)
- El contenido se debe poder actualizar facilmente (array de objetos)

## Agente help-docs-reviewer

Un agente personalizado que:

1. Lee el componente `HelpSection.tsx`
2. Lee `docs/reference/features.md` (fuente de verdad de funcionalidades)
3. Compara las secciones de ayuda contra las features reales
4. Reporta discrepancias: features faltantes, features removidas, descripciones desactualizadas
5. Se ejecuta manualmente antes de cada merge a main

Definido en `.claude/agents/help-docs-reviewer.md`.

## Metricas de exito

- Usuarios pueden descubrir funcionalidades sin explorar toda la app
- El contenido de ayuda se mantiene sincronizado con las features reales (validado por agente)

## Prioridad

Baja — nice-to-have para mejorar onboarding de nuevos usuarios.
