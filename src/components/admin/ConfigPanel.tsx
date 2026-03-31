import { useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchConfigDocs, updateModerationBannedWords } from '../../services/admin/config';
import { trackEvent } from '../../utils/analytics';
import { ADMIN_CONFIG_VIEWED, ADMIN_MODERATION_UPDATED } from '../../constants/analyticsEvents';
import AdminPanelWrapper from './AdminPanelWrapper';
import ConfigDocViewer from './config/ConfigDocViewer';
import ModerationEditor from './config/ModerationEditor';
import ActivityFeedDiag from './config/ActivityFeedDiag';

export default function ConfigPanel() {
  const fetcher = useCallback(() => fetchConfigDocs(), []);
  const { data: docs, loading, error, refetch } = useAsyncData(fetcher);

  useEffect(() => {
    trackEvent(ADMIN_CONFIG_VIEWED);
  }, []);

  const moderationDoc = docs?.find((d) => d.id === 'moderation');
  const bannedWords = (moderationDoc?.data?.bannedWords as string[]) ?? [];

  async function handleSaveBannedWords(words: string[]) {
    await updateModerationBannedWords(words);
    trackEvent(ADMIN_MODERATION_UPDATED, { count: words.length });
    refetch();
  }

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudo cargar la configuración.">
      <Box>
        {docs?.map((doc) => (
          <Accordion key={doc.id} defaultExpanded={doc.id === 'moderation'}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">{doc.id}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {doc.id === 'moderation' ? (
                <Box>
                  <ConfigDocViewer docId={doc.id} data={doc.data} />
                  <Divider sx={{ my: 2 }} />
                  <ModerationEditor
                    bannedWords={bannedWords}
                    onSave={handleSaveBannedWords}
                  />
                </Box>
              ) : (
                <ConfigDocViewer docId={doc.id} data={doc.data} />
              )}
            </AccordionDetails>
          </Accordion>
        ))}

        <Divider sx={{ my: 3 }} />
        <ActivityFeedDiag />
      </Box>
    </AdminPanelWrapper>
  );
}
