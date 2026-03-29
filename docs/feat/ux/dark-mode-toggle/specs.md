# Specs: Agregar toggle de dark mode en la UI

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-29

---

## Modelo de datos

No se agregan colecciones ni campos nuevos a Firestore. Este feature es 100% client-side.

La preferencia de dark mode se persiste en `localStorage` con la key `STORAGE_KEY_COLOR_MODE` (`modo-mapa-color-mode`), gestionada por el `ColorModeContext` existente.

No se requieren tipos TypeScript nuevos. Los tipos relevantes ya existen:

```typescript
// src/context/ColorModeContext.tsx (existente)
type Mode = 'light' | 'dark';

export interface ColorModeContextValue {
  mode: Mode;
  toggleColorMode: () => void;
}
```

## Firestore Rules

No se modifican. Este feature no interactua con Firestore.

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| N/A | N/A | N/A | N/A | N/A |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| N/A | N/A | N/A | N/A | N/A |

## Cloud Functions

No se requieren Cloud Functions para este feature.

## Componentes

### Modificacion: `SettingsPanel` (`src/components/profile/SettingsPanel.tsx`)

**Cambio:** Agregar seccion "Apariencia" con un `SettingRow` para el toggle de dark mode, ubicada entre "Ubicacion" y "Privacidad".

**Detalle:**

- Importar `useColorMode` de `../../hooks/useColorMode`
- Importar icono `DarkModeOutlined` de `@mui/icons-material/DarkModeOutlined` (opcional, para consistencia visual con el label)
- Nueva seccion con `Typography variant="overline"` titulada "Apariencia"
- Un `SettingRow` con:
  - `label`: "Modo oscuro"
  - `description`: "Cambia el tema visual de la app"
  - `checked`: `mode === 'dark'`
  - `onChange`: `() => toggleColorMode()`
- No necesita estado local ni interaccion con `useUserSettings` (es independiente de Firestore)

**Secciones resultantes despues del cambio (6 total):**

1. Cuenta (AccountSection)
2. Ubicacion (LocalityPicker)
3. Apariencia (dark mode toggle) -- NUEVA
4. Privacidad
5. Notificaciones
6. Datos de uso

Nota: 6 secciones esta en el limite del patron anti-sabana. Es aceptable porque SettingsPanel es una pantalla de configuracion dedicada (no un sheet de overview) y cada seccion es compacta.

### Mutable prop audit

| Component | Prop | Editable fields | Local state needed? | Parent callback |
|-----------|------|----------------|-------------------|-----------------|
| SettingsPanel (dark mode row) | N/A (usa context directo) | mode (via toggleColorMode) | NO -- el estado vive en ColorModeContext | N/A |

## Textos de usuario

| Texto | Donde se usa | Notas |
|-------|-------------|-------|
| "Apariencia" | Typography overline en SettingsPanel | Sin tilde necesaria |
| "Modo oscuro" | SettingRow label en SettingsPanel | Sin tilde necesaria |
| "Cambia el tema visual de la app" | SettingRow description en SettingsPanel | Sin tilde necesaria |

Nota: Estos textos son labels de UI del SettingsPanel. Son tan cortos y especificos que no se justifica extraerlos a `constants/messages/`. No hay toasts, errores ni mensajes dinamicos.

## Hooks

No se crean hooks nuevos. Se reutiliza el hook existente `useColorMode` (`src/hooks/useColorMode.ts`), que es un wrapper de `useContext(ColorModeContext)`.

## Servicios

No se crean ni modifican servicios. Este feature no interactua con Firestore ni con APIs externas.

## Integracion

### Componentes existentes que se modifican

| Componente | Cambio |
|-----------|--------|
| `src/components/profile/SettingsPanel.tsx` | Agregar seccion Apariencia con toggle dark mode |

### Conexion con infraestructura existente

- `ColorModeContext` (provider en `App.tsx`) ya gestiona: estado `mode`, funcion `toggleColorMode`, persistencia en localStorage, analytics via `setUserProperty('theme', mode)`, y creacion de tema MUI via `getDesignTokens(mode)`.
- `useColorMode()` hook ya expone `{ mode, toggleColorMode }`.
- `getDesignTokens()` en `src/theme/index.ts` ya define paletas completas para light y dark.
- No se necesita wiring adicional de props ni callbacks -- el context ya esta en el arbol de providers.

### Preventive checklist

- [x] **Service layer**: No hay componentes importando `firebase/firestore` para writes en este cambio
- [x] **Duplicated constants**: No se duplican constantes. `STORAGE_KEY_COLOR_MODE` ya existe en `constants/storage.ts`
- [x] **Context-first data**: Se usa `useColorMode()` del context, no se lee localStorage directamente
- [x] **Silent .catch**: No hay `.catch` en este cambio
- [x] **Stale props**: No aplica -- el toggle consume context directamente, no props mutables

## Tests

### Test nuevo: `src/context/ColorModeContext.test.tsx`

Este test cubre la deuda tecnica pendiente del `ColorModeContext` (marcado como pending en `tests.md`).

**Casos a testear:**

1. Renderiza en light mode por defecto cuando no hay localStorage ni prefers-color-scheme dark
2. Respeta `prefers-color-scheme: dark` del sistema cuando no hay localStorage
3. Respeta valor guardado en localStorage sobre prefers-color-scheme
4. `toggleColorMode` cambia de light a dark
5. `toggleColorMode` cambia de dark a light
6. `toggleColorMode` persiste el nuevo modo en localStorage
7. `toggleColorMode` llama a `setUserProperty('theme', newMode)`
8. El theme MUI creado tiene el mode correcto

**Mock strategy:**

```typescript
vi.mock('../utils/analytics', () => ({
  setUserProperty: vi.fn(),
}));
```

- Mock de `localStorage` via `vi.stubGlobal` o directo (jsdom lo provee)
- Mock de `window.matchMedia` para simular `prefers-color-scheme`
- Mock de `setUserProperty` para verificar analytics tracking

### Test nuevo: `src/components/profile/SettingsPanel.test.tsx`

**Casos a testear:**

1. Renderiza la seccion "Apariencia" con el toggle de dark mode
2. El toggle refleja el modo actual del ColorModeContext (checked cuando dark)
3. Al cambiar el toggle se llama a `toggleColorMode`
4. La seccion "Apariencia" aparece entre "Ubicacion" y "Privacidad"

**Mock strategy:**

```typescript
vi.mock('../../hooks/useColorMode', () => ({
  useColorMode: vi.fn(() => ({ mode: 'light', toggleColorMode: vi.fn() })),
}));
vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: vi.fn(() => ({
    settings: { /* defaults */ },
    loading: false,
    updateSetting: vi.fn(),
    updateLocality: vi.fn(),
    clearLocality: vi.fn(),
  })),
}));
```

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/context/ColorModeContext.test.tsx` | Inicializacion, toggle, persistencia, analytics | Context |
| `src/components/profile/SettingsPanel.test.tsx` | Seccion Apariencia visible, toggle funcional | Component |

## Analytics

No se agregan eventos nuevos. El `ColorModeContext` existente ya ejecuta `setUserProperty('theme', mode)` en cada toggle, lo cual es suficiente para tracking.

---

## Offline

Este feature funciona 100% offline. No depende de Firestore ni de APIs externas.

### Cache strategy

| Dato | Estrategia | TTL | Storage |
|------|-----------|-----|---------|
| Preferencia de modo (light/dark) | Persistente | Indefinido | localStorage (`modo-mapa-color-mode`) |

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Toggle dark mode | `localStorage.setItem` (sincrono, siempre disponible) | N/A -- ultima escritura gana, no hay conflicto posible |

### Fallback UI

No se necesita UI de fallback. El toggle y la preferencia funcionan independientemente del estado de red.

---

## Decisiones tecnicas

1. **Seccion en SettingsPanel, no en SettingsMenu.** El PRD ubica el toggle en SettingsPanel (seccion "Apariencia"). Esto es correcto porque es una configuracion de la app, no un item de navegacion. Alternativa considerada: icono en el header de ProfileScreen -- rechazada porque rompe la consistencia de que todas las configuraciones estan en SettingsPanel.

2. **No se agrega icono sol/luna al SettingRow.** El PRD marca esto como prioridad baja. El componente `SettingRow` existente no tiene slot para iconos (solo label + description + switch). Agregar un icono requeriria modificar la interfaz de SettingRow o crear un componente custom, lo cual no se justifica para un unico uso. Se puede agregar en una iteracion futura si hay demanda.

3. **Audit visual como tarea manual.** El PRD pide audit visual de componentes en dark mode. Esto es un proceso manual de QA, no codigo. Se documenta en el plan como una fase separada con checklist, pero no genera archivos de codigo.

4. **Tests de ColorModeContext como parte de este feature.** El PRD y `tests.md` identifican que `ColorModeContext` no tiene tests. Aprovechar este feature para agregar cobertura es eficiente y reduce deuda tecnica.

---

## Hardening de seguridad

### Firestore rules requeridas

Ninguna. Este feature no interactua con Firestore.

### Rate limiting

No aplica. No hay escrituras a Firestore.

| Coleccion | Limite | Implementacion |
|-----------|--------|---------------|
| N/A | N/A | N/A |

### Vectores de ataque mitigados

| Ataque | Mitigacion | Archivo |
|--------|-----------|---------|
| N/A -- feature 100% client-side sin inputs de texto libre ni escrituras a backend | N/A | N/A |

---

## Deuda tecnica: mitigacion incorporada

```bash
gh issue list --label security --state open --json number,title
# []
gh issue list --label "tech debt" --state open --json number,title
# []
```

No hay issues abiertos de seguridad o deuda tecnica. Sin embargo, `tests.md` marca `ColorModeContext.tsx` como pendiente de tests. Este feature lo resuelve:

| Issue | Que se resuelve | Paso del plan |
|-------|----------------|---------------|
| tests.md: `ColorModeContext.tsx` pending | Agregar tests completos del context | Fase 1, paso 2 |
