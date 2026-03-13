import { Box, Typography, Divider } from '@mui/material';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      {children}
    </Typography>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="li" variant="body2" color="text.secondary" sx={{ ml: 2, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

export default function PrivacyPolicy() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 2 }}>
        Última actualización: marzo 2026
      </Typography>

      <Section title="Información general">
        <P>
          Modo Mapa es una aplicación web interna para empleados que permite encontrar
          comercios gastronómicos cercanos en un mapa interactivo. Los usuarios pueden
          buscar, filtrar, calificar, comentar, marcar favoritos, etiquetar comercios,
          subir fotos de menú y votar niveles de gasto.
        </P>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Datos que recopilamos">
        <P>Al usar la app, se recopilan los siguientes datos:</P>
        <Box component="ul" sx={{ pl: 1, mt: 0 }}>
          <Li>
            <strong>Identificación anónima:</strong> se genera un identificador único (UID)
            automáticamente al ingresar. No se solicita nombre real ni email.
          </Li>
          <Li>
            <strong>Nombre de usuario:</strong> un alias que elegís al registrarte (puede
            ser cualquier nombre, no tiene que ser real).
          </Li>
          <Li>
            <strong>Contenido generado:</strong> comentarios, calificaciones, favoritos,
            etiquetas, fotos de menú, feedback y votos de nivel de gasto.
          </Li>
          <Li>
            <strong>Datos de uso (opcional):</strong> si activás &quot;Enviar datos de uso&quot;
            en Configuración, Firebase Analytics (GA4) recopila eventos anónimos de
            navegación y uso (ej: vistas de comercios, búsquedas). Estos datos no
            identifican a personas individuales.
          </Li>
        </Box>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Almacenamiento">
        <Box component="ul" sx={{ pl: 1, mt: 0 }}>
          <Li>
            <strong>Cloud Firestore:</strong> almacena datos estructurados (comentarios,
            calificaciones, favoritos, etc.) en servidores de Google Cloud.
          </Li>
          <Li>
            <strong>Firebase Storage:</strong> almacena fotos de menú subidas por los usuarios.
          </Li>
          <Li>
            <strong>localStorage:</strong> almacena preferencias locales en tu navegador
            (tema claro/oscuro, visitas recientes, preferencia de analytics). Estos datos
            no se envían a ningún servidor.
          </Li>
        </Box>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Seguridad">
        <P>Implementamos las siguientes medidas para proteger tus datos:</P>
        <Box component="ul" sx={{ pl: 1, mt: 0 }}>
          <Li>
            <strong>Firebase App Check:</strong> verifica que las solicitudes provienen
            de la app legítima.
          </Li>
          <Li>
            <strong>Reglas de acceso:</strong> cada usuario solo puede modificar su propio
            contenido. Los datos de otros usuarios son de solo lectura.
          </Li>
          <Li>
            <strong>Límites de uso:</strong> se aplican límites para prevenir abuso
            (ej: máximo de comentarios por día).
          </Li>
          <Li>
            <strong>Moderación automática:</strong> el contenido se revisa automáticamente
            para detectar lenguaje inapropiado.
          </Li>
        </Box>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Tus derechos">
        <P>Como usuario, podés:</P>
        <Box component="ul" sx={{ pl: 1, mt: 0 }}>
          <Li>
            <strong>Desactivar Analytics:</strong> desde Configuración, podés activar o
            desactivar el envío de datos de uso en cualquier momento.
          </Li>
          <Li>
            <strong>Eliminar tu contenido:</strong> podés borrar tus comentarios,
            calificaciones, favoritos y etiquetas desde la app.
          </Li>
          <Li>
            <strong>Controlar tu perfil:</strong> podés elegir si tu perfil es público
            o privado desde Configuración.
          </Li>
        </Box>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Contacto">
        <P>
          Si tenés consultas sobre tus datos personales o los datos de comercios,
          podés enviarnos un mensaje desde la sección <strong>Feedback</strong> del
          menú lateral usando las categorías &quot;Datos de usuario&quot; o
          &quot;Datos de comercio&quot;.
        </P>
      </Section>
    </Box>
  );
}
