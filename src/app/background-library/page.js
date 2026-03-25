import BackgroundLibraryPage from '../../components/BackgroundLibraryPage';

export const metadata = {
  title: 'Background Library – Trailhead Banner',
  description: 'Choose from a library of Salesforce and Trailhead themed backgrounds for your LinkedIn banner.',
  alternates: { canonical: 'https://thb.nabondance.me/background-library' },
  openGraph: {
    title: 'Background Library – Trailhead Banner',
    description: 'Choose from a library of Salesforce and Trailhead themed backgrounds for your LinkedIn banner.',
    url: 'https://thb.nabondance.me/background-library',
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
    title: 'Background Library – Trailhead Banner',
    description: 'Choose from a library of Salesforce and Trailhead themed backgrounds for your LinkedIn banner.',
    images: ['/og-image.png'],
  },
};

export default function BackgroundLibrary() {
  return <BackgroundLibraryPage />;
}
