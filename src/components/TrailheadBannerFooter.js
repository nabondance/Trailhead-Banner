'use client';

import React, { useEffect, useState } from 'react';
import GitHubButton from 'react-github-btn';
import '../styles/globals.css';

const TrailheadBannerFooter = () => {
  const [buttonSize, setButtonSize] = useState('large');

  useEffect(() => {
    const handleResize = () => {
      setButtonSize(window.innerWidth <= 768 ? 'small' : 'large');
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <footer className='footer'>
      <div className='footer-buttons'>
        <GitHubButton
          href='https://github.com/nabondance/trailhead-banner'
          data-color-scheme='no-preference: light; light: light; dark: dark;'
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
          data-color-scheme='no-preference: light; light: light; dark: dark;'
          data-size={buttonSize}
          data-show-count='true'
          aria-label='Follow @nabondance on GitHub'
          className='footer-follow'
        >
          Follow @nabondance
        </GitHubButton>
      </div>
      <a href='https://nabondance.me' target='_blank' rel='noopener noreferrer' className='footer-link'>
        &copy; 2025 Trailhead-Banner by /nabondance.me
      </a>
    </footer>
  );
};

export default TrailheadBannerFooter;
