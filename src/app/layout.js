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
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const InterFont = Inter({
  variable: '--font-inter',
  weights: [400, 500, 600, 700],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Trailhead Banner',
  description: 'Generate your LinkedIn Banner with your Trailhead data',
  url: 'https://thb.nabondance.me',
  keywords: 'Trailhead, LinkedIn, Banner, Header, Generator, Salesforce, Trailblazer, open-source',
  authors: [{ name: 'nabondance', url: 'https://nabondance.me' }],
  publisher: 'nabondance',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <head>
        <link rel='icon' href='/favicon.ico' sizes='32x32' />
        <link rel='icon' href='/favicon-16x16.png' sizes='16x16' type='image/png' />
        <link rel='icon' href='/favicon-32x32.png' sizes='32x32' type='image/png' />
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
        <link rel='apple-touch-icon' href='/apple-touch-icon.png' />
        <link rel='manifest' href='/site.webmanifest' />
        <script
          defer
          src='https://cloud.umami.is/script.js'
          data-website-id='b540d5cc-247f-426e-87ec-0c1258767c22'
        ></script>
        <SpeedInsights />
        <link rel='preload' as='image' href='/assets/logos/trailhead-banner-logo.svg'></link>
        <link
          rel='preload'
          href='/_next/static/media/569ce4b8f30dc480-s.p.woff2'
          as='font'
          type='font/woff2'
          crossOrigin='anonymous'
        />
        <link
          rel='preload'
          href='/_next/static/media/93f479601ee12b01-s.p.woff2'
          as='font'
          type='font/woff2'
          crossOrigin='anonymous'
        />
        <link
          rel='preload'
          href='/_next/static/media/a34f9d1faa5f3315-s.p.woff2'
          as='font'
          type='font/woff2'
          crossOrigin='anonymous'
        />
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
