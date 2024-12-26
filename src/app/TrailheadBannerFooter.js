import React from 'react';
import Image from 'next/image';
import './globals.css';

const TrailheadBannerFooter = () => {
  return (
    <footer className='footer'>
      <a href='https://github.com/nabondance' target='_blank' rel='noopener noreferrer' className='footer-link'>
        &copy; 2025 Trailhead-Banner By{' '}
        <Image src='/assets/logos/github-logo.svg' alt='GitHub' className='github-logo' width={15} height={15} />{' '}
        /nabondance
      </a>
    </footer>
  );
};

export default TrailheadBannerFooter;
