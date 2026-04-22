import { useCallback, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Dialog from '@mui/material/Dialog';
import GitHubIcon from '@mui/icons-material/GitHub';
import { fetchRecentFeedback } from '../../services/admin';
import { respondToFeedback, resolveFeedback, createGithubIssueFromFeedback } from '../../services/adminFeedback';
import { useAsyncData } from '../../hooks/useAsyncData';
import { allBusinesses } from '../../hooks/useBusinesses';
import { getBusinessById } from '../../utils/businessMap';
import { formatDateShort } from '../../utils/formatDate';
import { FEEDBACK_STATUSES } from '../../constants/feedback';
import type { Feedback, FeedbackCategory, FeedbackStatus, Business } from '../../types';
import AdminPanelWrapper from './AdminPanelWrapper';
import ActivityTable from './ActivityTable';
import FeedbackRespondForm from './feedback/FeedbackRespondForm';
import FeedbackBusinessDialog from './feedback/FeedbackBusinessDialog';
import FeedbackMediaPreview from './feedback/FeedbackMediaPreview';

function categoryColor(cat: FeedbackCategory): 'error' | 'primary' | 'info' | 'warning' | 'default' {
  if (cat === 'bug') return 'error';
  if (cat === 'sugerencia') return 'primary';
  if (cat === 'datos_usuario') return 'info';
  if (cat === 'datos_comercio') return 'warning';
  return 'default';
}

type StatusFilter = 'all' | FeedbackStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'viewed', label: 'Vistos' },
  { value: 'responded', label: 'Respondidos' },
  { value: 'resolved', label: 'Resueltos' },
];

export default function FeedbackList() {
  const fetcher = useCallback(() => fetchRecentFeedback(50), []);
  const { data: feedback, loading, error, refetch } = useAsyncData<Feedback[]>(fetcher);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [businessFilter, setBusinessFilter] = useState<string | null>(null);
  const [businessDetailId, setBusinessDetailId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mediaOpen, setMediaOpen] = useState<string | null>(null);

  const filtered = feedback?.filter((f) => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (businessFilter && f.businessId !== businessFilter) return false;
    return true;
  }) ?? [];

  const handleOpenBusiness = (businessId: string) => {
    setBusinessDetailId(businessId);
  };

  const businessDetail = useMemo(() => {
    if (!businessDetailId) return null;
    return getBusinessById(businessDetailId) ?? null;
  }, [businessDetailId]);

  const handleRespond = async (feedbackId: string) => {
    const trimmed = responseText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await respondToFeedback({ feedbackId, response: trimmed });
      setRespondingId(null);
      setResponseText('');
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (feedbackId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await resolveFeedback({ feedbackId });
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIssue = async (feedbackId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createGithubIssueFromFeedback({ feedbackId });
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPanelWrapper loading={loading} error={error} errorMessage="No se pudo cargar el feedback.">
      <Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {STATUS_FILTERS.map((sf) => (
            <Chip
              key={sf.value}
              label={sf.label}
              size="small"
              variant={statusFilter === sf.value ? 'filled' : 'outlined'}
              color={statusFilter === sf.value ? 'primary' : 'default'}
              onClick={() => setStatusFilter(sf.value)}
            />
          ))}
        </Box>
        <Autocomplete<Business, false, false, false>
          options={allBusinesses}
          getOptionLabel={(b) => b.name}
          value={getBusinessById(businessFilter ?? '') ?? null}
          onChange={(_e, value) => setBusinessFilter(value?.id ?? null)}
          renderInput={(params) => (
            <TextField {...params} placeholder="Filtrar por comercio" size="small" />
          )}
          size="small"
          sx={{ mb: 2, maxWidth: 300 }}
        />
        <ActivityTable
          items={filtered}
          columns={[
            { label: 'Usuario', render: (f) => f.userId.slice(0, 8) },
            { label: 'Categoría', render: (f) => <Chip label={f.category} size="small" color={categoryColor(f.category)} /> },
            {
              label: 'Comercio',
              render: (f) => f.businessName ? (
                <Chip
                  label={f.businessName}
                  size="small"
                  color="warning"
                  variant="outlined"
                  onClick={() => handleOpenBusiness(f.businessId!)}
                  clickable
                />
              ) : (
                <Typography variant="caption" color="text.disabled">&mdash;</Typography>
              ),
            },
            {
              label: 'Mensaje',
              render: (f) => (
                <Box>
                  <Typography variant="body2">{f.message}</Typography>
                  <FeedbackMediaPreview mediaUrl={f.mediaUrl} mediaType={f.mediaType} onOpenImage={setMediaOpen} />
                </Box>
              ),
            },
            { label: 'Fecha', render: (f) => formatDateShort(f.createdAt) },
            {
              label: 'Estado',
              render: (f) => (
                <Chip
                  label={FEEDBACK_STATUSES[f.status].label}
                  size="small"
                  color={FEEDBACK_STATUSES[f.status].color}
                />
              ),
            },
            {
              label: 'Acciones',
              render: (f) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 180 }}>
                  {f.adminResponse && (
                    <Typography variant="caption" color="text.secondary">
                      Respuesta: {f.adminResponse}
                    </Typography>
                  )}
                  {respondingId === f.id ? (
                    <FeedbackRespondForm
                      value={responseText}
                      onChange={setResponseText}
                      onSubmit={() => handleRespond(f.id)}
                      onCancel={() => { setRespondingId(null); setResponseText(''); }}
                      submitting={submitting}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {f.status !== 'resolved' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { setRespondingId(f.id); setResponseText(''); }}
                        >
                          Responder
                        </Button>
                      )}
                      {f.status !== 'resolved' && (
                        <Button
                          size="small"
                          color="success"
                          variant="outlined"
                          disabled={submitting}
                          onClick={() => handleResolve(f.id)}
                        >
                          Resolver
                        </Button>
                      )}
                      {f.githubIssueUrl ? (
                        <Link
                          href={f.githubIssueUrl}
                          target="_blank"
                          rel="noopener"
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.8125rem' }}
                        >
                          <GitHubIcon fontSize="small" />
                          Ver Issue
                        </Link>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<GitHubIcon />}
                          disabled={submitting}
                          onClick={() => handleCreateIssue(f.id)}
                        >
                          Crear Issue
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              ),
            },
          ]}
        />
        <Dialog open={!!mediaOpen} onClose={() => setMediaOpen(null)} maxWidth="md">
          {mediaOpen && (
            <Box
              component="img"
              src={mediaOpen}
              alt="Adjunto ampliado"
              sx={{ maxWidth: '100%', maxHeight: '80vh', display: 'block' }}
            />
          )}
        </Dialog>
        <FeedbackBusinessDialog
          businessDetailId={businessDetailId}
          businessDetail={businessDetail}
          onClose={() => setBusinessDetailId(null)}
        />
      </Box>
    </AdminPanelWrapper>
  );
}
