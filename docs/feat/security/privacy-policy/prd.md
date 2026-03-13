# PRD: Politica de privacidad

## Issue

[#56](https://github.com/benoffi7/modo-mapa/issues/56)

## Problema

La app no tiene una politica de privacidad visible para los usuarios. Con Firebase Analytics activo y la opcion de opt-out (#61), es necesario informar a los usuarios sobre que datos se recopilan y como se usan.

## Objetivo

Crear una pagina de politica de privacidad accesible desde el menu lateral que cubra todas las practicas de datos de la app.

## Requisitos funcionales

### RF-1: Contenido de la politica

La politica debe cubrir:

1. **Datos recopilados**
   - Auth anonimo (UID generado automaticamente)
   - Contenido generado: comentarios, ratings, favoritos, tags, fotos de menu, feedback, nivel de gasto
   - Datos de uso: Firebase Analytics (GA4) — eventos anonimos de navegacion y uso

2. **Almacenamiento**
   - Cloud Firestore (datos estructurados)
   - Firebase Storage (fotos de menu)
   - localStorage (preferencias locales: tema, visitas recientes, consentimiento analytics)

3. **Seguridad**
   - Firebase App Check (reCAPTCHA Enterprise)
   - Firestore Security Rules (acceso por usuario)
   - Rate limiting en Cloud Functions
   - Moderacion automatica de contenido

4. **Derechos del usuario**
   - Desactivar Analytics desde Configuracion (#61)
   - Eliminar contenido propio (comentarios, ratings, favoritos, tags)
   - Perfil publico/privado configurable

5. **Contacto**
   - Usar el formulario de Feedback existente con nuevas categorias:
     - "Datos de usuario" — consultas sobre datos personales, privacidad, eliminacion
     - "Datos de comercio" — consultas sobre informacion de comercios

### RF-2: Ubicacion en la UI

- **Link en footer del menu lateral** (seccion navegacion principal)
- Abre como seccion dentro del SideMenu (patron existente: `activeSection`)
- No requiere nueva ruta — consistente con el patron de secciones del menu

### RF-3: Formato

- Texto estatico en espanol (es-AR)
- Secciones con titulos claros
- Scroll dentro del drawer del menu lateral
- Fecha de ultima actualizacion visible

## Requisitos no funcionales

- El contenido es estatico — no requiere fetch a Firestore
- Debe ser legible en mobile (texto con buen contraste, font size adecuado)
- Compatible con dark mode
- No requiere autenticacion para verlo (pero esta dentro del menu lateral que requiere que la app este cargada)

## Fuera de alcance

- Banner de consentimiento de cookies (la app usa localStorage, no cookies de tracking)
- Pagina standalone con URL publica (se puede agregar despues si es necesario)
- Traduccion a otros idiomas
- Compliance legal formal (GDPR/CCPA) — app interna para empleados

## Dependencias

- Opt-out de Analytics (#61) — para poder referenciar la opcion en la politica

## Notas de implementacion

- Agregar `'privacy'` al tipo `SectionType` en SideMenu
- Crear componente `PrivacyPolicy.tsx` en `src/components/menu/`
- Agregar item de navegacion con icono `PolicyOutlined` o `PrivacyTipOutlined`
- Footer link adicional con texto "Politica de privacidad"
