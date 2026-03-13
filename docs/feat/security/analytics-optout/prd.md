# PRD: Configuracion de privacidad — Opt-out de Analytics

## Issue

[#61](https://github.com/benoffi7/modo-mapa/issues/61)

## Problema

Firebase Analytics (GA4) esta siempre activo en produccion sin posibilidad de que el usuario lo desactive. Esto no respeta la preferencia de privacidad del usuario y es prerequisito para la politica de privacidad (#56).

## Objetivo

Permitir que cada usuario active/desactive el envio de datos de Analytics desde el panel de configuracion existente (#59).

## Requisitos funcionales

### RF-1: Toggle en panel de configuracion

- Agregar seccion "Datos de uso" en `SettingsPanel` (debajo de "Notificaciones")
- Toggle "Enviar datos de uso" con texto explicativo: "Ayuda a mejorar la app enviando datos anonimos de uso"
- Por defecto: deshabilitado (modelo opt-in)

### RF-2: Persistencia dual

- **localStorage** (`analytics-consent`): lectura inmediata al inicializar analytics, antes de que Firestore este disponible
- **Firestore** (`userSettings.analyticsEnabled`): sincronizacion cross-device cuando el usuario esta autenticado
- Prioridad: Firestore > localStorage > default (false)

### RF-3: Comportamiento al desactivar

- `trackEvent()` y `setUserProperty()` se convierten en no-op
- Usar `setAnalyticsCollectionEnabled(analytics, false)` del SDK de Firebase para detener la recoleccion a nivel SDK
- El cambio es inmediato (no requiere reload)

### RF-4: Comportamiento al activar

- Reactivar con `setAnalyticsCollectionEnabled(analytics, true)`
- `trackEvent()` y `setUserProperty()` vuelven a funcionar normalmente

## Requisitos no funcionales

- No impactar el bundle size significativamente (analytics ya es lazy-loaded)
- Compatible con el flujo existente de `useUserSettings` (optimistic UI con revert on error)
- La lectura de localStorage debe ser sincrona al boot para no enviar eventos antes de conocer la preferencia

## Fuera de alcance

- Banner de consentimiento al primer uso (se evaluara en #56)
- Configuracion granular por tipo de evento
- GDPR compliance completo (app interna)

## Dependencias

- Panel de configuracion de usuario (#59) — ya implementado
- Firebase Analytics (#57) — ya implementado

## Relacion con otros issues

- Prerequisito para: #56 (Politica de privacidad)
