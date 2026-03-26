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

interface HelpItem {
  id: string;
  icon: ReactElement;
  title: string;
  description: string;
}

const HELP_ITEMS: HelpItem[] = [
  {
    id: 'inicio',
    icon: <HomeOutlinedIcon color="primary" />,
    title: 'Inicio',
    description:
      'Tu pantalla principal con saludo personalizado. Acciones rapidas para buscar por categoria o probar "Sorprendeme". Seccion "Especiales" con contenido destacado. Busquedas recientes para volver a lo que visitaste. Seccion "Para ti" con sugerencias personalizadas basadas en tus gustos.',
  },
  {
    id: 'buscar',
    icon: <MapOutlinedIcon color="primary" />,
    title: 'Buscar',
    description:
      'Busca comercios por nombre, direccion o categoria. Filtra por tags y nivel de gasto ($/$$/$$). Toca el boton de ubicacion para centrar el mapa en tu posicion. Usa el toggle mapa/lista para alternar entre vista de mapa y lista de resultados ordenados por distancia. Las acciones rapidas del Inicio te llevan directamente aca con el filtro aplicado.',
  },
  {
    id: 'comercio',
    icon: <StorefrontOutlinedIcon color="primary" />,
    title: 'Comercio',
    description:
      'Toca un pin en el mapa o un comercio en cualquier lista para ver el detalle. Podes calificar (global + multi-criterio), comentar o hacer preguntas (con respuestas, likes y mejor respuesta destacada, maximo 20 por dia), marcar favorito, compartir con deep link, ver o subir foto de menu, abrir en Google Maps, votar tags y nivel de gasto, y crear tags personalizados. Si no tenes conexion, tus acciones se guardan y se sincronizan automaticamente al reconectar.',
  },
  {
    id: 'social',
    icon: <PeopleOutlinedIcon color="primary" />,
    title: 'Social',
    description:
      'En la pestana Social encontras cuatro secciones: Actividad (feed de lo que hacen los usuarios que seguis), Seguidos (busca y segui a otros usuarios), Recomendaciones (comercios que te recomendaron, con badge de no leidas) y Rankings (semanal, mensual, anual e historico con tiers, badges y grafico de evolucion).',
  },
  {
    id: 'listas',
    icon: <BookmarkBorderIcon color="primary" />,
    title: 'Listas',
    description:
      'En la pestana Listas tenes cuatro secciones: Favoritos (con filtros y distancia), Listas (crea listas tematicas con icono personalizado, hacelas publicas o privadas, e invita editores), Recientes (historial unificado de visitas y check-ins) y Colaborativas (listas donde te invitaron como editor).',
  },
  {
    id: 'perfil',
    icon: <PersonOutlinedIcon color="primary" />,
    title: 'Perfil',
    description:
      'Tu perfil muestra un avatar personalizable (toca para elegir entre 20 opciones), tus estadisticas (lugares visitados, resenas, seguidores, favoritos), y tus logros con barra de progreso. Toca "Ver todos" para ver la grilla completa de logros con descripcion de como completar cada uno.',
  },
  {
    id: 'notificaciones',
    icon: <NotificationsOutlinedIcon color="primary" />,
    title: 'Notificaciones',
    description:
      'Las notificaciones se encuentran en Perfil > Notificaciones, con un badge que muestra las no leidas. Recibis avisos de likes en comentarios, respuestas, fotos aprobadas o rechazadas, cambios en rankings, respuestas a feedback, nuevos seguidores y recomendaciones. Toca para ir al comercio o marca como leidas. Podes desactivar cada tipo en Configuracion.',
  },
  {
    id: 'configuracion',
    icon: <SettingsOutlinedIcon color="primary" />,
    title: 'Configuracion',
    description:
      'Accede desde Perfil > Configuracion. Incluye cuenta (crear cuenta, verificar email, cambiar contrasena, cerrar sesion), perfil publico/privado, datos de uso (analytics), localidad, preferencias de notificaciones y modo oscuro.',
  },
  {
    id: 'cuenta',
    icon: <AccountCircleOutlinedIcon color="primary" />,
    title: 'Cuenta',
    description:
      'Por defecto tu cuenta es temporal (anonima). Podes crear una cuenta con email y contrasena para sincronizar tus datos entre dispositivos. Para iniciar sesion en otro dispositivo, usa tu email y contrasena. Despues de registrarte, verifica tu email. Podes cambiar tu contrasena desde Configuracion. Si olvidaste tu contrasena, toca "Olvide mi contrasena" en el dialogo de inicio de sesion.',
  },
  {
    id: 'recomendaciones',
    icon: <SendOutlinedIcon color="primary" />,
    title: 'Recomendaciones',
    description:
      'Recomenda un comercio a otro usuario desde el detalle del comercio. Podes agregar un mensaje opcional (hasta 200 caracteres). Maximo 20 recomendaciones por dia. Las recomendaciones que recibis aparecen en Social > Recomendaciones con badge de no leidas. Toca una para ir al comercio.',
  },
  {
    id: 'logros',
    icon: <EmojiEventsOutlinedIcon color="primary" />,
    title: 'Logros',
    description:
      'En tu Perfil podes ver tus logros con barra de progreso. Hay 8 logros disponibles: Explorador (check-ins), Social (seguidos), Critico (calificaciones), Viajero (localidades), Coleccionista (favoritos), Fotografo (fotos de menu), Embajador (recomendaciones) y En racha (dias consecutivos). Toca cualquier logro para ver que necesitas hacer para completarlo.',
  },
  {
    id: 'feedback',
    icon: <FeedbackOutlinedIcon color="primary" />,
    title: 'Feedback',
    description:
      'Envia sugerencias, reporta bugs o deja tu opinion desde Perfil > Ayuda y soporte. Podes adjuntar una imagen al envio. En "Mis envios" podes seguir el estado (pendiente, visto, respondido, resuelto) y ver las respuestas del equipo.',
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
