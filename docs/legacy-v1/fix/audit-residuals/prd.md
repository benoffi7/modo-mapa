# PRD: Correccion de Hallazgos Residuales de Auditorias

## Contexto

Tras la re-evaluacion final de las auditorias de seguridad (9.1/10) y arquitectura
(8.9/10), quedan hallazgos pendientes de severidad baja-media que pueden resolverse
en una unica iteracion. Este PRD consolida ambas auditorias para atacar todo junto.

## Objetivo

Resolver todos los hallazgos pendientes viables de ambas auditorias, llevando las
puntuaciones por encima de 9.3/10 (seguridad) y 9.2/10 (arquitectura).

## Alcance

### Incluido (12 items)

#### Seguridad

| ID | Hallazgo | Severidad | Esfuerzo |
|----|----------|-----------|----------|
| S-B01 | `console.error` sin guard DEV (3 restantes) | Bajo | 5 min |
| S-B06 | CI/CD sin lint antes del deploy | Bajo | 10 min |
| S-N01 | Capa de servicios sin validacion de entrada | Bajo | 20 min |
| S-N02 | `ratings.ts` sobreescribe `createdAt` en upsert | Bajo | 15 min |

#### Arquitectura

| ID | Hallazgo | Severidad | Esfuerzo |
|----|----------|-----------|----------|
| A-P1 | `services/feedback.ts` acepta `category: string` | P1 | 5 min |
| A-P2 | `FeedbackForm` no usa servicio de feedback | P1 | 15 min |
| A-P3 | `converters.ts` tiene `toDate()` local duplicada | P1 | 5 min |
| A-P5 | `npm audit` ausente en CI | P2 | 10 min |
| A-P6 | Cloud Functions deploy automatico en CI | P2 | 20 min |
| A-P7 | `BusinessTags` no descompuesto (285 lineas) | P2 | 30 min |

#### Documentacion

| ID | Hallazgo | Esfuerzo |
|----|----------|----------|
| D-01 | Actualizar PROJECT_REFERENCE.md con cambios | 15 min |
| D-02 | Actualizar CODING_STANDARDS.md si aplica | 10 min |

### Excluido (razones)

| ID | Hallazgo | Razon |
|----|----------|-------|
| M-02 | Rate limiter en memoria | Riesgo aceptado (1 admin) |
| I-02 | Admin email hardcodeado | Informativo, no urgente |
| I-05 | Permisos Claude settings | Solo local |
| A-P4 | Cobertura de tests baja | Requiere 2-3 dias, iteracion separada |
| A-P8 | React Router | Cambio estructural grande, P3 |
| A-P9 | Preview environments | Infra, P3 |
| A-P10 | Error tracking (Sentry) | Feature nueva, P3 |

## Criterios de exito

1. Build limpio (`tsc --noEmit` + `vite build`) sin errores
2. Tests existentes pasan
3. Ambas auditorias re-evaluadas con puntuaciones superiores
4. Documentacion actualizada

## Estimacion total

~2.5 horas de implementacion.
