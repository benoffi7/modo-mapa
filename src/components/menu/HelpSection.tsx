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
      'Tocá un pin para ver el detalle. Podés calificar (global + multi-criterio), comentar (con respuestas y likes), marcar favorito, compartir con deep link, ver o subir foto de menú, abrir en Google Maps, votar tags y nivel de gasto, y crear tags personalizados.',
  },
  {
    id: 'menu',
    icon: <MenuOutlinedIcon color="primary" />,
    title: 'Menú lateral',
    description:
      'Accedé a favoritos, recientes, sugeridos, comentarios, calificaciones, feedback, mis envíos, rankings, estadísticas, agregar comercio y configuración. Cambiá el modo oscuro desde el footer del menú.',
  },
  {
    id: 'notificaciones',
    icon: <NotificationsOutlinedIcon color="primary" />,
    title: 'Notificaciones',
    description:
      'Campana en la barra de búsqueda. Recibís avisos de likes en comentarios, fotos aprobadas o rechazadas, cambios en rankings y respuestas a tu feedback. Tocá para ir al comercio o marcá como leídas.',
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
      'Perfil público o privado y preferencias de notificaciones (likes, fotos, rankings, feedback). El toggle de modo oscuro está en el footer del menú lateral.',
  },
  {
    id: 'feedback',
    icon: <FeedbackOutlinedIcon color="primary" />,
    title: 'Feedback',
    description:
      'Enviá sugerencias, reportá bugs o dejá tu opinión desde el menú lateral. En "Mis envíos" podés ver el estado de cada envío y las respuestas del equipo.',
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
