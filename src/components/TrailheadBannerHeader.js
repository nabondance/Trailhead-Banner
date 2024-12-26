import Image from 'next/image';
import Link from 'next/link';
import '../styles/globals.css';

const TrailheadBannerHeader = () => {
  return (
    <div className='trailhead-banner-header'>
      <div className='logo-container'>
        <Image src='/assets/logos/trailhead-banner-logo.svg' alt='Trailhead-Banner Logo' width={120} height={120} />
      </div>
      <div className='header-content'>
        <h1>Welcome to Trailhead-Banner</h1>
        <h2>Generate your LinkedIn Banner with your Trailhead data</h2>
        <nav className='header-nav'>
          <Link href='/'>Banner Generator</Link>
          <Link href='/examples'>Examples</Link>
          <Link href='/background-library'>Background Library</Link>
        </nav>
      </div>
    </div>
  );
};

export default TrailheadBannerHeader;
