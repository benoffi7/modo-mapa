/**
 * HELP_GROUPS registry — contenido estatico de la pantalla Perfil > Ayuda y soporte.
 *
 * Patron: equivalente a `components/home/homeSections.ts`. Mantiene el contenido
 * (titulo, descripcion, icono JSX) separado del render (`HelpSection.tsx`), asi
 * agregar/editar un item de ayuda es una sola edicion en el array sin tocar el
 * componente consumidor.
 *
 * Fuente de verdad de features en `docs/reference/features.md`. Ver guard #311
 * (`docs/reference/guards/311-help-docs.md`) para la regla de sincronizacion 1:1.
 *
 * Convenciones:
 * - Voseo rioplatense (Tocá, Andá, Activá, Registrá). Ver guard #309.
 * - Ids unicos a nivel global (validado por test en `__tests__/helpGroups.test.ts`).
 * - Counts dinamicos (avatares) derivados de la fuente (`AVATAR_OPTIONS.length`)
 *   para evitar drift con la constante real.
 */

import type { ReactElement } from 'react';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import AccountBoxOutlinedIcon from '@mui/icons-material/AccountBoxOutlined';
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import ExitToAppOutlinedIcon from '@mui/icons-material/ExitToAppOutlined';
import { AVATAR_OPTIONS } from '../../constants/avatars';

export interface HelpItem {
  id: string;
  icon: ReactElement;
  title: string;
  description: string;
}

export interface HelpGroup {
  label: string;
  items: HelpItem[];
}

/**
 * Numero real de avatares disponibles en `AvatarPicker`. Se deriva de la
 * constante para que la descripcion en ayuda no se desincronice cuando se
 * agreguen/quiten opciones (ver guard #311, regla "Avatares sincronizados").
 */
const AVATAR_COUNT = AVATAR_OPTIONS.length;

export const HELP_GROUPS: HelpGroup[] = [
  {
    label: 'Inicio',
    items: [
      {
        id: 'inicio',
        icon: <HomeOutlinedIcon color="primary" />,
        title: 'Pantalla principal',
        description:
          'Tu pantalla principal con saludo personalizado y acciones rápidas (buscar por categoría, Sorprendeme). Sección "Especiales" con tarjetas creadas por el equipo (promos del día, listas destacadas, logros). Sección "Tendencia cerca tuyo" con los comercios trending filtrados por tu ubicación (GPS, localidad o zona por defecto) con radio progresivo 1-5 km. Sección "Novedades" que agrupa tus notificaciones no leídas por tipo. Sección "Para ti" con sugerencias personalizadas. Sección "Tus intereses" con comercios filtrados por los tags que seguís. Si tenés un check-in reciente sin calificar, te aparece un banner sugiriendo calificar. Tirá hacia abajo para refrescar las secciones del Inicio.',
      },
      {
        id: 'sorprendeme',
        icon: <AutoAwesomeOutlinedIcon color="primary" />,
        title: 'Sorprendeme',
        description:
          'Tocá Sorprendeme en las acciones rápidas del Inicio para que la app elija un comercio al azar que no hayas visitado, priorizando los cercanos (radio 5 km) si tenés GPS activo. Si ya los visitaste a todos, hace fallback a uno totalmente aleatorio. Te avisa con un toast con el nombre del comercio elegido.',
      },
      {
        id: 'tus_intereses_home',
        icon: <ExploreOutlinedIcon color="primary" />,
        title: 'Tus intereses (Inicio)',
        description:
          'En el Inicio, la sección **Tus intereses** es un feed de descubrimiento que te muestra comercios filtrados por los tags que seguís (hasta 5 por tag). Si todavía no seguís ningún tag, ves sugerencias para empezar. Para gestionar la lista de tags entrá al item "Tus intereses (Perfil)".',
      },
      {
        id: 'primeros_pasos',
        icon: <SchoolOutlinedIcon color="primary" />,
        title: 'Primeros pasos',
        description:
          'Tocá el card de Primeros pasos en el menú lateral para ver acciones sugeridas según tu nivel de uso. A medida que completás acciones (primera calificación, primer favorito, primer check-in, primer tag, explorar ranking), el card avanza y muestra los próximos pasos. Al completar todas las tareas, recibís un mensaje de celebración. Podés colapsar o descartar el card.',
      },
    ],
  },
  {
    label: 'Buscar',
    items: [
      {
        id: 'buscar',
        icon: <SearchIcon color="primary" />,
        title: 'Mapa y búsqueda',
        description:
          'Buscá comercios por nombre, dirección o categoría. Filtrá por tags y nivel de gasto ($/$$/$$$). Tocá el botón de ubicación para centrar el mapa en tu posición. Usá el toggle mapa/lista para alternar entre vista de mapa y lista de resultados ordenados por distancia. Los markers del mapa son accesibles con Tab: Enter o Espacio abren el detalle del comercio. Las acciones rápidas del Inicio te llevan directamente acá con el filtro aplicado. Si el mapa no carga (Maps API caída o sin conexión), la app cambia automáticamente a vista de lista para que sigas buscando.',
      },
      {
        id: 'comercio',
        icon: <StorefrontOutlinedIcon color="primary" />,
        title: 'Detalle de comercio',
        description:
          'Tocá un pin o un comercio en cualquier lista para ver el detalle. Primero se abre un sheet compacto (50dvh) con header (nombre, calificación, acción rápida) y CTA "Ver detalles" que abre la pantalla full. La pantalla full vive en `/comercio/:id` y tiene 5 secciones organizadas como chip tabs sticky: Criterios, Precio, Tags, Foto y Opiniones. Compartís una pestaña específica con el deep link `/comercio/:id?tab=criterios|precio|tags|foto|opiniones`. Dentro del tab Opiniones hay sub-pestañas internas Comentarios y Preguntas, con threads de un nivel, likes y badge "Mejor respuesta" cuando la respuesta tiene likeCount >= 1 y es la más votada. El límite de 20 por día es compartido entre comentarios y preguntas. Podés calificar (global + multi-criterio), marcar favorito, compartir con deep link, hacer check-in, abrir en Google Maps y crear tags personalizados. Sin conexión, tus acciones se encolan y se sincronizan al reconectar.',
      },
      {
        id: 'checkin',
        icon: <PlaceOutlinedIcon color="primary" />,
        title: 'Check-in',
        description:
          'Registrá tu visita a un comercio tocando "Hacer check-in" en el detalle. Hay un cooldown de 4 horas por comercio y un límite de 10 check-ins por día. Si estás a más de 500 metros, te avisa pero no te bloquea. Podés deshacer el check-in tocando el botón de nuevo. Tu historial de check-ins aparece en el menú lateral, sección "Mis visitas", con fecha y hora. En tu perfil se cuentan las visitas totales y comercios únicos.',
      },
      {
        id: 'confirmacion_salir',
        icon: <ExitToAppOutlinedIcon color="primary" />,
        title: 'Confirmación al salir',
        description:
          'Si estás escribiendo un comentario, una pregunta o un feedback y querés cerrar la pantalla con texto sin guardar, la app te avisa con el diálogo "Descartar cambios?" para que no pierdas lo que escribiste. El mismo flujo aplica al editar tu calificación o al cerrar el sheet del comercio con cambios pendientes (hook `useUnsavedChanges` + `DiscardDialog`).',
      },
      {
        id: 'offline',
        icon: <CloudOffOutlinedIcon color="primary" />,
        title: 'Modo offline',
        description:
          'Modo Mapa funciona sin conexión. Tus acciones (calificaciones, comentarios, favoritos, niveles de gasto, tags) se encolan en tu dispositivo y se envían automáticamente cuando volvés a tener internet. Un indicador arriba muestra "Sin conexión" y la cantidad de acciones pendientes. En el menú lateral aparece la sección "Pendientes" con el detalle de cada acción y opción de descartar o reintentar las fallidas. Cuando los datos de un comercio vienen de cache vas a ver el aviso "Datos guardados - puede no estar actualizado". Límite: 50 acciones en cola, las más viejas se descartan a los 7 días.',
      },
    ],
  },
  {
    label: 'Social',
    items: [
      {
        id: 'social',
        icon: <PeopleOutlinedIcon color="primary" />,
        title: 'Actividad, seguidos y rankings',
        description:
          'En la pestaña Social tenés cuatro secciones: Actividad (feed de lo que hacen los usuarios que seguís: ratings, comentarios, favoritos), Seguidos (buscá y seguí a otros usuarios con perfil público, máximo 200), Recomendaciones (comercios que te recomendaron, con badge de no leídas y "Marcar todas como leídas" al abrir la sección) y Rankings (ver el item dedicado). En Actividad podés tirar hacia abajo para refrescar el feed.',
      },
      {
        id: 'rankings',
        icon: <LeaderboardOutlinedIcon color="primary" />,
        title: 'Rankings',
        description:
          'Ranking semanal, mensual, anual e histórico con score por actividad. Sistema de tiers (Bronce, Plata, Oro, Diamante) con barra de progreso al siguiente nivel. 11 badges (primera reseña, fotógrafo, popular, racha de 7 días, etc.). Streak de días consecutivos con gráfico sparkline de evolución. Filtro "Mi zona" que muestra comercios trending en tu área en lugar del ranking de usuarios. Compartís tu posición con Web Share. Tocá el nombre de cualquier usuario para ver su perfil público.',
      },
      {
        id: 'perfil_publico',
        icon: <AccountBoxOutlinedIcon color="primary" />,
        title: 'Perfil público de otros usuarios',
        description:
          'Tocá el nombre de cualquier usuario en comentarios, rankings o listas para abrir su perfil público en un bottom sheet: avatar, fecha de registro, estadísticas (comentarios, ratings, favoritos, likes recibidos, fotos aprobadas, ranking), badges top-3, últimos 5 comentarios con link al comercio y botón Seguir. Solo se muestra si el usuario tiene el perfil público activado en su configuración.',
      },
      {
        id: 'recomendaciones',
        icon: <SendOutlinedIcon color="primary" />,
        title: 'Recomendaciones',
        description:
          'Recomendá un comercio a otro usuario desde el detalle. Podés agregar un mensaje opcional (hasta 200 caracteres). Límite: 20 recomendaciones por día (te avisa cuando te quedan 3 o menos). Las que recibís aparecen en Social > Recomendaciones con badge de no leídas. Tocá una para ir al comercio. Al abrir la sección, se marcan todas como leídas.',
      },
    ],
  },
  {
    label: 'Listas',
    items: [
      {
        id: 'listas',
        icon: <BookmarkBorderIcon color="primary" />,
        title: 'Favoritos y listas',
        description:
          'En la pestaña Listas tenés cinco secciones: Favoritos (con filtros por nombre, categoría y orden, y distancia al comercio), Listas (creás listas temáticas eligiendo un icono personalizado entre 30 opciones y un color propio, las hacés públicas o privadas), Compartidas conmigo (listas ajenas donde te invitaron como editor), Destacadas (listas curadas automáticamente: top calificadas, más comentadas, favoritas de la comunidad) y Recientes (historial unificado: comercios visitados localmente + tus check-ins de Firestore, deduplicados por comercio, con la fecha más reciente). Máximo 10 listas y 50 comercios por lista. Podés copiar una lista ajena entera o agregar todos sus comercios a tus favoritos de una sola vez. El historial de check-ins también está disponible en el menú lateral, sección "Mis visitas". Tirá hacia abajo en Favoritos o Recientes para refrescar la lista.',
      },
      {
        id: 'colaborativas',
        icon: <PeopleOutlinedIcon color="primary" />,
        title: 'Listas colaborativas',
        description:
          'Podés invitar hasta 5 editores por email a cualquiera de tus listas. Los editores pueden agregar y quitar comercios. Las listas donde te invitaron aparecen en la sección "Compartidas conmigo" con un badge que las identifica. Cada comercio muestra quién lo agregó. Para gestionar editores, entrá a la lista y tocá el icono de compartir.',
      },
    ],
  },
  {
    label: 'Perfil',
    items: [
      {
        id: 'perfil',
        icon: <PersonOutlinedIcon color="primary" />,
        title: 'Tu perfil',
        description: `Tu perfil muestra un avatar personalizable (tocá para elegir entre ${AVATAR_COUNT} opciones), tus estadísticas (lugares visitados, reseñas, seguidores, favoritos) y tus logros con barra de progreso. Tocá "Ver todos" para ver la grilla completa de logros con la descripción de cómo completar cada uno.`,
      },
      {
        id: 'tus_intereses_perfil',
        icon: <LocalOfferOutlinedIcon color="primary" />,
        title: 'Tus intereses (Perfil)',
        description:
          'Andá a Perfil → **Tus intereses** para gestionar los tags que seguís (agregar, quitar, ver sugerencias). Límite: 20 tags. Lo que elegís acá alimenta el feed "Tus intereses" del Inicio y los chips de descubrimiento.',
      },
      {
        id: 'estadisticas',
        icon: <BarChartOutlinedIcon color="primary" />,
        title: 'Estadísticas',
        description:
          'Tocá la card de estadísticas en tu perfil para abrir la pantalla **Estadísticas**: distribución de tus calificaciones (pie), tags más usados (pie) y top 10 de comercios más favoriteados, comentados y calificados. No es un tab del menú lateral — vive dentro del flujo Perfil.',
      },
      {
        id: 'logros',
        icon: <EmojiEventsOutlinedIcon color="primary" />,
        title: 'Logros',
        description:
          'Hay 8 logros disponibles: Explorador (check-ins), Social (seguidos), Crítico (calificaciones), Viajero (localidades), Coleccionista (favoritos), Fotógrafo (fotos de menú), Embajador (recomendaciones) y En racha (días consecutivos). Tocá cualquier logro para ver qué necesitás hacer para completarlo. Los iconos de perfil verificado (Local Guide, Visitante Verificado, Opinión Confiable) son un sistema separado de badges de actividad visible en el perfil de otros usuarios.',
      },
      {
        id: 'notificaciones',
        icon: <NotificationsOutlinedIcon color="primary" />,
        title: 'Notificaciones',
        description:
          'Tocá la campana o andá a Perfil > Notificaciones. Badge con las no leídas. Recibís avisos de likes en comentarios, respuestas a tus comentarios, fotos aprobadas o rechazadas, cambios en rankings, respuestas a feedback, nuevos seguidores y recomendaciones. En Home, la sección "Novedades" (ActivityDigestSection) agrupa tus no leídas por tipo. Podés elegir la frecuencia del digest en Configuración > Notificaciones: tiempo real (default, polling cada 5 min), diaria o semanal. Tocá una notificación para ir al comercio o marcá todas como leídas. Podés desactivar cada tipo en Configuración. Tirá hacia abajo para refrescar la lista de notificaciones.',
      },
    ],
  },
  {
    label: 'Ajustes',
    items: [
      {
        id: 'cuenta',
        icon: <AccountCircleOutlinedIcon color="primary" />,
        title: 'Cuenta',
        description:
          'Por defecto tu cuenta es temporal (anónima). Podés crear una cuenta con email y contraseña para sincronizar tus datos entre dispositivos. Para iniciar sesión en otro dispositivo, usá tu email y contraseña. Después de registrarte, verificá tu email. Podés cambiar tu contraseña desde Configuración. Si olvidaste tu contraseña, tocá "Olvidé mi contraseña" en el diálogo de inicio de sesión.',
      },
      {
        id: 'onboarding',
        icon: <CelebrationOutlinedIcon color="primary" />,
        title: 'Onboarding de cuenta',
        description:
          'Como usuario temporal (anónimo) vas a ver un banner de onboarding sugiriendo crear cuenta para no perder tus datos, una pantalla de beneficios pre-registro y un recordatorio después de completar unas cuantas interacciones (por ejemplo, 5 calificaciones). Si ya creaste cuenta y no verificaste tu email, vas a ver un nudge en el menú para reenviar el email de verificación.',
      },
      {
        id: 'configuracion',
        icon: <SettingsOutlinedIcon color="primary" />,
        title: 'Configuración',
        description:
          'Accedé desde Perfil > Configuración. Incluye Cuenta (crear cuenta, verificar email, cambiar contraseña, cerrar sesión, eliminar cuenta), Ubicación (localidad por defecto cuando no hay GPS, usada en mapa, sort por cercanía, Sorprendeme y sugerencias), Apariencia (toggle de modo oscuro), Privacidad (perfil público/privado, datos de uso/analytics) y Notificaciones (master, por tipo, y frecuencia del digest: tiempo real, diaria o semanal). La eliminación de cuenta borra permanentemente todos tus datos y no se puede deshacer.',
      },
      {
        id: 'modooscuro',
        icon: <DarkModeOutlinedIcon color="primary" />,
        title: 'Modo oscuro',
        description:
          'Activá o desactivá el modo oscuro desde Configuración > Apariencia. Tu preferencia se guarda automáticamente. Si no lo configurás manualmente, la app respeta la configuración de tu dispositivo (modo claro u oscuro del sistema). El modo oscuro se aplica a toda la interfaz incluyendo mapa, listas y pantallas de carga.',
      },
      {
        id: 'feedback',
        icon: <FeedbackOutlinedIcon color="primary" />,
        title: 'Feedback',
        description:
          'Enviá sugerencias, reportá bugs o dejá tu opinión desde Perfil > Ayuda y soporte > Feedback. Podés adjuntar una imagen o PDF al envío. Si tu reporte es sobre un comercio, podés vincularlo. En "Mis envíos" podés seguir el estado (pendiente, visto, respondido, resuelto) y ver las respuestas del equipo.',
      },
    ],
  },
];
