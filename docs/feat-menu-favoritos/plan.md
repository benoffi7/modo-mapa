# Plan Técnico: Menú lateral con sección Favoritos

**Issue:** #7
**Fecha:** 2026-03-11

## Pasos de implementación

### Paso 1: Crear `FavoritesList.tsx`
- Crear `src/components/menu/FavoritesList.tsx`
- Query Firestore `favorites` por `userId`
- Cruzar con JSON local para resolver Business
- Renderizar lista con nombre, categoría (chip), dirección
- Click en item → `setSelectedBusiness` + `onNavigate` (cierra drawer)
- Botón quitar favorito → `deleteDoc` + remove del estado local
- Estado vacío con ícono + texto

### Paso 2: Crear `SideMenu.tsx`
- Crear `src/components/layout/SideMenu.tsx`
- MUI `Drawer` anchor left, width `min(300px, 80vw)`
- Estado interno `activeSection: 'nav' | 'favorites'`
- Vista nav: header usuario (avatar + nombre + editar) + lista navegación
- Vista favorites: toolbar con botón atrás + FavoritesList
- Dialog inline para editar displayName
- Items Comentarios/Feedback deshabilitados con "Próximamente"

### Paso 3: Modificar `SearchBar.tsx`
- Agregar prop `onMenuClick: () => void`
- Conectar al `onClick` del IconButton de MenuIcon (línea 33)

### Paso 4: Modificar `AppShell.tsx`
- Agregar estado `menuOpen`
- Renderizar `SideMenu` con props `open` y `onClose`
- Pasar `onMenuClick={() => setMenuOpen(true)}` a SearchBar

### Paso 5: Build & test local
- `npm run build` para verificar compilación
- Test manual con emuladores

## Archivos afectados

| Archivo | Tipo |
|---------|------|
| `src/components/menu/FavoritesList.tsx` | Crear |
| `src/components/layout/SideMenu.tsx` | Crear |
| `src/components/search/SearchBar.tsx` | Modificar |
| `src/components/layout/AppShell.tsx` | Modificar |
