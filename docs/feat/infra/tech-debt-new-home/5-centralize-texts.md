# PRD: Centralize user-facing text strings

**Issue:** #206 item 5
**Priority:** Low
**Effort:** Medium (3-5h)

## Problema

Toasts, labels, placeholders, mensajes de error y titulos de dialogos estan dispersos como strings literales en ~50+ componentes. Esto causa:
- Faltas de ortografia no detectadas hasta runtime
- Inconsistencias de tono (mezcla formal/informal)
- Dificultad para auditar todos los textos

## Solucion propuesta

**Fase 1 — Strings criticos:** Centralizar toasts y mensajes de error/exito en archivos por dominio:
- `src/constants/messages/lists.ts`
- `src/constants/messages/auth.ts`
- `src/constants/messages/business.ts`
- etc.

**Fase 2 — Labels y UI text:** Centralizar labels de componentes que se repiten (estados vacios, loading, etc.)

**No hacer:** i18n completo ni libreria de traducciones. La app es solo en espanol argentino.

## Criterios de aceptacion

- [ ] Toasts de exito/error centralizados por dominio
- [ ] copy-auditor puede escanear archivos de constantes en vez de todo src/
- [ ] Sin cambios funcionales visibles
