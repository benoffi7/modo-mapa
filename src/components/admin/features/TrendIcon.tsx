import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

interface TrendIconProps {
  today: number;
  yesterday: number;
}

export default function TrendIcon({ today, yesterday }: TrendIconProps) {
  if (today > yesterday) return <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />;
  if (today < yesterday) return <TrendingDownIcon fontSize="small" sx={{ color: 'error.main' }} />;
  return <TrendingFlatIcon fontSize="small" sx={{ color: 'text.disabled' }} />;
}
