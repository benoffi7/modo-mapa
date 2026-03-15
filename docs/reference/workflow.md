# Workflow: Colaboracion asincrona via Telegram + GitHub Pages

**Fecha:** 2026-03-15
**Ultima actualizacion:** 2026-03-15

---

## Flujo de trabajo actual

```
[Usuario en Telegram] → pide feature/fix/review
        ↓
[Claude Code] → crea docs/codigo → push a main
        ↓
[GitHub Pages] → publica docs (automatico en merge a main)
        ↓
[Usuario] → lee en GH Pages → da feedback via Telegram
        ↓
[Claude Code] → itera sobre feedback → push actualizado
```

### Convenciones

1. **PRDs primero**: antes de escribir codigo, se crea el PRD en `docs/feat/{domain}/{feature}/prd.md` y se pushea para review
2. **Feedback = defact**: el usuario revisa el PRD y da "defact" (aprobacion) o correcciones
3. **Iteracion rapida**: cada ida y vuelta es un commit + push, el usuario ve los cambios en GH Pages
4. **Documentacion viva**: los PRDs evolucionan con el feedback antes de convertirse en specs + plan

### Estructura de documentacion por feature

```
docs/feat/{domain}/{feature}/
  ├── prd.md       ← requisitos y scope (se crea primero)
  ├── specs.md     ← detalle tecnico (post-aprobacion del PRD)
  ├── plan.md      ← pasos de implementacion
  └── changelog.md ← archivos modificados (post-implementacion)
```

---

## Mejoras identificadas

### 1. Confirmacion de recepcion

**Problema:** Cuando el usuario pide algo via Telegram, no queda claro si Claude recibio el mensaje completo o si esta trabajando.

**Mejora:** Claude deberia responder inmediatamente con un ACK breve ("Entendido, estoy armando el PRD para X. Te aviso cuando lo pushee.") antes de empezar a trabajar.

### 2. Links directos en respuestas

**Problema:** Decir "ya lo subi" no es suficiente -- el usuario tiene que buscar el archivo.

**Mejora:** Siempre incluir el link directo al archivo en GitHub Pages:
```
Listo, PRD subido:
https://benoffi7.github.io/modo-mapa/feat/infra/telegram-notifications/prd.html
```

### 3. Resumen inline del PRD

**Problema:** El usuario tiene que ir a GH Pages para ver el contenido. Si esta en el celular, puede ser incomodo.

**Mejora:** Incluir un TL;DR (3-5 bullets) en la respuesta de Telegram, con el link al doc completo para detalles.

### 4. Versionado de feedback

**Problema:** El feedback del usuario queda solo en el chat de Telegram, no queda registro en el repo.

**Mejora:** Cuando el usuario da feedback sustancial, crear un archivo `feedback-log.md` en la carpeta del feature con fecha, feedback recibido, y cambios aplicados. Esto ayuda a trackear decisiones.

### 5. Branch para features grandes (IMPLEMENTADO)

~~**Problema:** Pushear todo a main puede romper el deploy si hay cambios de codigo (no solo docs).~~

**Regla vigente (desde 2026-03-15):**

- **Solo docs del workflow** (prd.md, specs.md, plan.md) → push directo a main. Sin rama, sin auditorias, sin CI check. Actualizar `_sidebar.md` al agregar docs nuevos.
- **Todo lo demas** (codigo, config, rules, scripts, changelogs) → crear branch, PR, `/merge` con checklist completa.

### 6. Checklist de review en el PRD

**Mejora:** Agregar al final de cada PRD una seccion "Para el review" con preguntas concretas para el reviewer:
```markdown
## Para el review
- [ ] El problema esta bien definido?
- [ ] La solucion propuesta tiene sentido?
- [ ] El scope es correcto? (algo sobra o falta?)
- [ ] Las prioridades estan bien?
- [ ] Algun concern de seguridad?
```

---

## Notas sobre el entorno

- El usuario interactua desde un **bot de Telegram** (mobile-first, mensajes cortos)
- Preferir respuestas concisas con links, no walls of text
- Los docs en GitHub Pages son el "single source of truth" para decisions
- El chat de Telegram es para coordinacion y feedback rapido
