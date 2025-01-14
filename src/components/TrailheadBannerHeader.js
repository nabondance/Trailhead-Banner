'use client';

import Image from 'next/image';
import Link from 'next/link';
import ThemeSwitch from '../components/ThemeSwitch';
import '../styles/globals.css';

const TrailheadBannerHeader = () => {
  return (
    <div className='trailhead-banner-header'>
      <a
        href='https://github.com/nabondance/Trailhead-Banner'
        className='star-repo'
        target='_blank'
        rel='noopener noreferrer'
      >
        ⭐ Star the repo to get updates!
      </a>
      <div className='theme-switch-container'>
        <ThemeSwitch />
      </div>
      <div className='logo-container'>
        <Image src='/assets/logos/trailhead-banner-logo.svg' alt='Trailhead-Banner Logo' width={120} height={120} />
      </div>
      <div className='header-content'>
        <h1>Trailhead-Banner</h1>
        <h2>Generate your LinkedIn Banner with your Trailhead data</h2>
        <nav className='header-nav'>
          <Link href='/'>Banner Generator</Link>
          <Link href='/examples'>Examples</Link>
          <Link href='/background-library'>Background Library</Link>
          <div className='dropdown'>
            <button className='dropbtn'>More fun</button>
            <div className='dropdown-content'>
              <Link href='https://github.com/nabondance/Trailhead-Stats' target='_blank' rel='noopener noreferrer'>
                Trailhead Stats
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default TrailheadBannerHeader;
