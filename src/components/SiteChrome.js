'use client';

import { usePathname } from 'next/navigation';

import TrailheadBannerHeader from './TrailheadBannerHeader';
import TrailheadBannerFooter from './TrailheadBannerFooter';
import Sponsors from './Sponsors';

// Routes rendered without the sponsors block (header and footer always stay)
const NO_SPONSORS_ROUTES = ['/snowglobe'];

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  const hideSponsors = NO_SPONSORS_ROUTES.some((route) => pathname === route || pathname?.startsWith(`${route}/`));

  return (
    <>
      <header className='header'>
        <TrailheadBannerHeader />
      </header>
      <main>{children}</main>
      {!hideSponsors && <Sponsors />}
      <TrailheadBannerFooter />
    </>
  );
}
