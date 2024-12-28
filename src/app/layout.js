import { Geist, Geist_Mono, Inter } from 'next/font/google';
import TrailheadBannerHeader from '../components/TrailheadBannerHeader';
import TrailheadBannerFooter from '../components/TrailheadBannerFooter';
import BackgroundWave from '../components/BackgroundWave';

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
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* <BackgroundWave /> */}
        <header className='header'>
          <TrailheadBannerHeader />
        </header>
        <main>{children}</main>
        <footer className='footer'>
          <TrailheadBannerFooter />
        </footer>
      </body>
    </html>
  );
}
