# Plan: Botón Sorpréndeme

**Feature:** boton-sorprendeme
**Issue:** #139

---

## Paso 1: Agregar botón en SideMenu

- Importar `CasinoIcon` de MUI.
- Importar `useVisitHistory` y `useToast`.
- Agregar ListItemButton después de "Sugeridos para vos".
- Al click: filtrar no visitados, elegir random, setSelectedBusiness, cerrar menú, toast.

## Criterios de merge

- [ ] Botón visible en SideMenu
- [ ] Click abre un comercio no visitado al azar
- [ ] Si todos visitados, abre uno al azar con toast informativo
- [ ] BusinessSheet se abre correctamente
- [ ] Menú se cierra al elegir
- [ ] Lint y tests pasan
