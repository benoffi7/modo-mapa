# Specs: Seccion Ayuda en Menu Lateral

## Componente HelpSection

### Ubicacion

`src/components/menu/HelpSection.tsx`

### Props

```typescript
// Sin props — contenido estatico
export default function HelpSection(): JSX.Element
```

### Estructura de datos

```typescript
interface HelpItem {
  icon: ReactElement;
  title: string;
  description: string;
}

const HELP_ITEMS: HelpItem[] = [
  {
    icon: <MapIcon />,
    title: 'Mapa',
    description: 'Busca comercios por nombre, direccion o categoria. Filtra por tags y nivel de gasto ($/$$/$$). Toca el boton de ubicacion para centrar el mapa en tu posicion.',
  },
  // ... mas items
];
```

### Renderizado

- `Accordion` de MUI con `AccordionSummary` (icono + titulo) y `AccordionDetails` (descripcion)
- Solo un accordion abierto a la vez (`expanded` controlado)
- Tipografia: titulo en `body1` bold, descripcion en `body2` color `text.secondary`
- Iconos: reusar los mismos iconos del menu lateral para consistencia visual

### Iconos por seccion

| Seccion | Icono MUI |
|---------|-----------|
| Mapa | `MapOutlined` |
| Comercio | `StorefrontOutlined` |
| Menu lateral | `MenuOutlined` |
| Notificaciones | `NotificationsOutlined` |
| Perfil | `PersonOutlined` |
| Configuracion | `SettingsOutlined` |
| Feedback | `FeedbackOutlined` |

## Cambios en SideMenu

### Nuevo Section type

```typescript
type Section = 'nav' | ... | 'help';
```

### Nuevo item en SECTION_TITLES

```typescript
help: 'Ayuda',
```

### Nuevo lazy import

```typescript
const HelpSection = lazy(() => import('../menu/HelpSection'));
```

### Posicion en el menu

Despues de "Configuracion", antes del footer (dark mode toggle):

```tsx
<ListItemButton onClick={() => setActiveSection('help')}>
  <ListItemIcon>
    <HelpOutlineIcon sx={{ color: '#5f6368' }} />
  </ListItemIcon>
  <ListItemText primary="Ayuda" />
</ListItemButton>
```

### Renderizado en section content

```tsx
{activeSection === 'help' && <HelpSection />}
```

## Agente help-docs-reviewer

### Ubicacion

`.claude/agents/help-docs-reviewer.md`

### Responsabilidades

1. Leer `src/components/menu/HelpSection.tsx` y extraer las secciones/items
2. Leer `docs/reference/features.md` como fuente de verdad
3. Comparar y reportar:
   - Features en `features.md` que no estan mencionadas en HelpSection
   - Secciones en HelpSection que ya no existen en features.md
   - Descripciones que no reflejan el comportamiento actual
4. Sugerir texto actualizado para discrepancias encontradas

### Formato del reporte

```markdown
## Help Section Review

### Missing features (in features.md but not in HelpSection)
- [feature name]: [brief description]

### Outdated descriptions
- [section]: [current text] → [suggested update]

### OK
- [section]: Up to date
```

### Invocacion

Se invoca como subagente con `subagent_type: "help-docs-reviewer"`.

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `src/components/menu/HelpSection.tsx` | Crear |
| `src/components/layout/SideMenu.tsx` | Modificar (agregar section) |
| `.claude/agents/help-docs-reviewer.md` | Crear |

## Tests

No se requieren tests unitarios — es un componente puramente visual con contenido estatico. El agente reviewer actua como validacion.
