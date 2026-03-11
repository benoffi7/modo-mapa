import { useState, useEffect, useCallback } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { PREDEFINED_TAGS } from '../../types';

interface Props {
  businessId: string;
  seedTags: string[];
}

interface TagCount {
  tagId: string;
  count: number;
  userAdded: boolean;
}

export default function BusinessTags({ businessId, seedTags }: Props) {
  const { user } = useAuth();
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);

  const loadTags = useCallback(async () => {
    const q = query(collection(db, 'userTags'), where('businessId', '==', businessId));
    const snapshot = await getDocs(q);

    const counts: Record<string, { count: number; userAdded: boolean }> = {};

    // Init with seed tags
    seedTags.forEach((tagId) => {
      counts[tagId] = { count: 0, userAdded: false };
    });

    snapshot.forEach((d) => {
      const data = d.data();
      if (!counts[data.tagId]) {
        counts[data.tagId] = { count: 0, userAdded: false };
      }
      counts[data.tagId].count++;
      if (user && data.userId === user.uid) {
        counts[data.tagId].userAdded = true;
      }
    });

    setTagCounts(
      Object.entries(counts).map(([tagId, { count, userAdded }]) => ({
        tagId,
        count,
        userAdded,
      }))
    );
  }, [businessId, seedTags, user]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleToggleTag = async (tagId: string) => {
    if (!user) return;
    const docId = `${user.uid}__${businessId}__${tagId}`;
    const tagRef = doc(db, 'userTags', docId);

    const existing = tagCounts.find((t) => t.tagId === tagId);
    if (existing?.userAdded) {
      await deleteDoc(tagRef);
    } else {
      await setDoc(tagRef, {
        userId: user.uid,
        businessId,
        tagId,
        createdAt: serverTimestamp(),
      });
    }
    loadTags();
  };

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        Etiquetas
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {PREDEFINED_TAGS.map((tag) => {
          const tagData = tagCounts.find((t) => t.tagId === tag.id);
          const isSeed = seedTags.includes(tag.id);
          const count = tagData?.count || 0;
          const userAdded = tagData?.userAdded || false;
          const isVisible = isSeed || count > 0;

          if (!isVisible && !user) return null;

          return (
            <Chip
              key={tag.id}
              label={`${tag.label}${count > 0 ? ` (${count})` : ''}`}
              size="small"
              icon={userAdded ? <CheckIcon fontSize="small" /> : <AddIcon fontSize="small" />}
              onClick={() => handleToggleTag(tag.id)}
              variant={isSeed || userAdded ? 'filled' : 'outlined'}
              color={userAdded ? 'primary' : 'default'}
              sx={{
                opacity: isVisible ? 1 : 0.6,
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
