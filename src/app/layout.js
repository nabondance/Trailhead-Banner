import { SpeedInsights } from '@vercel/speed-insights/next';

import TrailheadBannerHeader from '../components/TrailheadBannerHeader';
import TrailheadBannerFooter from '../components/TrailheadBannerFooter';

import ThemeProvider from '../components/ThemeProvider';

import { Geist, Geist_Mono, Inter } from 'next/font/google';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
config.autoAddCss = false;

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const InterFont = Inter({
  variable: '--font-inter',
  weights: [400, 500, 600, 700],
  subsets: ['latin'],
});

export const metadata = {
  title: 'Trailhead Banner',
  description: 'Generate your LinkedIn Banner with your Trailhead data',
  url: 'https://thb.nabondance.me',
  keywords: 'Trailhead, LinkedIn, Banner, Header, Generator, Salesforce, Trailblazer, open-source',
  authors: [{ name: 'nabondance', url: 'https://nabondance.me' }],
  publisher: 'nabondance',
  icon: {
    url: '/favicon.svg',
    type: 'image/svg+xml',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <head>
        <script
          defer
          src='https://cloud.umami.is/script.js'
          data-website-id='b540d5cc-247f-426e-87ec-0c1258767c22'
        ></script>
        <SpeedInsights />
        <link rel='preload' as='image' href='/assets/logos/trailhead-banner-logo.svg'></link>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <header className='header'>
            <TrailheadBannerHeader />
          </header>
          <main>{children}</main>
          <TrailheadBannerFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
