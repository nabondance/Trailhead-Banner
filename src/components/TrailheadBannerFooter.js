import React from 'react';
import Image from 'next/image';
import '../styles/globals.css';

const TrailheadBannerFooter = () => {
  console.log('Rendering Footer');
  return (
    <footer className='footer'>
      <a href='https://github.com/nabondance' target='_blank' rel='noopener noreferrer' className='footer-link'>
        &copy; 2025 Trailhead-Banner by{' '}
        <Image src='/assets/logos/github-logo.svg' alt='GitHub' className='github-logo' width={15} height={15} />{' '}
        /nabondance
      </a>
    </footer>
  );
};

export default TrailheadBannerFooter;
