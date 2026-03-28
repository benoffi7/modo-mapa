import { useState, memo } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import BusinessComments from './BusinessComments';
import BusinessQuestions from './BusinessQuestions';
import type { Comment } from '../../types';

type SubTab = 'comments' | 'questions';

interface Props {
  businessId: string;
  businessName: string;
  comments: Comment[];
  regularComments: Comment[];
  userCommentLikes: Set<string>;
  isLoading: boolean;
  onCommentsChange: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export default memo(function OpinionesTab({
  businessId,
  businessName,
  comments,
  regularComments,
  userCommentLikes,
  isLoading,
  onCommentsChange,
  onDirtyChange,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>('comments');

  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <Tabs
        value={subTab}
        onChange={(_, v) => setSubTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 36, mb: 1, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.85rem' } }}
      >
        <Tab label="Comentarios" value="comments" />
        <Tab label="Preguntas" value="questions" />
      </Tabs>
      <Box sx={{ display: subTab === 'comments' ? 'block' : 'none' }}>
        <BusinessComments
          businessId={businessId}
          businessName={businessName}
          comments={regularComments}
          userCommentLikes={userCommentLikes}
          isLoading={isLoading}
          onCommentsChange={onCommentsChange}
          onDirtyChange={onDirtyChange}
        />
      </Box>
      <Box sx={{ display: subTab === 'questions' ? 'block' : 'none' }}>
        <BusinessQuestions
          businessId={businessId}
          businessName={businessName}
          comments={comments}
          userCommentLikes={userCommentLikes}
          isLoading={isLoading}
          onCommentsChange={onCommentsChange}
        />
      </Box>
    </Box>
  );
});
