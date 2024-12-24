import { Geist, Geist_Mono } from 'next/font/google';
import Image from 'next/image';
import './globals.css';
import TrailheadBanner from './TrailheadBanner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
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
        <header className='header'>
          <TrailheadBanner />
        </header>
        <main>{children}</main>
        <footer className='footer'>
          <a href='https://github.com/nabondance' target='_blank' rel='noopener noreferrer' className='footer-link'>
            &copy; 2024 Trailhead-Banner By{' '}
            <Image src='/github-logo.svg' alt='GitHub' className='github-logo' width={20} height={20} /> /nabondance
          </a>
        </footer>
      </body>
    </html>
  );
}
