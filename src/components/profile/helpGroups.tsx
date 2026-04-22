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
 * - Voseo rioplatense (Toca, Anda, Activa, Registra). Ver guard #309.
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
          'Tu pantalla principal con saludo personalizado y acciones rapidas (buscar por categoria, Sorprendeme). Seccion "Especiales" con tarjetas creadas por el equipo (promos del dia, listas destacadas, logros). Seccion "Tendencia cerca tuyo" con los comercios trending filtrados por tu ubicacion (GPS, localidad o zona por defecto) con radio progresivo 1-5 km. Seccion "Novedades" que agrupa tus notificaciones no leidas por tipo. Seccion "Para ti" con sugerencias personalizadas. Seccion "Tus intereses" con comercios filtrados por los tags que seguis. Si tenes un check-in reciente sin calificar, te aparece un banner sugiriendo calificar.',
      },
      {
        id: 'primeros_pasos',
        icon: <SchoolOutlinedIcon color="primary" />,
        title: 'Primeros pasos',
        description:
          'Toca el card de Primeros pasos en el menu lateral para ver acciones sugeridas segun tu nivel de uso. A medida que completas acciones (primera calificacion, primer favorito, primer check-in, primer tag, explorar ranking), el card avanza y muestra los proximos pasos. Al completar todas las tareas, recibis un mensaje de celebracion. Podes colapsar o descartar el card.',
      },
    ],
  },
  {
    label: 'Buscar',
    items: [
      {
        id: 'buscar',
        icon: <SearchIcon color="primary" />,
        title: 'Mapa y busqueda',
        description:
          'Busca comercios por nombre, direccion o categoria. Filtra por tags y nivel de gasto ($/$$/$$$). Toca el boton de ubicacion para centrar el mapa en tu posicion. Usa el toggle mapa/lista para alternar entre vista de mapa y lista de resultados ordenados por distancia. Los markers del mapa son accesibles con Tab: Enter o Espacio abren el detalle del comercio. Las acciones rapidas del Inicio te llevan directamente aca con el filtro aplicado.',
      },
      {
        id: 'comercio',
        icon: <StorefrontOutlinedIcon color="primary" />,
        title: 'Detalle de comercio',
        description:
          'Toca un pin o un comercio en cualquier lista para ver el detalle. El header queda fijo con nombre, botones de accion y tu calificacion. Dos pestañas organizan el contenido: Info (criterios de rating, tags predefinidos y personalizados, nivel de gasto, foto de menu con upload comprimido, reportar y chip de staleness si la foto tiene mas de 6 meses) y Opiniones con sub-pestañas Comentarios y Preguntas (respuestas, likes, threads de 1 nivel y badge "Mejor respuesta" cuando la respuesta tiene likeCount >= 1 y es la mas votada). El limite de 20 por dia es compartido entre comentarios y preguntas. Podes calificar (global + multi-criterio), marcar favorito, compartir con deep link, hacer check-in, abrir en Google Maps y crear tags personalizados. Sin conexion, tus acciones se encolan y se sincronizan al reconectar.',
      },
      {
        id: 'checkin',
        icon: <PlaceOutlinedIcon color="primary" />,
        title: 'Check-in',
        description:
          'Registra tu visita a un comercio tocando "Hacer check-in" en el detalle. Hay un cooldown de 4 horas por comercio y un limite de 10 check-ins por dia. Si estas a mas de 500 metros, te avisa pero no te bloquea. Podes deshacer el check-in tocando el boton de nuevo. Tu historial de check-ins aparece en el menu lateral, seccion "Mis visitas", con fecha y hora. En tu perfil se cuentan las visitas totales y comercios unicos.',
      },
      {
        id: 'offline',
        icon: <CloudOffOutlinedIcon color="primary" />,
        title: 'Modo offline',
        description:
          'Modo Mapa funciona sin conexion. Tus acciones (calificaciones, comentarios, favoritos, niveles de gasto, tags) se encolan en tu dispositivo y se envian automaticamente cuando volves a tener internet. Un indicador arriba muestra "Sin conexion" y la cantidad de acciones pendientes. En el menu lateral aparece la seccion "Pendientes" con el detalle de cada accion y opcion de descartar o reintentar las fallidas. Cuando los datos de un comercio vienen de cache vas a ver el aviso "Datos guardados - puede no estar actualizado". Limite: 50 acciones en cola, las mas viejas se descartan a los 7 dias.',
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
          'En la pestaña Social tenes cuatro secciones: Actividad (feed de lo que hacen los usuarios que seguis: ratings, comentarios, favoritos), Seguidos (busca y segui a otros usuarios con perfil publico, maximo 200), Recomendaciones (comercios que te recomendaron, con badge de no leidas y "Marcar todas como leidas" al abrir la seccion) y Rankings (ver el item dedicado).',
      },
      {
        id: 'rankings',
        icon: <LeaderboardOutlinedIcon color="primary" />,
        title: 'Rankings',
        description:
          'Ranking semanal, mensual, anual e historico con score por actividad. Sistema de tiers (Bronce, Plata, Oro, Diamante) con barra de progreso al siguiente nivel. 11 badges (primera reseña, fotografo, popular, racha de 7 dias, etc.). Streak de dias consecutivos con grafico sparkline de evolucion. Filtro "Mi zona" que muestra comercios trending en tu area en lugar del ranking de usuarios. Compartis tu posicion con Web Share. Toca el nombre de cualquier usuario para ver su perfil publico.',
      },
      {
        id: 'perfil_publico',
        icon: <AccountBoxOutlinedIcon color="primary" />,
        title: 'Perfil publico de otros usuarios',
        description:
          'Toca el nombre de cualquier usuario en comentarios, rankings o listas para abrir su perfil publico en un bottom sheet: avatar, fecha de registro, estadisticas (comentarios, ratings, favoritos, likes recibidos, fotos aprobadas, ranking), badges top-3, ultimos 5 comentarios con link al comercio y boton Seguir. Solo se muestra si el usuario tiene el perfil publico activado en su configuracion.',
      },
      {
        id: 'recomendaciones',
        icon: <SendOutlinedIcon color="primary" />,
        title: 'Recomendaciones',
        description:
          'Recomenda un comercio a otro usuario desde el detalle. Podes agregar un mensaje opcional (hasta 200 caracteres). Limite: 20 recomendaciones por dia (te avisa cuando te quedan 3 o menos). Las que recibis aparecen en Social > Recomendaciones con badge de no leidas. Toca una para ir al comercio. Al abrir la seccion, se marcan todas como leidas.',
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
          'En la pestaña Listas tenes cinco secciones: Favoritos (con filtros por nombre, categoria y orden, y distancia al comercio), Listas (creas listas tematicas eligiendo un icono personalizado entre 30 opciones y un color propio, las haces publicas o privadas), Compartidas conmigo (listas ajenas donde te invitaron como editor), Destacadas (listas curadas automaticamente: top calificadas, mas comentadas, favoritas de la comunidad) y Recientes (historial de comercios visitados o vistos, guardado localmente en el dispositivo, separado de los check-ins). Maximo 10 listas y 50 comercios por lista. Podes copiar una lista ajena entera o agregar todos sus comercios a tus favoritos de una sola vez. El historial de check-ins esta en el menu lateral, seccion "Mis visitas".',
      },
      {
        id: 'colaborativas',
        icon: <PeopleOutlinedIcon color="primary" />,
        title: 'Listas colaborativas',
        description:
          'Podes invitar hasta 5 editores por email a cualquiera de tus listas. Los editores pueden agregar y quitar comercios. Las listas donde te invitaron aparecen en la seccion "Compartidas conmigo" con un badge que las identifica. Cada comercio muestra quien lo agrego. Para gestionar editores, entra a la lista y toca el icono de compartir.',
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
        description: `Tu perfil muestra un avatar personalizable (toca para elegir entre ${AVATAR_COUNT} opciones), tus estadisticas (lugares visitados, reseñas, seguidores, favoritos) y tus logros con barra de progreso. Toca "Ver todos" para ver la grilla completa de logros con la descripcion de como completar cada uno.`,
      },
      {
        id: 'logros',
        icon: <EmojiEventsOutlinedIcon color="primary" />,
        title: 'Logros',
        description:
          'Hay 8 logros disponibles: Explorador (check-ins), Social (seguidos), Critico (calificaciones), Viajero (localidades), Coleccionista (favoritos), Fotografo (fotos de menu), Embajador (recomendaciones) y En racha (dias consecutivos). Toca cualquier logro para ver que necesitas hacer para completarlo. Los iconos de perfil verificado (Local Guide, Visitante Verificado, Opinion Confiable) son un sistema separado de badges de actividad visible en el perfil de otros usuarios.',
      },
      {
        id: 'notificaciones',
        icon: <NotificationsOutlinedIcon color="primary" />,
        title: 'Notificaciones',
        description:
          'Toca la campana o anda a Perfil > Notificaciones. Badge con las no leidas. Recibis avisos de likes en comentarios, respuestas a tus comentarios, fotos aprobadas o rechazadas, cambios en rankings, respuestas a feedback, nuevos seguidores y recomendaciones. En Home, la seccion "Novedades" (ActivityDigestSection) agrupa tus no leidas por tipo. Podes elegir la frecuencia del digest en Configuracion > Notificaciones: tiempo real (default, polling cada 5 min), diaria o semanal. Toca una notificacion para ir al comercio o marca todas como leidas. Podes desactivar cada tipo en Configuracion.',
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
          'Por defecto tu cuenta es temporal (anonima). Podes crear una cuenta con email y contraseña para sincronizar tus datos entre dispositivos. Para iniciar sesion en otro dispositivo, usa tu email y contraseña. Despues de registrarte, verifica tu email. Podes cambiar tu contraseña desde Configuracion. Si olvidaste tu contraseña, toca "Olvide mi contraseña" en el dialogo de inicio de sesion.',
      },
      {
        id: 'onboarding',
        icon: <CelebrationOutlinedIcon color="primary" />,
        title: 'Onboarding de cuenta',
        description:
          'Como usuario temporal (anonimo) vas a ver un banner de onboarding sugiriendo crear cuenta para no perder tus datos, una pantalla de beneficios pre-registro y un recordatorio despues de completar unas cuantas interacciones (por ejemplo, 5 calificaciones). Si ya creaste cuenta y no verificaste tu email, vas a ver un nudge en el menu para reenviar el email de verificacion.',
      },
      {
        id: 'configuracion',
        icon: <SettingsOutlinedIcon color="primary" />,
        title: 'Configuracion',
        description:
          'Accede desde Perfil > Configuracion. Incluye Cuenta (crear cuenta, verificar email, cambiar contraseña, cerrar sesion, eliminar cuenta), Ubicacion (localidad por defecto cuando no hay GPS, usada en mapa, sort por cercania, Sorprendeme y sugerencias), Apariencia (toggle de modo oscuro), Privacidad (perfil publico/privado, datos de uso/analytics) y Notificaciones (master, por tipo, y frecuencia del digest: tiempo real, diaria o semanal). La eliminacion de cuenta borra permanentemente todos tus datos y no se puede deshacer.',
      },
      {
        id: 'modooscuro',
        icon: <DarkModeOutlinedIcon color="primary" />,
        title: 'Modo oscuro',
        description:
          'Activa o desactiva el modo oscuro desde Configuracion > Apariencia. Tu preferencia se guarda automaticamente. Si no lo configuras manualmente, la app respeta la configuracion de tu dispositivo (modo claro u oscuro del sistema). El modo oscuro se aplica a toda la interfaz incluyendo mapa, listas y pantallas de carga.',
      },
      {
        id: 'feedback',
        icon: <FeedbackOutlinedIcon color="primary" />,
        title: 'Feedback',
        description:
          'Envia sugerencias, reporta bugs o deja tu opinion desde Perfil > Ayuda y soporte > Feedback. Podes adjuntar una imagen o PDF al envio. Si tu reporte es sobre un comercio, podes vincularlo. En "Mis envios" podes seguir el estado (pendiente, visto, respondido, resuelto) y ver las respuestas del equipo.',
      },
    ],
  },
];
