'use client';

import React, { useSyncExternalStore } from 'react';
import GitHubButton from 'react-github-btn';
import { useTheme } from 'next-themes';
import { useIsClient } from '../utils/useIsClient';

const subscribeResize = (onChange) => {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
};

const TrailheadBannerFooter = () => {
  const buttonSize = useSyncExternalStore(
    subscribeResize,
    () => (window.innerWidth <= 768 ? 'small' : 'large'),
    () => 'large'
  );
  const mounted = useIsClient();
  const { resolvedTheme } = useTheme();
  // resolvedTheme is unknown during server render; use light until mounted to avoid a hydration mismatch
  const colorScheme = mounted && resolvedTheme === 'dark' ? 'dark_dimmed' : 'light';
  // The static HTML is built at deploy time; use the visitor's year only once mounted
  const year = mounted ? new Date().getFullYear() : 2025;

  return (
    <footer className='footer'>
      <div className='footer-buttons'>
        <GitHubButton
          href='https://github.com/nabondance/trailhead-banner'
          data-color-scheme={colorScheme}
          data-icon='octicon-star'
          data-size={buttonSize}
          data-show-count='true'
          aria-label='Star nabondance/trailhead-banner on GitHub'
          className='footer-star'
        >
          Star the repository
        </GitHubButton>{' '}
        <GitHubButton
          href='https://github.com/nabondance'
          data-color-scheme={colorScheme}
          data-size={buttonSize}
          data-show-count='true'
          aria-label='Follow @nabondance on GitHub'
          className='footer-follow'
        >
          Follow @nabondance
        </GitHubButton>
      </div>
      <a href='https://nabondance.me' target='_blank' rel='noopener noreferrer' className='footer-link'>
        &copy; {year === 2025 ? '2025' : `2025-${year}`} Trailhead Banner by /nabondance.me powered by Think2
      </a>
    </footer>
  );
};

export default TrailheadBannerFooter;
