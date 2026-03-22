import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';

interface HelpItem {
  id: string;
  icon: ReactElement;
  title: string;
  description: string;
}

const HELP_ITEMS: HelpItem[] = [
  {
    id: 'mapa',
    icon: <MapOutlinedIcon color="primary" />,
    title: 'Mapa',
    description:
      'Buscá comercios por nombre, dirección o categoría. Filtrá por tags y nivel de gasto ($/$$/$$). Tocá el botón de ubicación para centrar el mapa en tu posición.',
  },
  {
    id: 'comercio',
    icon: <StorefrontOutlinedIcon color="primary" />,
    title: 'Comercio',
    description:
      'Tocá un pin para ver el detalle. Podés calificar (global + multi-criterio), comentar o hacer preguntas (con respuestas, likes y mejor respuesta destacada, máximo 20 por día), marcar favorito, compartir con deep link, ver o subir foto de menú, abrir en Google Maps, votar tags y nivel de gasto, y crear tags personalizados. Las acciones muestran confirmación o error automáticamente.',
  },
  {
    id: 'menu',
    icon: <MenuOutlinedIcon color="primary" />,
    title: 'Menú lateral',
    description:
      'Accedé a favoritos (con distancia al comercio), "Mis Listas" (creá listas temáticas y compartilas con un link), recientes, sugeridos para vos (con distancia y pestaña Tendencia con los comercios más populares de la semana), "Sorpréndeme" (te sugiere un comercio al azar que no visitaste, priorizando los cercanos), comentarios, calificaciones, feedback (con pestaña Mis envíos), rankings (semanal, mensual, anual e histórico con tendencia, tiers, badges, gráfico de evolución y perfil público al tocar un usuario), estadísticas, agregar comercio, configuración y ayuda. En Comentarios podés buscar por texto o nombre de comercio, ordenar (recientes, antiguos, más likes), filtrar por comercio, editar directamente desde el menú, ver un resumen con estadísticas, y en mobile deslizar para editar o eliminar. Las preguntas se identifican con un badge "Pregunta". Tirá hacia abajo en cualquier lista para refrescar los datos. Si es tu primera vez, vas a ver un checklist de "Primeros pasos" para orientarte. Cambiá el modo oscuro desde el footer del menú.',
  },
  {
    id: 'notificaciones',
    icon: <NotificationsOutlinedIcon color="primary" />,
    title: 'Notificaciones',
    description:
      'Campana en la barra de búsqueda. Recibís avisos de likes en comentarios, respuestas a tus comentarios, fotos aprobadas o rechazadas, cambios en rankings y respuestas a tu feedback. Podés desactivar cada tipo en Configuración. Tocá para ir al comercio o marcá como leídas.',
  },
  {
    id: 'perfil',
    icon: <PersonOutlinedIcon color="primary" />,
    title: 'Perfil',
    description:
      'Tocá el nombre de cualquier usuario para ver su perfil público con actividad, medallas top-3 y estadísticas. Podés hacer tu perfil público o privado desde Configuración.',
  },
  {
    id: 'configuracion',
    icon: <SettingsOutlinedIcon color="primary" />,
    title: 'Configuración',
    description:
      'La primera sección es Cuenta: si sos anónimo, podés crear una cuenta o iniciar sesión; si ya tenés cuenta con email, podés ver el estado de verificación, cambiar contraseña o cerrar sesión. Debajo, perfil público o privado, datos de uso (analytics) y preferencias de notificaciones (likes, fotos, rankings, feedback). El toggle de modo oscuro está en el footer del menú lateral.',
  },
  {
    id: 'cuenta',
    icon: <AccountCircleOutlinedIcon color="primary" />,
    title: 'Cuenta',
    description:
      'Por defecto tu cuenta es temporal (anónima). Podés crear una cuenta con email y contraseña para sincronizar tus datos entre dispositivos desde el menú lateral o Configuración. Para iniciar sesión en otro dispositivo, usá tu email y contraseña. Después de registrarte, verificá tu email: vas a ver un badge en el menú y podés reenviar el correo desde Configuración. Podés cambiar tu contraseña desde Configuración. Si olvidaste tu contraseña, tocá "Olvidé mi contraseña" en el diálogo de inicio de sesión. Al cerrar sesión se crea una nueva cuenta anónima; necesitás tu email y contraseña para volver a ingresar.',
  },
  {
    id: 'feedback',
    icon: <FeedbackOutlinedIcon color="primary" />,
    title: 'Feedback',
    description:
      'Enviá sugerencias, reportá bugs o dejá tu opinión desde el menú lateral. Podés adjuntar una imagen al envío. En "Mis envíos" podés seguir el estado (pendiente, visto, respondido, resuelto), ver las respuestas del equipo y un indicador verde cuando hay una respuesta nueva.',
  },
];

export default function HelpSection() {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_: unknown, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ pb: 2 }}>
      {HELP_ITEMS.map((item) => (
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
  );
}
