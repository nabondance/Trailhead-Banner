import Sponsors from '../../components/Sponsors';

export const metadata = {
  title: 'Sponsors',
  description:
    'Trailhead Banner is free and open source. Meet the sponsors and supporters who help keep the project running.',
  alternates: { canonical: 'https://thb.nabondance.me/sponsors' },
  openGraph: {
    title: 'Sponsors',
    description:
      'Trailhead Banner is free and open source. Meet the sponsors and supporters who help keep the project running.',
    url: 'https://thb.nabondance.me/sponsors',
    siteName: 'Trailhead Banner',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Trailhead Banner – LinkedIn Banner for Salesforce Trailblazers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sponsors',
    description:
      'Trailhead Banner is free and open source. Meet the sponsors and supporters who help keep the project running.',
    images: ['/og-image.png'],
  },
};

export default function SponsorsPage() {
  return (
    <div className='container'>
      <Sponsors />
      <div className='sponsors-cta'>
        <p>Love Trailhead Banner? Put your name on it.</p>
        <a
          href='https://github.com/sponsors/nabondance'
          target='_blank'
          rel='noopener noreferrer'
          className='sponsors-cta-button'
        >
          Become a sponsor
        </a>
      </div>
    </div>
  );
}
