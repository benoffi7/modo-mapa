import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

export function getDesignTokens(mode: 'light' | 'dark'): ThemeOptions {
  const isLight = mode === 'light';

  return {
    palette: {
      mode,
      primary: {
        main: '#1a73e8',
        light: '#4791db',
        dark: '#115293',
      },
      secondary: {
        main: '#ea4335',
      },
      background: {
        default: isLight ? '#ffffff' : '#121212',
        paper: isLight ? '#ffffff' : '#1e1e1e',
      },
      text: {
        primary: isLight ? '#202124' : '#e8eaed',
        secondary: isLight ? '#5f6368' : '#9aa0a6',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Arial", sans-serif',
      h6: {
        fontSize: '1.1rem',
        fontWeight: 500,
      },
      body1: {
        fontSize: '0.95rem',
      },
      body2: {
        fontSize: '0.85rem',
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow: isLight
              ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
              : '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            fontWeight: 500,
            fontSize: '0.8rem',
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: {
            '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
              WebkitBoxShadow: `0 0 0 100px ${isLight ? '#fff' : '#121212'} inset !important`,
              WebkitTextFillColor: `${isLight ? '#000' : '#fff'} !important`,
              transition: 'background-color 5000s ease-in-out 0s',
              caretColor: isLight ? '#000' : '#fff',
            },
          },
        },
      },
    },
  };
}

const theme = createTheme(getDesignTokens('light'));

export default theme;
