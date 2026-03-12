import { useContext } from 'react';
import { ColorModeContext } from '../context/ColorModeContext';

export function useColorMode() {
  return useContext(ColorModeContext);
}
