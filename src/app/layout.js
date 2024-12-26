import { Geist, Geist_Mono, Mulish } from 'next/font/google';
import './globals.css';
import TrailheadBannerHeader from './TrailheadBannerHeader';
import TrailheadBannerFooter from './TrailheadBannerFooter';
import BackgroundWave from './BackgroundWave';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const MulishFont = Mulish({
  variable: '--font-mulish',
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
        <footer className={`footer`}>
          <TrailheadBannerFooter />
        </footer>
      </body>
    </html>
  );
}
