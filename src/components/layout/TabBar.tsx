import { BottomNavigation, BottomNavigationAction, Paper, Badge, Box } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SearchIcon from '@mui/icons-material/Search';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { useTab } from '../../context/TabContext';
import { trackEvent } from '../../utils/analytics';
import type { TabId } from '../../types';
import { EVT_TAB_SWITCHED } from '../../constants/analyticsEvents';

const TAB_ORDER: TabId[] = ['inicio', 'social', 'buscar', 'listas', 'perfil'];

interface TabBarProps {
  notificationBadge?: number;
  recommendationBadge?: number;
}

export default function TabBar({ notificationBadge = 0, recommendationBadge = 0 }: TabBarProps) {
  const { activeTab, setActiveTab } = useTab();

  const handleChange = (_: unknown, newValue: number) => {
    const tab = TAB_ORDER[newValue];
    if (tab !== activeTab) {
      trackEvent(EVT_TAB_SWITCHED, { from: activeTab, to: tab });
      setActiveTab(tab);
    }
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        borderRadius: 0,
      }}
    >
      <BottomNavigation
        value={TAB_ORDER.indexOf(activeTab)}
        onChange={handleChange}
        showLabels
        sx={{
          height: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            py: 0.5,
          },
        }}
      >
        <BottomNavigationAction label="Inicio" icon={<HomeOutlinedIcon />} />
        <BottomNavigationAction
          label="Social"
          icon={
            <Badge badgeContent={recommendationBadge} color="error" max={99}>
              <PeopleOutlinedIcon />
            </Badge>
          }
        />
        <BottomNavigationAction
          label="Buscar"
          icon={
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mt: -2.5,
                boxShadow: 3,
              }}
            >
              <SearchIcon sx={{ color: 'primary.contrastText', fontSize: 28 }} />
            </Box>
          }
          sx={{
            '&.Mui-selected': {
              '& .MuiBox-root': {
                bgcolor: 'primary.dark',
              },
            },
          }}
        />
        <BottomNavigationAction label="Listas" icon={<BookmarkBorderIcon />} />
        <BottomNavigationAction
          label="Perfil"
          icon={
            <Badge badgeContent={notificationBadge} color="error" max={99}>
              <PersonOutlinedIcon />
            </Badge>
          }
        />
      </BottomNavigation>
    </Paper>
  );
}
