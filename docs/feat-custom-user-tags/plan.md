# Plan Técnico: Tags personalizados por usuario

**Issue:** #5
**Fecha:** 2026-03-11

## Pasos de implementación

### Paso 1: Reglas de Firestore

- Agregar regla para colección `customTags` en `firestore.rules`
- Read restringido al dueño (`resource.data.userId == request.auth.uid`)
- Create/Update validan userId y label (1-30 chars)
- Delete solo por el dueño

### Paso 2: Modificar `BusinessTags.tsx`

Este es el cambio principal. En orden:

1. **Imports**: agregar `updateDoc`, `addDoc` de Firestore + iconos MUI (`LabelOutlined`) + componentes MUI (`Dialog`, `TextField`, `Menu`, `MenuItem`, `IconButton`)
2. **Estado nuevo**:
   - `customTags: CustomTag[]` — tags personalizados del usuario para este comercio
   - `dialogOpen: boolean` — controla dialog de crear/editar
   - `editingTag: CustomTag | null` — si es null, estamos creando; si tiene valor, editando
   - `dialogValue: string` — valor del input en el dialog
   - `menuAnchor: HTMLElement | null` — anchor del menú contextual
   - `menuTag: CustomTag | null` — tag seleccionado en el menú
   - `confirmDeleteOpen: boolean` — controla dialog de confirmación de borrado
3. **`loadCustomTags()`**: query a `customTags` donde `userId == user.uid` y `businessId == businessId`
4. **Llamar `loadCustomTags()`** en el `useEffect` existente (junto con `loadTags`)
5. **`handleCreateOrEdit()`**: si `editingTag` es null → `addDoc`, sino → `updateDoc`. Trim + validar largo. Optimistic update.
6. **`handleDelete()`**: `deleteDoc` + optimistic update
7. **Render**: después de los chips predefinidos:
   - Mapear `customTags` como chips outlined/secondary con ícono `LabelOutlined`
   - onClick de cada custom tag → abrir menú con "Editar" / "Eliminar"
   - Chip "+" (Agregar) al final, solo si `user` existe → abre dialog
8. **Dialog de crear/editar**: TextField con maxLength 30, botón Guardar
9. **Dialog de confirmación de borrado**: texto + botones Cancelar/Eliminar
10. **Menu contextual**: MenuItem "Editar" y "Eliminar"

### Paso 3: Build & test local

- `npm run build` para verificar que compila sin errores
- Test manual con emuladores: crear, editar, eliminar tags personalizados

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `firestore.rules` | Agregar regla `customTags` |
| `src/components/business/BusinessTags.tsx` | Modificar (cambio principal) |
