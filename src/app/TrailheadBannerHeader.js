import Image from 'next/image';

const TrailheadBannerHeader = () => {
  return (
    <div className='trailhead-banner-header'>
      <div className='logo-container'>
        <Image src='/assets/trailhead-banner-logo.svg' alt='Trailhead-Banner Logo' width={50} height={50} />
      </div>
      <div className='header-content'>
        <h1>Welcome to Trailhead-Banner</h1>
        <p>Generate your LinkedIn Banner with your Trailhead data</p>
      </div>
    </div>
  );
};

export default TrailheadBannerHeader;