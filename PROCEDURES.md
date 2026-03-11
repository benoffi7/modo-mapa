# Procedimientos de Desarrollo

## Flujo para corrección de errores / mejoras

1. **Crear issue en GitHub** con descripción del error o mejora
2. **Crear rama** desde `main` con nombre `fix/<issue-number>-<descripcion-corta>` o `feat/<issue-number>-<descripcion-corta>`
3. **Implementar la solución** en la rama
4. **Commit** con referencia al issue (ej: `Fix #1: descripción`)
5. **Crear PR** hacia `main` con resumen y test plan
6. **Merge** del PR una vez validado

### Convenciones de naming
- Ramas fix: `fix/<issue>-<descripcion>`
- Ramas feature: `feat/<issue>-<descripcion>`
- Commits: mensaje descriptivo + `Fix #N` o `Closes #N`

### Checklist pre-PR
- [ ] Build pasa sin errores (`npm run build`)
- [ ] Testeado en mobile
- [ ] Sin secretos en el código
