import { SpeedInsights } from '@vercel/speed-insights/next';

import '../styles/globals.css';

import TrailheadBannerHeader from '../components/TrailheadBannerHeader';
import TrailheadBannerFooter from '../components/TrailheadBannerFooter';
import JsonLd from '../components/JsonLd';
import bannerBackgrounds from '../data/banners.json';
import { getBannerCount } from '../utils/bannerCountUtils';

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

const siteUrl = 'https://thb.nabondance.me';
const siteDescription =
  'Free, open-source LinkedIn banner generator for Salesforce Trailblazers: turn your Trailhead badges, certifications and rank into a 1584×396 banner.';
const ogImage = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Trailhead Banner – LinkedIn Banner for Salesforce Trailblazers',
};

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Trailhead Banner',
  description: siteDescription,
  keywords: 'Trailhead, LinkedIn, Banner, Header, Generator, Salesforce, Trailblazer, open-source',
  authors: [{ name: 'nabondance', url: 'https://nabondance.me' }],
  publisher: 'nabondance',
  openGraph: {
    title: 'Trailhead Banner',
    description: siteDescription,
    url: siteUrl,
    siteName: 'Trailhead Banner',
    type: 'website',
    locale: 'en_US',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trailhead Banner',
    description: siteDescription,
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

const author = {
  '@type': 'Person',
  '@id': 'https://nabondance.me/#person',
  name: 'nabondance',
  url: 'https://nabondance.me',
  sameAs: ['https://github.com/nabondance'],
};

const buildJsonLd = (bannerCount) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: 'Trailhead Banner',
      alternateName: 'THB',
      url: siteUrl,
      description: siteDescription,
      inLanguage: 'en',
      publisher: { '@id': author['@id'] },
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#app`,
      name: 'Trailhead Banner',
      url: siteUrl,
      description: siteDescription,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      image: `${siteUrl}/og-image.png`,
      screenshot: `${siteUrl}/og-image.png`,
      featureList: [
        'Generate a 1584×396 LinkedIn banner from a Trailhead username',
        'Trailblazer rank, badge, superbadge and certification counters',
        'Salesforce and Accredited Professional certification logos',
        'Superbadges, Agentblazer rank and Salesforce MVP ribbon',
        `${bannerBackgrounds.length} built-in backgrounds, custom image URL or upload`,
        'Trailhead Rewind year-in-review banner',
      ],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@id': author['@id'] },
      sameAs: ['https://github.com/nabondance/trailhead-banner'],
      ...(bannerCount > 0 && {
        interactionStatistic: {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/CreateAction',
          userInteractionCount: bannerCount,
          description: 'LinkedIn banners generated',
        },
      }),
    },
    author,
  ],
});

export default async function RootLayout({ children }) {
  const jsonLd = buildJsonLd(await getBannerCount());
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <JsonLd data={jsonLd} />
        <link rel='icon' href='/favicon.ico' sizes='32x32' />
        <link rel='icon' href='/favicon-16x16.png' sizes='16x16' type='image/png' />
        <link rel='icon' href='/favicon-32x32.png' sizes='32x32' type='image/png' />
        <link rel='icon' href='/favicon-192x192.png' sizes='192x192' type='image/png' />
        <link rel='icon' href='/apple-touch-icon.png' sizes='180x180' type='image/png' />
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
