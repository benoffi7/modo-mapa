# Plan: Feedback de comercio — búsqueda y PDF

**Specs:** [Specs](./specs.md)
**Branch:** `feat/feedback-comercio-search`

---

## Pasos de implementación

### Paso 1: Tipos y servicio (S3 + S4)

1. En `src/types/index.ts`: agregar `'pdf'` al union de `mediaType`, agregar `businessId?: string` y `businessName?: string` a `Feedback`
2. En `src/services/feedback.ts`: renombrar `ALLOWED_IMAGE_TYPES` a `ALLOWED_MEDIA_TYPES`, agregar `application/pdf`, actualizar mensaje de error
3. Ampliar firma de `sendFeedback` con parámetro `business?: { id: string; name: string }`
4. Incluir `businessId`/`businessName` condicionalmente en el doc de Firestore
5. Setear `mediaType` como `'pdf'` o `'image'` según `mediaFile.type` en el `updateDoc`

**Verificación:**
```bash
npx tsc --noEmit
npm run lint
```

### Paso 2: Search bar de comercio en FeedbackForm (S1)

1. Importar `Autocomplete`, `Chip` de MUI y `allBusinesses` de `useBusinesses`
2. Agregar estados `selectedBusiness` y `businessQuery`
3. Agregar `useMemo` para filtrar sugerencias (min 2 chars, max 5 resultados, por nombre + dirección)
4. Renderizar `Autocomplete` condicional a `category === 'datos_comercio'`, entre chips de categoría y TextField
5. Con comercio seleccionado: mostrar `Chip` con `onDelete` en lugar del Autocomplete
6. Pasar `selectedBusiness` a `sendFeedback`; resetear ambos estados tras envío exitoso

**Verificación:**
```bash
npx tsc --noEmit
npm run lint
```

### Paso 3: Soporte PDF en FeedbackForm (S2 — parte form)

1. Cambiar `ALLOWED_ACCEPT` para incluir `application/pdf`
2. Cambiar label de "Adjuntar imagen" a "Adjuntar archivo"
3. Agregar preview diferenciado: PDF muestra `PictureAsPdfIcon` + nombre de archivo + botón cerrar; imagen mantiene preview existente

**Verificación:**
```bash
npx tsc --noEmit
npm run lint
```

### Paso 4: Preview PDF en listas (S2 — parte listas)

1. En `MyFeedbackList.tsx`: si `mediaType === 'pdf'`, mostrar `Link` con `PictureAsPdfIcon` + "Ver PDF adjunto" en lugar de imagen
2. En `FeedbackList.tsx` (admin): si `mediaType === 'pdf'`, mostrar link al PDF en lugar de imagen clickeable

**Verificación:**
```bash
npx tsc --noEmit
npm run lint
```

### Paso 5: Admin — columna comercio y filtro (S5)

1. Agregar columna "Comercio" después de "Categoría" con `Chip` clickeable (`color="warning"`, `variant="outlined"`) o `—` si no hay comercio
2. Evaluar si `onSelectBusiness` es accesible desde contexto admin; si no, usar navegación con query param `?business={id}`
3. Agregar `Autocomplete` de filtro por comercio arriba de la tabla con `allBusinesses`
4. Agregar estado `businessFilter` y aplicar al `.filter()` existente

**Verificación:**
```bash
npx tsc --noEmit
npm run lint
```

### Paso 6: Firestore Rules (S6)

1. Agregar `'businessId'` y `'businessName'` al `hasOnly` de la regla de creación de feedback
2. Agregar validación de tipos: `businessId` matches `^biz_[0-9]{3}$`, `businessName` string entre 1-100 chars

**Verificación:**
```bash
npx tsc --noEmit
npm run lint
npm run test:run
```

---

## Criterios de completitud

- [ ] Tipo `Feedback` incluye `businessId?`, `businessName?` y `mediaType` soporta `'pdf'`
- [ ] `sendFeedback` acepta y guarda business opcionalmente
- [ ] Search bar aparece solo en categoría `datos_comercio`, con chip tras selección
- [ ] PDFs se pueden adjuntar (accept + validación) y se muestran como ícono + nombre
- [ ] `MyFeedbackList` muestra link a PDF en lugar de imagen cuando corresponde
- [ ] `FeedbackList` admin muestra link a PDF y columna de comercio con chip clickeable
- [ ] Filtro por comercio funcional en admin
- [ ] Firestore rules permiten `businessId`/`businessName` con validación de formato
- [ ] Compilación limpia (`tsc --noEmit` + `lint` + `test:run`)
