import { Box, Card, CardActionArea, Typography } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import PeopleIcon from '@mui/icons-material/People';
import FavoriteIcon from '@mui/icons-material/Favorite';

interface StatCardProps {
  icon: React.ReactElement;
  count: number;
  label: string;
  onTap?: (() => void) | undefined;
}

function StatCard({ icon, count, label, onTap }: StatCardProps) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
      <CardActionArea onClick={onTap} sx={{ p: 1.5, textAlign: 'center' }}>
        {icon}
        <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1 }}>
          {count}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {label}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

interface StatsCardsProps {
  places: number;
  reviews: number;
  followers: number;
  favorites: number;
  onPlacesTap?: () => void;
  onReviewsTap?: () => void;
  onFollowersTap?: () => void;
  onFavoritesTap?: () => void;
}

export default function StatsCards({
  places, reviews, followers, favorites,
  onPlacesTap, onReviewsTap, onFollowersTap, onFavoritesTap,
}: StatsCardsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1 }}>
      <StatCard icon={<PlaceIcon color="success" />} count={places} label="Lugares" onTap={onPlacesTap} />
      <StatCard icon={<StarIcon color="warning" />} count={reviews} label="Resenas" onTap={onReviewsTap} />
      <StatCard icon={<PeopleIcon color="info" />} count={followers} label="Seguidores" onTap={onFollowersTap} />
      <StatCard icon={<FavoriteIcon color="error" />} count={favorites} label="Favoritos" onTap={onFavoritesTap} />
    </Box>
  );
}
