import React from 'react';
import Image from 'next/image';
import './globals.css'; // Assuming you have a CSS file for the footer styles

const TrailheadBannerFooter = () => {
  return (
    <footer className='footer'>
      <a href='https://github.com/nabondance' target='_blank' rel='noopener noreferrer' className='footer-link'>
        &copy; 2024 Trailhead-Banner By{' '}
        <Image src='/assets/logos/github-logo.svg' alt='GitHub' className='github-logo' width={20} height={20} /> /nabondance
      </a>
    </footer>
  );
};

export default TrailheadBannerFooter;
