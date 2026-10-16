'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import GitHubButton from 'react-github-btn';
import { useTheme } from 'next-themes';

// Plain links to every public page: the header dropdowns are buttons, which crawlers don't follow
const footerLinks = [
  { href: '/', label: 'Banner Generator' },
  { href: '/how-to', label: 'How-To' },
  { href: '/examples', label: 'Examples' },
  { href: '/background-library', label: 'Background Library' },
  { href: '/rewind', label: 'Trailhead Rewind' },
  { href: '/releases', label: 'Releases' },
  { href: '/sponsors', label: 'Sponsors' },
  { href: '/legal', label: 'Terms & Privacy' },
];

const TrailheadBannerFooter = () => {
  const [buttonSize, setButtonSize] = useState('large');
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  // resolvedTheme is unknown during server render; use light until mounted to avoid a hydration mismatch
  const colorScheme = mounted && resolvedTheme === 'dark' ? 'dark_dimmed' : 'light';

  useEffect(() => {
    const handleResize = () => {
      setButtonSize(window.innerWidth <= 768 ? 'small' : 'large');
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial size
    setMounted(true);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <footer className='footer'>
      <nav className='footer-nav' aria-label='Site pages'>
        {footerLinks.map(({ href, label }) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className='footer-buttons'>
        <GitHubButton
          href='https://github.com/nabondance/trailhead-banner'
          data-color-scheme={colorScheme}
          data-icon='octicon-star'
          data-size={buttonSize}
          data-show-count='true'
          aria-label='Star nabondance/trailhead-banner on GitHub'
          className='footer-star'
        >
          Star the repository
        </GitHubButton>{' '}
        <GitHubButton
          href='https://github.com/nabondance'
          data-color-scheme={colorScheme}
          data-size={buttonSize}
          data-show-count='true'
          aria-label='Follow @nabondance on GitHub'
          className='footer-follow'
        >
          Follow @nabondance
        </GitHubButton>
      </div>
      <a href='https://nabondance.me' target='_blank' rel='noopener noreferrer' className='footer-link'>
        &copy; {new Date().getFullYear() === 2025 ? '2025' : `2025-${new Date().getFullYear()}`} Trailhead Banner by
        /nabondance.me powered by Think2
      </a>
    </footer>
  );
};

export default TrailheadBannerFooter;
