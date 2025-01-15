import React from 'react';
import ThemedImage from './ThemedImage';
import '../styles/globals.css';

const TrailheadBannerFooter = () => {
  console.log('Rendering Footer');
  return (
    <footer className='footer'>
      <a href='https://github.com/nabondance' target='_blank' rel='noopener noreferrer' className='footer-link'>
        &copy; 2025 Trailhead-Banner by{' '}
        <ThemedImage basePath='/assets/logos/github-logo' alt='GitHub' className='github-logo' width={15} height={15} />{' '}
        /nabondance
      </a>
    </footer>
  );
};

export default TrailheadBannerFooter;
