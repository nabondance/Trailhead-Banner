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
        <p>Generate your LinkedIn Banner with your Trailhead data</p>
        <nav className='header-nav'>
          <Link href='/'>
           Home
          </Link>
          <Link href='/examples'>
            Examples
          </Link>
        </nav>
      </div>
    </div>
  );
};

export default TrailheadBannerHeader;
