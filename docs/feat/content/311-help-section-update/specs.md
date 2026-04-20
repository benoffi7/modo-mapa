# Specs: Tech debt — HelpSection update (#311)

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-04-18
**Branch:** `feat/311-help-section-update` (desde `new-home`)

---

## Alcance tecnico

Este cambio es **content-only**: actualiza texto estatico en un componente React, extrae el array `HELP_GROUPS` a un archivo de constantes dedicado, agrega tests y ajustes menores de accesibilidad. No toca Firestore, Cloud Functions, rules, storage ni converters.

---

## Archivos afectados

### Nuevos

| Archivo | Tipo | Proposito |
|---------|------|-----------|
| `src/components/profile/helpGroups.tsx` | Constante | Array `HELP_GROUPS` con todos los grupos e items, iconos JSX MUI. Mantener cerca del componente consumidor por tratarse de contenido especifico del dominio `profile/help`. |
| `src/components/profile/__tests__/HelpSection.test.tsx` | Test | Render, expand/collapse, snapshot de estructura, verificacion de ids unicos. |
| `src/components/profile/__tests__/helpGroups.test.ts` | Test | Integridad del array: no vacios, ids unicos, title/description no vacios, version format. |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/profile/HelpSection.tsx` | Eliminar `HELP_GROUPS` inline, importar de `./helpGroups`. Agregar `aria-label` en AccordionSummary. Queda como componente puro <100 lineas. |
| `docs/reference/features.md` | Ningun cambio (ya describe todas las features). |
| `docs/reference/patterns.md` | Agregar bullet "HELP_GROUPS registry" en la tabla UI patterns (espejo de HOME_SECTIONS). |
| `docs/reference/changelog.md` | Entrada para v2.35.8 (o siguiente bump). |

### Archivos tocados indirectamente

Ninguno: el consumidor `ProfileScreen.tsx` sigue importando `HelpSection` default export sin cambios en el API.

---

## Contratos

### `helpGroups.tsx`

```typescript
// src/components/profile/helpGroups.tsx
import type { ReactElement } from 'react';

export interface HelpItem {
  id: string;
  icon: ReactElement;
  title: string;
  description: string;
}

export interface HelpGroup {
  label: string;
  items: HelpItem[];
}

export const HELP_GROUPS: HelpGroup[] = [
  { label: 'Inicio', items: [ /* ... */ ] },
  { label: 'Buscar', items: [ /* ... */ ] },
  { label: 'Social', items: [ /* ... */ ] },
  { label: 'Listas', items: [ /* ... */ ] },
  { label: 'Perfil', items: [ /* ... */ ] },
  { label: 'Ajustes', items: [ /* ... */ ] },
];
```

### `HelpSection.tsx` (simplificado)

```typescript
import { useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Typography, Box, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { NAV_CHIP_SX } from '../../constants/ui';
import { HELP_GROUPS } from './helpGroups';

declare const __APP_VERSION__: string;

export default function HelpSection() {
  const [expanded, setExpanded] = useState<string | false>(false);
  const handleChange = (panel: string) => (_: unknown, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };
  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', pt: 1 }}>
        Modo Mapa v{__APP_VERSION__}
      </Typography>
      {HELP_GROUPS.map((group) => (
        <Box key={group.label}>
          <Chip label={group.label} size="small" variant="outlined" sx={{ ...NAV_CHIP_SX, mt: 2.5, mb: 1, ml: 2, fontWeight: 600 }} />
          {group.items.map((item) => (
            <Accordion
              key={item.id}
              expanded={expanded === item.id}
              onChange={handleChange(item.id)}
              disableGutters
              elevation={0}
              sx={{ '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-label={item.title}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {item.icon}
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ))}
    </Box>
  );
}
```

---

## Contenido nuevo/actualizado — por grupo

### Grupo **Inicio**

**Item `inicio` (actualizar)**:

> Tu pantalla principal con saludo personalizado y acciones rapidas (buscar por categoria, Sorprendeme). Seccion "Especiales" con tarjetas del equipo (promos, listas destacadas, logros). Seccion "Tendencia cerca tuyo" con comercios trending filtrados por tu ubicacion (GPS, localidad o zona por defecto) con radio progresivo 1-5km. Seccion "Novedades" que agrupa tus notificaciones no leidas. Seccion "Para ti" con sugerencias personalizadas. Seccion "Tus intereses" filtrada por tags que segues. Si tenes un check-in reciente sin calificar, te aparece un banner sugiriendo calificar.

**Item `primeros_pasos`**: sin cambios significativos (verificar redaccion).

### Grupo **Buscar**

**Item `buscar` (actualizar)**:

> Buscá comercios por nombre, direccion o categoria. Filtrá por tags y nivel de gasto ($/$$/$$). Tocá el boton de ubicacion para centrar el mapa en tu posicion. Alterná entre vista de mapa y lista de resultados ordenados por distancia. **Los markers son accesibles con Tab**: Enter o Espacio abre el detalle del comercio.

**Item `comercio` (actualizar)**:

> Tocá un pin o comercio en cualquier lista para ver el detalle. Header fijo con nombre, acciones y tu calificacion. Dos pestañas: **Info** (criterios de rating, tags predefinidos y personalizados, nivel de gasto, foto de menu con upload/reportar/staleness >6 meses) y **Opiniones** (subpestañas **Comentarios** y **Preguntas** con respuestas, likes, threads 1 nivel y badge "Mejor respuesta"). El limite de **20 por dia es compartido** entre comentarios y preguntas. Podes calificar (global + multi-criterio), marcar favorito, compartir con deep link, hacer check-in, abrir en Google Maps y crear tags personalizados. **Sin conexion** tus acciones se encolan automaticamente y se sincronizan al reconectar.

**Item `checkin`**: sin cambios significativos (verificar "500 metros" vs realidad).

**Item NUEVO `offline`**:

> Modo Mapa funciona sin conexion. Tus acciones (calificaciones, comentarios, favoritos, niveles de gasto, tags) se encolan en tu dispositivo y se envian automaticamente cuando volves a tener internet. Un **indicador arriba** muestra "Sin conexion" y la cantidad de acciones pendientes. En el menu lateral aparece la seccion **"Pendientes"** con el detalle de cada accion y opcion de descartar o reintentar. Cuando los datos de un comercio vienen de cache vas a ver un aviso de **"Datos guardados - puede no estar actualizado"**. Limite: 50 acciones en cola, las mas viejas se descartan a los 7 dias.

### Grupo **Social**

**Item `social` (actualizar, renombrar a "Actividad, Seguidos y Rankings")**:

> En la pestaña **Social** tenes cuatro secciones: **Actividad** (feed de lo que hacen los usuarios que segues — ratings, comentarios, favoritos), **Seguidos** (busca y segui a otros con perfil publico, maximo 200), **Recomendaciones** (comercios que te recomendaron, con badge de no leidas) y **Rankings**.

**Item NUEVO `rankings`** (o expandir descripcion):

> Ranking **semanal, mensual, anual e historico** con score por actividad. Sistema de **tiers** (Bronce/Plata/Oro/Diamante) con barra de progreso al siguiente nivel. 11 **badges** (primera resena, fotografo, popular, racha 7d, etc.). **Streak** de dias consecutivos y grafico de evolucion. Filtro **"Mi zona"** que muestra comercios trending en tu area. Toca el nombre de un usuario para ver su perfil publico con stats, badges y comentarios.

**Item NUEVO `perfil_publico`** (o incluir en item `social`):

> Tocá el nombre de cualquier usuario en comentarios o listas para abrir su **perfil publico**: avatar, fecha de registro, estadisticas (comentarios, ratings, favoritos, likes recibidos, fotos aprobadas, ranking), badges top-3, ultimos 5 comentarios con link al comercio y boton **Seguir**.

**Item `recomendaciones` (actualizar)**:

> Recomendá un comercio a otro usuario desde el detalle. Podes agregar un mensaje opcional (hasta 200 caracteres). Limite: **20 recomendaciones por dia** (te avisa cuando te quedan 3 o menos). Las que recibis aparecen en **Social > Recomendaciones** con badge de no leidas. Tocá una para ir al comercio — al abrir la seccion se marcan todas como leidas.

### Grupo **Listas**

**Item `listas` (actualizar)**:

> En la pestaña **Listas** tenes cinco secciones: **Favoritos** (con filtros por nombre, categoria y orden, y distancia al comercio), **Listas** (creá listas tematicas con **icono personalizado** entre 30 opciones y **color** personalizado, hacelas publicas o privadas), **Compartidas conmigo** (listas donde te invitaron como editor), **Destacadas** (listas curadas automaticamente — top calificadas, mas comentadas, favoritas de la comunidad) y **Recientes** (historial de comercios visitados o vistos, guardado localmente, separado de los check-ins). Maximo **10 listas y 50 comercios por lista**. Podés **copiar una lista ajena** o **agregar todos los comercios de una lista a tus favoritos** de una sola vez. El historial de check-ins esta en el menu lateral, seccion "Mis visitas".

**Item `colaborativas`** (sin cambios significativos).

### Grupo **Perfil**

**Item `perfil` (actualizar)**:

> Tu perfil muestra un avatar personalizable (tocá para elegir entre **22 opciones**), tus estadisticas (lugares visitados, reseñas, seguidores, favoritos), y tus logros con barra de progreso. Tocá "Ver todos" para ver la grilla completa de logros con descripcion de como completar cada uno.

*(El numero "22" debe validarse contra `AVATAR_OPTIONS.length` al escribir — al 2026-04-18 son 22.)*

**Item `logros`** (sin cambios significativos).

**Item `notificaciones` (actualizar)**:

> Tocá la campana o andá a Perfil > Notificaciones. Badge con las no leidas. Recibis avisos de likes en comentarios, respuestas a tus comentarios, fotos aprobadas o rechazadas, cambios en rankings, respuestas a feedback, nuevos seguidores y recomendaciones. En Home la seccion **"Novedades"** agrupa tus no leidas por tipo. Podes elegir la **frecuencia del digest** en Configuracion: tiempo real (default, polling cada 5min), diaria o semanal. Tocá una notificacion para ir al comercio o marcá todas como leidas. Podes desactivar cada tipo en Configuracion.

### Grupo **Ajustes**

**Item `cuenta`** (sin cambios significativos, quiza mencionar onboarding banners #157).

**Item NUEVO `onboarding`** *(opcional)*:

> Como usuario temporal (anonimo) vas a ver un **banner de onboarding** sugiriendo crear cuenta para no perder tus datos, una **pantalla de beneficios** pre-registro y un **recordatorio** despues de unas cuantas interacciones. Si ya creaste cuenta y no verificaste tu email, vas a ver un nudge en el menu para **reenviar el email de verificacion**.

**Item `configuracion` (actualizar)**:

> Accedé desde Perfil > Configuracion. Incluye **Cuenta** (crear cuenta, verificar email, cambiar contraseña, cerrar sesion, eliminar cuenta), **Ubicacion** (localidad por defecto cuando no hay GPS, usada en mapa, sort por cercania, Sorprendeme y sugerencias), **Apariencia** (toggle de **modo oscuro** — moved here desde el menu lateral), **Privacidad** (perfil publico/privado, datos de uso/analytics), **Notificaciones** (master + por tipo, y frecuencia del digest: tiempo real, diaria o semanal). La **eliminacion de cuenta** borra permanentemente todos tus datos y no se puede deshacer.

**Item `modooscuro` (actualizar)**:

> Activá o desactivá el modo oscuro desde **Configuracion > Apariencia**. Tu preferencia se guarda automaticamente. Si no lo configurás manualmente, la app respeta la configuracion de tu dispositivo (modo claro u oscuro del sistema). El modo oscuro se aplica a toda la interfaz incluyendo mapa, listas y pantallas de carga.

**Item `feedback`** (sin cambios significativos, validar que el label coincide con la ruta real).

---

## Tests

### `helpGroups.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { HELP_GROUPS } from '../helpGroups';

describe('HELP_GROUPS', () => {
  it('no esta vacio', () => {
    expect(HELP_GROUPS.length).toBeGreaterThan(0);
  });

  it('cada grupo tiene al menos un item', () => {
    for (const group of HELP_GROUPS) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('todos los ids de items son unicos a nivel global', () => {
    const ids = HELP_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('cada item tiene title y description no vacios', () => {
    for (const group of HELP_GROUPS) {
      for (const item of group.items) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('cada item tiene un icono ReactElement', () => {
    for (const group of HELP_GROUPS) {
      for (const item of group.items) {
        expect(item.icon).toBeDefined();
        expect(item.icon.type).toBeDefined(); // es un ReactElement
      }
    }
  });

  it('contiene items clave de features recientes', () => {
    const ids = HELP_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toContain('offline'); // #136
    expect(ids).toContain('rankings'); // #200
    expect(ids).toContain('perfil_publico'); // nueva feature
  });
});
```

### `HelpSection.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpSection from '../HelpSection';

// __APP_VERSION__ es una constante de build — se mockea via vi.stubGlobal en test/setup.ts
// o se declara aca si no esta en setup:
vi.stubGlobal('__APP_VERSION__', '2.35.8-test');

describe('<HelpSection>', () => {
  it('renderiza todos los grupos de ayuda', () => {
    render(<HelpSection />);
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Buscar')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Listas')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('muestra la version de la app', () => {
    render(<HelpSection />);
    expect(screen.getByText(/Modo Mapa v/)).toBeInTheDocument();
  });

  it('expande y colapsa un accordion al hacer click', () => {
    render(<HelpSection />);
    const summary = screen.getByText('Pantalla principal').closest('button');
    expect(summary).not.toBeNull();
    fireEvent.click(summary!);
    // Verificar que aria-expanded pasa a true
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(summary!);
    expect(summary).toHaveAttribute('aria-expanded', 'false');
  });

  it('solo un accordion expandido a la vez', () => {
    render(<HelpSection />);
    const first = screen.getByText('Pantalla principal').closest('button');
    const second = screen.getByText('Mapa y busqueda').closest('button');
    fireEvent.click(first!);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(second!);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
  });
});
```

### Mock strategy

- `__APP_VERSION__`: stub global en `src/test/setup.ts` o por test.
- No se requieren mocks de Firebase, Firestore, Auth, o servicios — el componente es puro.
- No se requiere `vi.mock` de hooks.

### Cobertura esperada

- `helpGroups.tsx`: 100% (modulo de datos).
- `HelpSection.tsx`: >=90% lines (toda la rama de expand/collapse cubierta).

---

## Mutable prop audit

El componente `HelpSection` no recibe props. El array `HELP_GROUPS` es una constante inmutable importada. No hay flujo de datos mutables.

---

## Firestore rules field whitelist audit

No aplica: no hay escrituras a Firestore en este feature.

---

## Anti-sabana

`HelpSection` actualmente tiene un solo nivel de estructura (grupos con Accordions). Tras el refactor queda con <100 lineas y una sola responsabilidad de render. No aplica la regla de "max 5 secciones verticales con Dividers" — el componente no es orquestador, es hoja.

---

## Analytics (opcional)

Si se decide tracking:

- Evento nuevo: `help_item_expanded` con params `{ id: string, group: string }`.
- Nuevo archivo `src/constants/analyticsEvents/help.ts` con constante `EVT_HELP_ITEM_EXPANDED`.
- Re-export desde `src/constants/analyticsEvents/index.ts` barrel.
- Registrar en `GA4_EVENT_NAMES` (analyticsReport.ts) y `ga4FeatureDefinitions.ts`.
- Trigger en `handleChange`: si `isExpanded`, llamar a `trackEvent(EVT_HELP_ITEM_EXPANDED, { id: panel, group: findGroup(panel) })`.

**Decision:** dejamos fuera de scope en esta primera iteracion. Si hay apetito de datos en Admin > Funcionalidades, abrir issue spin-off.

---

## Accesibilidad

- `AccordionSummary` recibe `aria-label={item.title}` redundante con el Typography (defensa en profundidad para screen readers que no descienden al Typography). Verificar con NVDA/VoiceOver que no haya doble anuncio.
- Alternativa: `aria-labelledby` apuntando al id del Typography, pero requiere ids unicos para cada Typography. `aria-label` es mas simple y suficiente.
- Los iconos MUI ya tienen `aria-hidden` por default.

---

## Validacion manual (pre-merge)

1. Abrir Perfil > Ayuda y soporte en local.
2. Verificar que se muestran los 6 grupos en orden.
3. Expandir cada item y leer la descripcion: validar tildes, voseo, que no haya datos desactualizados.
4. Contar avatares reales en `AvatarPicker` y confirmar el numero en el item "Tu perfil".
5. Verificar que el toggle dark mode se encuentra realmente en Configuracion > Apariencia (abrir SettingsPanel y confirmar visualmente).
6. Abrir el item "Modo offline" desconectando wifi: validar que la descripcion matchea el comportamiento (OfflineIndicator visible, seccion Pendientes si hay acciones).
7. Abrir Q&A en un comercio y validar que el limite "20/dia compartido" coincide con el comportamiento real (el mismo counter sirve para comentarios y preguntas segun `onCommentCreated` trigger).
