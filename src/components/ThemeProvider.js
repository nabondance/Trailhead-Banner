'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Rendered on the server so crawlers get the full page HTML. next-themes injects an
// inline script that sets the theme class before hydration (no flash); <html> carries
// suppressHydrationWarning because that script changes its class attribute.
const ThemeProvider = ({ children }) => <NextThemesProvider attribute='class'>{children}</NextThemesProvider>;

export default ThemeProvider;
