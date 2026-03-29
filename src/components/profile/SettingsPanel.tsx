import {
  Box,
  Typography,
  Switch,
  Divider,
  Skeleton,
} from '@mui/material';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useColorMode } from '../../hooks/useColorMode';
import LocalityPicker from './LocalityPicker';
import AccountSection from './AccountSection';

interface SettingRowProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  indented?: boolean;
  onChange: (value: boolean) => void;
}

function SettingRow({ label, description, checked, disabled, indented, onChange }: SettingRowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1,
        pl: indented ? 3 : 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Box sx={{ flex: 1, mr: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: indented ? 400 : 500 }}>
          {label}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>
      <Switch
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={(_, val) => onChange(val)}
      />
    </Box>
  );
}

export default function SettingsPanel() {
  const { settings, loading, updateSetting, updateLocality, clearLocality } = useUserSettings();
  const { mode, toggleColorMode } = useColorMode();

  if (loading) {
    return (
      <Box sx={{ px: 2, py: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={48} sx={{ my: 0.25 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, py: 1 }}>
      {/* Cuenta */}
      <AccountSection />

      <Divider sx={{ my: 1.5 }} />

      {/* Ubicación */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Ubicación
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Tu zona por defecto cuando no tenés GPS activado
      </Typography>
      <LocalityPicker
        currentLocality={settings.locality}
        onSelect={updateLocality}
        onClear={clearLocality}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Apariencia */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Apariencia
      </Typography>
      <SettingRow
        label="Modo oscuro"
        description="Cambia el tema visual de la app"
        checked={mode === 'dark'}
        onChange={() => toggleColorMode()}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Privacy */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Privacidad
      </Typography>
      <SettingRow
        label="Perfil público"
        description="Otros usuarios pueden ver tu actividad al tocar tu nombre"
        checked={settings.profilePublic}
        onChange={(val) => updateSetting('profilePublic', val)}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Notifications */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Notificaciones
      </Typography>
      <SettingRow
        label="Activar notificaciones"
        description="Recibir notificaciones dentro de la app"
        checked={settings.notificationsEnabled}
        onChange={(val) => updateSetting('notificationsEnabled', val)}
      />
      <SettingRow
        label="Likes en comentarios"
        checked={settings.notifyLikes}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyLikes', val)}
      />
      <SettingRow
        label="Fotos de menú"
        checked={settings.notifyPhotos}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyPhotos', val)}
      />
      <SettingRow
        label="Rankings"
        checked={settings.notifyRankings}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyRankings', val)}
      />
      <SettingRow
        label="Respuestas a feedback"
        checked={settings.notifyFeedback}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyFeedback', val)}
      />
      <SettingRow
        label="Respuestas a comentarios"
        checked={settings.notifyReplies}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyReplies', val)}
      />
      <SettingRow
        label="Nuevos seguidores"
        checked={settings.notifyFollowers}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyFollowers', val)}
      />
      <SettingRow
        label="Recomendaciones"
        checked={settings.notifyRecommendations}
        disabled={!settings.notificationsEnabled}
        indented
        onChange={(val) => updateSetting('notifyRecommendations', val)}
      />

      <Divider sx={{ my: 1.5 }} />

      {/* Analytics */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Datos de uso
      </Typography>
      <SettingRow
        label="Enviar datos de uso"
        description="Ayuda a mejorar la app enviando datos anónimos de uso"
        checked={settings.analyticsEnabled}
        onChange={(val) => updateSetting('analyticsEnabled', val)}
      />
    </Box>
  );
}
