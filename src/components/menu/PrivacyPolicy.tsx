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
          subir fotos de menú, votar niveles de gasto y registrar visitas (check-ins) a comercios.
        </P>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Datos que recopilamos">
        <P>Al usar la app, se recopilan los siguientes datos:</P>
        <Box component="ul" sx={{ pl: 1, mt: 0 }}>
          <Li>
            <strong>Identificación anónima:</strong> se genera un identificador único (UID)
            automáticamente al ingresar. Opcionalmente, podés crear una cuenta con email y
            contraseña para mantener tu sesión entre dispositivos.
          </Li>
          <Li>
            <strong>Email y contraseña (opcional):</strong> si elegís crear una cuenta, tu
            dirección de email se almacena en Firebase Authentication. La contraseña es
            hasheada por Firebase y nunca es accesible desde la app. También se registra
            el estado de verificación del email.
          </Li>
          <Li>
            <strong>Nombre de usuario:</strong> un alias que elegís al registrarte (puede
            ser cualquier nombre, no tiene que ser real).
          </Li>
          <Li>
            <strong>Contenido generado:</strong> listas de comercios (nombre, descripción, contenido),
            preguntas sobre comercios, respuestas a preguntas,
            comentarios (incluyendo respuestas en hilos),
            calificaciones (globales y por criterio: comida, atención, precio, ambiente, rapidez),
            favoritos, etiquetas, likes en comentarios, fotos de menú, feedback (incluyendo
            imágenes adjuntas opcionales) y votos de nivel de gasto.
          </Li>
          <Li>
            <strong>Registro de visitas (check-ins) (opcional):</strong> cuando registrás una
            visita a un comercio, se guardan el nombre del comercio y la fecha del check-in.
            Si tenés GPS activado, se registra tu ubicación (latitud y longitud) en el momento
            del check-in. Podés eliminar cada check-in individualmente. El historial de visitas
            es privado y solo vos podés verlo.
          </Li>
          <Li>
            <strong>Listas colaborativas:</strong> si invitás editores a tus listas, se
            registra la relación de edición (UIDs de los editores). Para invitar un editor,
            se busca su cuenta por email en Firebase Authentication. Los editores pueden
            agregar y quitar comercios de la lista, y se registra quién agregó cada
            comercio. Las listas pueden ser públicas (visibles para cualquier usuario
            autenticado) o privadas.
          </Li>
          <Li>
            <strong>Datos de ranking y logros:</strong> tu actividad en la app se utiliza para
            calcular un puntaje de contribución que se muestra en rankings periódicos (semanales,
            mensuales, anuales e histórico). El ranking incluye tu nombre de usuario, puntaje,
            desglose de actividad y racha de días consecutivos. Estos datos son visibles para
            todos los usuarios autenticados. Además, se calculan logros (badges) basados en tu
            actividad y posición en el ranking.
          </Li>
          <Li>
            <strong>Localidad (opcional):</strong> podés establecer tu zona (ciudad o barrio)
            desde Configuración. Se guardan el nombre de la localidad y sus coordenadas
            (latitud y longitud). Se usa como ubicación por defecto cuando no tenés GPS
            activado, para centrar el mapa y filtrar comercios cercanos.
          </Li>
          <Li>
            <strong>Datos de comportamiento (local):</strong> para las sugerencias
            personalizadas, la app analiza tus favoritos, calificaciones y etiquetas
            en el dispositivo para recomendarte comercios. Este análisis es 100% local
            y no se envía a ningún servidor.
          </Li>
          <Li>
            <strong>Datos de uso (opcional):</strong> si activás &quot;Enviar datos de uso&quot;
            en Configuración, Firebase Analytics (GA4) recopila eventos anónimos de
            navegación y uso (ej: vistas de comercios, búsquedas). También se registran
            eventos relacionados con la autenticación (account_created, email_sign_in,
            sign_out, password_changed), eventos de preguntas y respuestas (question_created,
            question_answered, question_viewed), eventos de check-ins (checkin_created,
            checkin_deleted), eventos de sincronizacion offline (offline_action_queued,
            offline_sync_completed, offline_sync_failed, offline_action_discarded)
            y la propiedad de usuario auth_type. Estos eventos
            se asocian al UID, no al email, y no identifican a personas individuales.
          </Li>
          <Li>
            <strong>Métricas de rendimiento (opcional):</strong> si activás &quot;Enviar
            datos de uso&quot; en Configuración, se recopilan métricas de rendimiento una
            vez por sesión. Esto incluye indicadores Web Vitals del navegador (LCP, INP,
            CLS, TTFB), tiempos de carga de datos, tipo de dispositivo (móvil/escritorio),
            tipo de conexión y versión de la app. Estos datos se almacenan en Cloud
            Firestore asociados a tu UID y se usan exclusivamente para monitorear y
            mejorar el rendimiento de la aplicación. Solo los administradores pueden
            acceder a estos datos.
          </Li>
        </Box>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Almacenamiento">
        <Box component="ul" sx={{ pl: 1, mt: 0 }}>
          <Li>
            <strong>Cloud Firestore:</strong> almacena datos estructurados (listas de comercios,
            comentarios, calificaciones, favoritos, rankings de usuarios, logros, métricas
            de rendimiento, etc.) en servidores de Google Cloud.
          </Li>
          <Li>
            <strong>Firebase Storage:</strong> almacena fotos de menú e imágenes adjuntas de
            feedback subidas por los usuarios.
          </Li>
          <Li>
            <strong>localStorage:</strong> almacena preferencias locales en tu navegador
            (tema claro/oscuro, visitas recientes, preferencia de analytics, y opcionalmente
            tu email si activás &quot;Recordar mi email&quot;). Estos datos no se envían a
            ningún servidor y podés borrarlos en cualquier momento desde la configuración
            del navegador o desactivando la opción.
          </Li>
          <Li>
            <strong>IndexedDB (local):</strong> cuando no tenés conexión a internet,
            la app almacena temporalmente tus acciones pendientes (calificaciones,
            comentarios, favoritos, votos de precio y etiquetas) en una base de datos
            local del navegador (IndexedDB). Estos datos incluyen tu UID, el
            identificador del comercio y el contenido de la acción. Se sincronizan
            automáticamente cuando volvés a estar online y se eliminan después de
            7 días. Podés borrarlos desde la configuración del navegador.
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
            contenido. Los editores invitados a una lista colaborativa pueden agregar y
            quitar comercios de esa lista. Los datos de otros usuarios son de solo lectura.
          </Li>
          <Li>
            <strong>Límites de uso:</strong> se aplican límites para prevenir abuso
            (ej: máximo de comentarios por día, máximo de 10 check-ins por día).
          </Li>
          <Li>
            <strong>Moderación automática:</strong> el contenido se revisa automáticamente
            para detectar lenguaje inapropiado.
          </Li>
          <Li>
            <strong>Contraseñas seguras:</strong> las contraseñas de las cuentas con email
            son hasheadas por Firebase Authentication y nunca se almacenan en texto plano.
          </Li>
        </Box>
      </Section>

      <Divider sx={{ mb: 2.5 }} />

      <Section title="Compartición con terceros">
        <P>
          El contenido de tu feedback (mensaje, categoría e imagen adjunta si la hay)
          puede ser compartido con GitHub para la gestión interna de mejoras y
          corrección de errores. No se comparte tu identidad ni tu UID; solo el
          contenido del mensaje. Ningún otro dato personal se comparte con terceros.
        </P>
        <P>
          Podés compartir voluntariamente tu posición y puntaje en el ranking, así como
          listas de comercios públicas, usando la función de compartir. Esto utiliza la
          Web Share API de tu navegador o copia el link al portapapeles, y se envía a la
          aplicación que elijas. Esta acción es completamente voluntaria.
        </P>
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
            calificaciones, favoritos, likes, etiquetas, check-ins y listas de comercios desde la app.
            Los datos de ranking son generados automáticamente a partir de tu actividad y se
            actualizan periódicamente.
          </Li>
          <Li>
            <strong>Controlar tu perfil:</strong> podés elegir si tu perfil es público
            o privado desde Configuración.
          </Li>
          <Li>
            <strong>Controlar tus listas:</strong> podés elegir si cada lista es pública o
            privada, invitar o remover editores, y eliminar la lista completa junto con
            su contenido.
          </Li>
          <Li>
            <strong>Controlar notificaciones:</strong> podés activar o desactivar las
            notificaciones (likes, fotos, rankings, feedback, respuestas a comentarios) desde Configuración.
          </Li>
          <Li>
            <strong>Cerrar sesión:</strong> podés cerrar tu sesión en cualquier momento.
            Al hacerlo, se genera una nueva cuenta anónima en el dispositivo.
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
