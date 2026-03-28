# PRD: Harden useForceUpdate reload loop protection

**Issue:** #206 item 4
**Priority:** Medium
**Effort:** Small (1-2h)

## Problema

`useForceUpdate.ts` usa `sessionStorage` para un cooldown que evita reload loops. Pero `sessionStorage` se limpia al cerrar la tab, y algunos browsers mobile lo limpian en reload. Si `sessionStorage` no persiste, el cooldown no funciona y el hook podria causar un reload infinito si `minVersion` > bundle version.

## Archivos afectados

- `src/hooks/useForceUpdate.ts`

## Solucion propuesta

1. Usar `localStorage` en vez de `sessionStorage` para el cooldown (con TTL de 5 min)
2. Agregar un contador de reloads en `localStorage` — si supera 3 en 5 minutos, detener
3. Mostrar un mensaje manual ("Nueva version disponible, recarga la pagina") en vez de forzar reload automatico despues del limite

## Criterios de aceptacion

- [ ] No hay reload loop posible aunque `sessionStorage` falle
- [ ] El usuario siempre puede acceder a la app
- [ ] Test unitario para el escenario de cooldown
