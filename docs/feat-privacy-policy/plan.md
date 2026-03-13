# Plan: Politica de privacidad

## Orden de implementacion

### Paso 1: Nuevas categorias de feedback

1. Agregar `'datos_usuario' | 'datos_comercio'` a `FeedbackCategory` en `src/types/index.ts`
2. Actualizar `VALID_CATEGORIES` en `src/services/feedback.ts`
3. Actualizar whitelist en `firestore.rules`
4. Actualizar chips en `src/components/menu/FeedbackForm.tsx` con labels y flexWrap
5. Actualizar `categoryColor` en `src/components/admin/FeedbackList.tsx`

**Verificar**: `npx tsc --noEmit -p tsconfig.app.json`

### Paso 2: Componente PrivacyPolicy

1. Crear `src/components/menu/PrivacyPolicy.tsx` con contenido estatico

### Paso 3: Integrar en SideMenu

1. Agregar `'privacy'` al tipo Section y SECTION_TITLES
2. Importar y renderizar PrivacyPolicy
3. Agregar link en footer del menu

### Paso 4: Test local

1. `npm run lint`
2. `npm run test:run`
3. `npm run build`
4. `npm run dev` — verificar:
   - Link "Politica de privacidad" visible en footer del menu
   - Click abre seccion con contenido completo
   - Scroll funciona en mobile
   - Dark mode compatible
   - Nuevas categorias de feedback visibles en el formulario
   - Chips no se cortan en mobile (flexWrap)
