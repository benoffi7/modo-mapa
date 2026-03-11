import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useMapContext } from '../../context/MapContext';
import { CATEGORY_LABELS } from '../../types';
import type { Business } from '../../types';
import businessesData from '../../data/businesses.json';

const allBusinesses: Business[] = businessesData as Business[];

interface FavoriteItem {
  businessId: string;
  business: Business;
  createdAt: Date;
}

interface Props {
  onNavigate: () => void;
}

export default function FavoritesList({ onNavigate }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useMapContext();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'favorites'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const items: FavoriteItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const business = allBusinesses.find((b) => b.id === data.businessId);
        if (business) {
          items.push({
            businessId: data.businessId,
            business,
            createdAt: data.createdAt?.toDate() || new Date(),
          });
        }
      });
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setFavorites(items);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleRemoveFavorite = async (businessId: string) => {
    if (!user) return;
    const docId = `${user.uid}__${businessId}`;
    await deleteDoc(doc(db, 'favorites', docId));
    setFavorites((prev) => prev.filter((f) => f.businessId !== businessId));
  };

  const handleSelectBusiness = (business: Business) => {
    setSelectedBusiness(business);
    onNavigate();
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Cargando...
        </Typography>
      </Box>
    );
  }

  if (favorites.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <FavoriteBorderIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No tenés favoritos todavía
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {favorites.map((fav) => (
        <ListItemButton
          key={fav.businessId}
          onClick={() => handleSelectBusiness(fav.business)}
          sx={{ pr: 1 }}
        >
          <ListItemText
            primary={fav.business.name}
            secondary={
              <>
                <Chip
                  label={CATEGORY_LABELS[fav.business.category]}
                  size="small"
                  component="span"
                  sx={{ alignSelf: 'flex-start', fontSize: '0.7rem', height: 20, display: 'inline-flex', mt: 0.5 }}
                />
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {fav.business.address}
                </Typography>
              </>
            }
            primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
          />
          <IconButton
            edge="end"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFavorite(fav.businessId);
            }}
            sx={{ color: '#ea4335' }}
          >
            <FavoriteIcon />
          </IconButton>
        </ListItemButton>
      ))}
    </List>
  );
}
