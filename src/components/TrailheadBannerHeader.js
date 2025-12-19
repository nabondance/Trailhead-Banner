'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ThemeSwitch = dynamic(() => import('./ThemeSwitch'), { ssr: false });
import '../styles/globals.css';

const TrailheadBannerHeader = () => {
  return (
    <div className='trailhead-banner-header'>
      <ThemeSwitch />
      <div className='logo-container'>
        <Image
          src='/assets/logos/trailhead-banner-logo.svg'
          alt='Trailhead-Banner Logo'
          width={120}
          height={120}
          priority
        />
      </div>
      <div className='header-content'>
        <h1>Trailhead-Banner</h1>
        <h2>Generate your LinkedIn Banner with your Trailhead data</h2>
        <nav className='header-nav'>
          <div className='dropdown'>
            <Link href='/' className='dropbtn'>
              Generators
            </Link>
            <div className='dropdown-content'>
              <Link href='/'>Banner Generator</Link>
              <Link href='/rewind'>Rewind</Link>
            </div>
          </div>
          <Link href='/how-to'>How-To</Link>
          <Link href='/examples'>Examples</Link>
          <Link href='/background-library'>Background Library</Link>
          <div className='dropdown'>
            <button className='dropbtn'>About</button>
            <div className='dropdown-content'>
              <Link href='/releases'>Releases</Link>
              <Link href='/legal'>Terms & Privacy</Link>
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
