'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import '@theme-toggles/react/styles/classic.css';
import { Classic } from '@theme-toggles/react';

const ThemeSwitch = () => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className='theme-switch-container'>
      <Classic
        duration={750}
        toggled={isDark}
        onClick={toggleTheme}
        className={isDark ? 'theme-icon-moon' : 'theme-icon-sun'}
      />
    </div>
  );
};

export default ThemeSwitch;
