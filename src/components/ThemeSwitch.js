'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import '@theme-toggles/react/css/DarkSide.css';
import { DarkSide } from '@theme-toggles/react';

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
      <DarkSide duration={750} toggled={theme === 'dark'} onToggle={toggleTheme} />
    </div>
  );
};

export default ThemeSwitch;
