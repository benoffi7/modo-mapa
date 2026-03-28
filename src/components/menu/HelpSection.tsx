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
          'Tu pantalla principal con saludo personalizado. Acciones rapidas para buscar por categoria o probar "Sorprendeme". Seccion "Especiales" con contenido destacado. Busquedas recientes para volver a lo que visitaste. Seccion "Para ti" con sugerencias personalizadas basadas en tus gustos.',
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
          'Busca comercios por nombre, direccion o categoria. Filtra por tags y nivel de gasto ($/$$/$$). Toca el boton de ubicacion para centrar el mapa en tu posicion. Usa el toggle mapa/lista para alternar entre vista de mapa y lista de resultados ordenados por distancia. Las acciones rapidas del Inicio te llevan directamente aca con el filtro aplicado.',
      },
      {
        id: 'comercio',
        icon: <StorefrontOutlinedIcon color="primary" />,
        title: 'Detalle de comercio',
        description:
          'Toca un pin o un comercio en cualquier lista para ver el detalle. El header queda fijo con nombre, botones de accion y tu calificacion. Dos pestanas organizan el contenido: Info (criterios de rating, tags, nivel de gasto, foto de menu) y Opiniones (comentarios y preguntas con respuestas, likes y mejor respuesta destacada, maximo 20 por dia). Podes calificar (global + multi-criterio), marcar favorito, compartir con deep link, hacer check-in, abrir en Google Maps y crear tags personalizados. Sin conexion, tus acciones se sincronizan automaticamente al reconectar.',
      },
      {
        id: 'checkin',
        icon: <PlaceOutlinedIcon color="primary" />,
        title: 'Check-in',
        description:
          'Registra tu visita a un comercio tocando "Hacer check-in" en el detalle. Hay un cooldown de 4 horas por comercio y un limite de 10 check-ins por dia. Si estas a mas de 500 metros, te avisa pero no te bloquea. Podes deshacer el check-in tocando el boton de nuevo. Tu historial de check-ins aparece en Listas > Recientes con fecha y hora. En tu perfil se cuentan las visitas totales y comercios unicos.',
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
          'En la pestana Social encontras cuatro secciones: Actividad (feed de lo que hacen los usuarios que seguis), Seguidos (busca y segui a otros usuarios con perfil publico, maximo 200), Recomendaciones (comercios que te recomendaron, con badge de no leidas) y Rankings (semanal, mensual, anual e historico con tiers, badges y grafico de evolucion).',
      },
      {
        id: 'recomendaciones',
        icon: <SendOutlinedIcon color="primary" />,
        title: 'Recomendaciones',
        description:
          'Recomenda un comercio a otro usuario desde el detalle del comercio. Podes agregar un mensaje opcional (hasta 200 caracteres). Maximo 20 recomendaciones por dia. Las recomendaciones que recibis aparecen en Social > Recomendaciones con badge de no leidas. Toca una para ir al comercio.',
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
          'En la pestana Listas tenes cuatro secciones: Favoritos (con filtros por nombre, categoria y orden, y distancia al comercio), Listas (crea listas tematicas con icono personalizado, hacelas publicas o privadas), Recientes (historial unificado de visitas y check-ins) y Colaborativas (listas donde te invitaron como editor). Maximo 10 listas y 50 comercios por lista.',
      },
      {
        id: 'colaborativas',
        icon: <PeopleOutlinedIcon color="primary" />,
        title: 'Listas colaborativas',
        description:
          'Podes invitar hasta 5 editores por email a cualquiera de tus listas. Los editores pueden agregar y quitar comercios. Las listas donde te invitaron aparecen en la seccion "Colaborativas" con un badge que las identifica. Cada comercio muestra quien lo agrego. Para gestionar editores, entra a la lista y toca el icono de compartir.',
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
          'Tu perfil muestra un avatar personalizable (toca para elegir entre 20 opciones), tus estadisticas (lugares visitados, resenas, seguidores, favoritos), y tus logros con barra de progreso. Toca "Ver todos" para ver la grilla completa de logros con descripcion de como completar cada uno.',
      },
      {
        id: 'logros',
        icon: <EmojiEventsOutlinedIcon color="primary" />,
        title: 'Logros',
        description:
          'Hay 8 logros disponibles: Explorador (check-ins), Social (seguidos), Critico (calificaciones), Viajero (localidades), Coleccionista (favoritos), Fotografo (fotos de menu), Embajador (recomendaciones) y En racha (dias consecutivos). Toca cualquier logro para ver que necesitas hacer para completarlo.',
      },
      {
        id: 'notificaciones',
        icon: <NotificationsOutlinedIcon color="primary" />,
        title: 'Notificaciones',
        description:
          'Toca la campana o anda a Perfil > Notificaciones. Badge con las no leidas. Recibis avisos de likes en comentarios, respuestas, fotos aprobadas o rechazadas, cambios en rankings, respuestas a feedback, nuevos seguidores y recomendaciones. Toca para ir al comercio o marca como leidas. Podes desactivar cada tipo en Configuracion.',
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
          'Por defecto tu cuenta es temporal (anonima). Podes crear una cuenta con email y contrasena para sincronizar tus datos entre dispositivos. Para iniciar sesion en otro dispositivo, usa tu email y contrasena. Despues de registrarte, verifica tu email. Podes cambiar tu contrasena desde Configuracion. Si olvidaste tu contrasena, toca "Olvide mi contrasena" en el dialogo de inicio de sesion.',
      },
      {
        id: 'configuracion',
        icon: <SettingsOutlinedIcon color="primary" />,
        title: 'Configuracion',
        description:
          'Accede desde Perfil > Configuracion. Incluye cuenta (crear cuenta, verificar email, cambiar contrasena, cerrar sesion, eliminar cuenta), perfil publico/privado, datos de uso (analytics), localidad (ubicacion por defecto cuando no hay GPS) y preferencias de notificaciones por tipo. La eliminacion de cuenta borra permanentemente todos tus datos y no se puede deshacer.',
      },
      {
        id: 'modooscuro',
        icon: <DarkModeOutlinedIcon color="primary" />,
        title: 'Modo oscuro',
        description:
          'Activa o desactiva el modo oscuro desde el switch en el menu lateral. Tu preferencia se guarda automaticamente. Si no lo configuras manualmente, la app respeta la configuracion de tu dispositivo (modo claro u oscuro del sistema). El modo oscuro se aplica a toda la interfaz incluyendo el mapa, listas y pantallas de carga.',
      },
      {
        id: 'feedback',
        icon: <FeedbackOutlinedIcon color="primary" />,
        title: 'Feedback',
        description:
          'Envia sugerencias, reporta bugs o deja tu opinion desde Perfil > Ayuda y soporte. Podes adjuntar una imagen o PDF al envio. Si tu reporte es sobre un comercio, podes vincularlo. En "Mis envios" podes seguir el estado (pendiente, visto, respondido, resuelto) y ver las respuestas del equipo.',
      },
    ],
  },
];

export default function HelpSection() {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (_: unknown, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ pb: 2 }}>
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
