# Plan: Gaps pendientes en listas v2.18

**Fecha:** 2026-03-19
**Specs:** [specs.md](specs.md)

---

## Orden de implementación

Los gaps tienen dependencias:
- G2 depende de G1 (si el query falla, necesitamos Cloud Function — mismo patrón)
- G3 es independiente
- G4 es independiente y de baja prioridad

### Paso 1: G1 — UI ver/remover editores

**Archivos:**
1. `src/services/sharedLists.ts` — agregar `removeEditor(listId, targetUid)`
2. `src/components/menu/EditorsDialog.tsx` — **NUEVO**
3. `src/components/menu/SharedListsView.tsx` — hacer chip clickeable + render dialog

**Validación:**
- `npx tsc --noEmit`
- `npx eslint src/components/menu/EditorsDialog.tsx src/components/menu/SharedListsView.tsx`
- Deploy functions (ya desplegada, solo cambio de frontend)

### Paso 2: G2 — Editor agrega items desde AddToListDialog

**Archivos:**
1. `src/components/business/AddToListDialog.tsx` — segundo query + merge + badge

**Riesgo:** Query `array-contains` puede fallar por rules. Si falla:
1. Crear `functions/src/callable/getEditableLists.ts` — **NUEVO**
2. Exportar en `functions/src/index.ts`
3. Cambiar `AddToListDialog.tsx` para usar la Cloud Function
4. Deploy function
5. Push a staging

**Validación:**
- Probar en staging: crear lista, invitar editor, loguearse como editor, agregar comercio desde mapa
- Verificar que el comercio aparece en la lista

### Paso 3: G3 — Favorito individual

**Archivos:**
1. `src/components/menu/SharedListsView.tsx` — agregar FavoriteIcon toggle por item en vista compartida

**Validación:**
- Probar en staging: abrir lista compartida, toggle favorito, verificar que persiste

### Paso 4: Tests + pre-staging check

**Archivos:**
1. `src/components/menu/EditorsDialog.test.tsx` — **NUEVO** (o inline)
2. Actualizar mock de `inviteListEditor.test.ts` para `getAuth().getUserByEmail`
3. `scripts/pre-staging-check.sh` — correr y verificar que pasa

**Validación:**
- `npm run test:run` (frontend + functions)
- `scripts/pre-staging-check.sh`

### Paso 5: Deploy a staging y testing final

1. `git push origin staging`
2. `npx firebase-tools deploy --only functions --project modo-mapa-app` (si hubo functions nuevas)
3. Esperar GH Action
4. Testing en staging:
   - [ ] Owner invita editor por email
   - [ ] Owner ve lista de editores y puede remover
   - [ ] Editor ve lista colaborativa en AddToListDialog
   - [ ] Editor agrega comercio desde el mapa
   - [ ] Favorito individual funciona en lista compartida
   - [ ] Admin toggle featured funciona
   - [ ] Listas destacadas aparecen en cliente

---

## Paso 6 (opcional): G4 — Indicador addedBy

Solo si hay tiempo. No bloquea merge.

1. `src/components/menu/SharedListsView.tsx` — mostrar "Agregado por X" en items de listas colaborativas

---

## Notas

- **No crear Cloud Functions innecesarias.** Primero probar query directo. Solo si falla por rules, mover a CF.
- **Cada paso se commitea y se puede desplegar independientemente.**
- **Correr `scripts/pre-staging-check.sh` después de cada paso.**
