'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import NavDropdown from './NavDropdown';

const ThemeSwitch = dynamic(() => import('./ThemeSwitch'), { ssr: false });

const TrailheadBannerHeader = () => {
  const pathname = usePathname();
  // Each page renders its own <h1>; the site name is only the <h1> on the home page
  const TitleTag = pathname === '/' ? 'h1' : 'p';
  const currentMonth = new Date().getMonth(); // 0 = January, 11 = December
  const isRewindActive = currentMonth === 11 || currentMonth === 0;

  const generatorsOptions = [
    { value: '/', label: 'Banner Generator' },
    ...(isRewindActive ? [{ value: '/rewind', label: 'Trailhead Rewind', isNew: true }] : []),
  ];

  const aboutOptions = [
    { value: '/releases', label: 'Releases' },
    { value: '/sponsors', label: 'Sponsors' },
    { value: '/legal', label: 'Terms & Privacy' },
    { value: 'https://github.com/nabondance/Trailhead-Stats', label: 'Trailhead Stats' },
  ];

  return (
    <div className='trailhead-banner-header'>
      <ThemeSwitch />
      <div className='logo-container'>
        <Link href='/'>
          <Image
            src='/assets/logos/trailhead-banner-logo.svg'
            alt='Trailhead Banner Logo'
            width={120}
            height={120}
            priority
          />
        </Link>
      </div>
      <div className='header-content'>
        <TitleTag className='site-title'>Trailhead Banner</TitleTag>
        <p className='site-tagline'>Generate your LinkedIn Banner with your Trailhead data</p>
        <nav className='header-nav'>
          <NavDropdown label='Generators' options={generatorsOptions} defaultUrl='/' />
          <Link href='/how-to'>How-To</Link>
          <Link href='/examples'>Examples</Link>
          <Link href='/background-library'>Background Library</Link>
          <NavDropdown label='About' options={aboutOptions} />
        </nav>
      </div>
    </div>
  );
};

export default TrailheadBannerHeader;
