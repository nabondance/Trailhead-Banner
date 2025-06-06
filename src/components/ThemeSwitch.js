'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import '@theme-toggles/react/css/Classic.css';
import { Classic } from '@theme-toggles/react';

const ThemeSwitch = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className='theme-switch-container'>
      <Classic
        duration={750}
        toggled={theme === 'dark'}
        onToggle={toggleTheme}
        className={theme === 'dark' ? 'theme-icon-moon' : 'theme-icon-sun'}
      />
    </div>
  );
};

export default ThemeSwitch;
