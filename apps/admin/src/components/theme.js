import { createContext, useContext } from 'react';

// { theme: 'light'|'dark', pref: 'auto'|'light'|'dark', setPref }
export const ThemeCtx = createContext(null);
export const useThemeCtl = () => useContext(ThemeCtx);
