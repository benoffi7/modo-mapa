import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { NAV_CHIP_SX } from '../../constants/ui';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

interface HelpItem {
  id: string;
  icon: ReactElement;
  title: string;
  description: string;
}

interface HelpGroup {
  label: string;
  items: HelpItem[];
}

const HELP_GROUPS: HelpGroup[] = [
  {
    label: 'Inicio',
    items: [
      {
        id: 'inicio',
        icon: <HomeOutlinedIcon color="primary" />,
        title: 'Pantalla principal',
        description:
          'Tu pantalla principal con saludo personalizado. Acciones rápidas para buscar por categoría o probar "Sorpréndeme". Sección "Especiales" con tarjetas creadas por el equipo (promos del día, listas destacadas de comercios, logros). Sección "Novedades" con el resumen de notificaciones no leídas agrupadas por tipo. Sección "Para ti" con sugerencias personalizadas basadas en tus gustos. Sección "Tus intereses" con comercios filtrados por tags que seguís.',
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
          'Buscá comercios por nombre, dirección o categoría. Filtrá por tags y nivel de gasto ($/$$/$$). Tocá el botón de ubicación para centrar el mapa en tu posición. Usá el toggle mapa/lista para alternar entre vista de mapa y lista de resultados ordenados por distancia. Las acciones rápidas del Inicio te llevan directamente acá con el filtro aplicado.',
      },
      {
        id: 'comercio',
        icon: <StorefrontOutlinedIcon color="primary" />,
        title: 'Detalle de comercio',
        description:
          'Tocá un pin o un comercio en cualquier lista para ver el detalle. El header queda fijo con nombre, botones de acción y tu calificación. Dos pestañas organizan el contenido: Info (criterios de rating, tags, nivel de gasto, foto de menú) y Opiniones (comentarios y preguntas con respuestas, likes y mejor respuesta destacada, máximo 20 por día). Podés calificar (global + multi-criterio), marcar favorito, compartir con deep link, hacer check-in, abrir en Google Maps y crear tags personalizados. Sin conexión, tus acciones se sincronizan automáticamente al reconectar.',
      },
      {
        id: 'checkin',
        icon: <PlaceOutlinedIcon color="primary" />,
        title: 'Check-in',
        description:
          'Registrá tu visita a un comercio tocando "Hacer check-in" en el detalle. Hay un cooldown de 4 horas por comercio y un límite de 10 check-ins por día. Si estás a más de 500 metros, te avisa pero no te bloquea. Podés deshacer el check-in tocando el botón de nuevo. Tu historial de check-ins aparece en el menú lateral, sección "Mis visitas", con fecha y hora. En tu perfil se cuentan las visitas totales y comercios únicos.',
      },
    ],
  },
  {
    label: 'Social',
    items: [
      {
        id: 'social',
        icon: <PeopleOutlinedIcon color="primary" />,
        title: 'Actividad y seguidos',
        description:
          'En la pestaña Social encontrás cuatro secciones: Actividad (feed de lo que hacen los usuarios que seguís), Seguidos (buscá y seguí a otros usuarios con perfil público, máximo 200), Recomendaciones (comercios que te recomendaron, con badge de no leídas) y Rankings (semanal, mensual, anual e histórico con tiers, badges y gráfico de evolución).',
      },
      {
        id: 'recomendaciones',
        icon: <SendOutlinedIcon color="primary" />,
        title: 'Recomendaciones',
        description:
          'Recomendá un comercio a otro usuario desde el detalle del comercio. Podés agregar un mensaje opcional (hasta 200 caracteres). Máximo 20 recomendaciones por día. Las recomendaciones que recibís aparecen en Social > Recomendaciones con badge de no leídas. Tocá una para ir al comercio.',
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
          'En la pestaña Listas tenés cuatro secciones: Favoritos (con filtros por nombre, categoría y orden, y distancia al comercio), Listas (creá listas temáticas con ícono personalizado, hacelas públicas o privadas), Recientes (historial de comercios visitados o vistos recientemente, guardado localmente en el dispositivo, separado de los check-ins) y Colaborativas (listas donde te invitaron como editor). Máximo 10 listas y 50 comercios por lista. El historial de check-ins lo encontrás en el menú lateral, sección "Mis visitas".',
      },
      {
        id: 'colaborativas',
        icon: <PeopleOutlinedIcon color="primary" />,
        title: 'Listas colaborativas',
        description:
          'Podés invitar hasta 5 editores por email a cualquiera de tus listas. Los editores pueden agregar y quitar comercios. Las listas donde te invitaron aparecen en la sección "Colaborativas" con un badge que las identifica. Cada comercio muestra quién lo agregó. Para gestionar editores, entrá a la lista y tocá el ícono de compartir.',
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
        description:
          'Tu perfil muestra un avatar personalizable (tocá para elegir entre 20 opciones), tus estadísticas (lugares visitados, reseñas, seguidores, favoritos), y tus logros con barra de progreso. Tocá "Ver todos" para ver la grilla completa de logros con descripción de cómo completar cada uno.',
      },
      {
        id: 'logros',
        icon: <EmojiEventsOutlinedIcon color="primary" />,
        title: 'Logros',
        description:
          'Hay 8 logros disponibles: Explorador (check-ins), Social (seguidos), Crítico (calificaciones), Viajero (localidades), Coleccionista (favoritos), Fotógrafo (fotos de menú), Embajador (recomendaciones) y En racha (días consecutivos). Tocá cualquier logro para ver qué necesitás hacer para completarlo. Los íconos de perfil verificado (Local Guide, Visitante Verificado, Opinión Confiable) son un sistema separado de badges de actividad visible en el perfil de otros usuarios.',
      },
      {
        id: 'notificaciones',
        icon: <NotificationsOutlinedIcon color="primary" />,
        title: 'Notificaciones',
        description:
          'Tocá la campana o andá a Perfil > Notificaciones. Badge con las no leídas. Recibís avisos de likes en comentarios, respuestas, fotos aprobadas o rechazadas, cambios en rankings, respuestas a feedback, nuevos seguidores y recomendaciones. Tocá para ir al comercio o marcá como leídas. Podés desactivar cada tipo en Configuración.',
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
        id: 'configuracion',
        icon: <SettingsOutlinedIcon color="primary" />,
        title: 'Configuración',
        description:
          'Accedé desde Perfil > Configuración. Incluye cuenta (crear cuenta, verificar email, cambiar contraseña, cerrar sesión, eliminar cuenta), perfil público/privado, datos de uso (analytics), localidad (ubicación por defecto cuando no hay GPS), preferencias de notificaciones por tipo y frecuencia del digest (tiempo real, diaria o semanal). El modo oscuro se activa desde el switch en el menú lateral. La eliminación de cuenta borra permanentemente todos tus datos y no se puede deshacer.',
      },
      {
        id: 'modooscuro',
        icon: <DarkModeOutlinedIcon color="primary" />,
        title: 'Modo oscuro',
        description:
          'Activá o desactivá el modo oscuro desde el switch en el menú lateral. Tu preferencia se guarda automáticamente. Si no lo configurás manualmente, la app respeta la configuración de tu dispositivo (modo claro u oscuro del sistema). El modo oscuro se aplica a toda la interfaz incluyendo el mapa, listas y pantallas de carga.',
      },
      {
        id: 'feedback',
        icon: <FeedbackOutlinedIcon color="primary" />,
        title: 'Feedback',
        description:
          'Enviá sugerencias, reportá bugs o dejá tu opinión desde Perfil > Ayuda y soporte. Podés adjuntar una imagen o PDF al envío. Si tu reporte es sobre un comercio, podés vincularlo. En "Mis envíos" podés seguir el estado (pendiente, visto, respondido, resuelto) y ver las respuestas del equipo.',
      },
    ],
  },
];

declare const __APP_VERSION__: string;

export default function HelpSection() {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_: unknown, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ pb: 2 }}>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', pt: 1 }}>
        Modo Mapa v{__APP_VERSION__}
      </Typography>
      {HELP_GROUPS.map((group) => (
        <Box key={group.label}>
          <Chip
            label={group.label}
            size="small"
            variant="outlined"
            sx={{
              ...NAV_CHIP_SX,
              mt: 2.5,
              mb: 1,
              ml: 2,
              fontWeight: 600,
            }}
          />
          {group.items.map((item) => (
            <Accordion
              key={item.id}
              expanded={expanded === item.id}
              onChange={handleChange(item.id)}
              disableGutters
              elevation={0}
              sx={{ '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {item.icon}
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ))}
    </Box>
  );
}
