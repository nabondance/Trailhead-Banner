import CompanyBannerForm from '../../components/CompanyBannerForm';
import GenerationCount from '../../components/GenerationCount';

export const metadata = {
  title: 'Company Banner Generator – Trailhead Banner',
  description:
    "Generate a LinkedIn banner showcasing your team's collective Salesforce certifications, badges, and Agentblazer achievements.",
  alternates: { canonical: 'https://thb.nabondance.me/company' },
  openGraph: {
    title: 'Company Banner Generator – Trailhead Banner',
    description:
      "Generate a LinkedIn banner showcasing your team's collective Salesforce certifications, badges, and Agentblazer achievements.",
    url: 'https://thb.nabondance.me/company',
    siteName: 'Trailhead Banner',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Trailhead Banner – Company Banner Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Company Banner Generator – Trailhead Banner',
    description:
      "Generate a LinkedIn banner showcasing your team's collective Salesforce certifications, badges, and Agentblazer achievements.",
    images: ['/og-image.png'],
  },
};

export default function CompanyPage() {
  return (
    <div className='container'>
      <div className='main-content'>
        <h2>Company Banner Generator</h2>
        <p>For teams and companies : combine multiple Trailhead profiles into a single banner.</p>
        <GenerationCount
          table='company_banners'
          envColumn='thb_source_env'
          elementId='company-countup-element'
          after=' amazing company banners generated and still counting !'
        />
        <CompanyBannerForm />
      </div>
    </div>
  );
}
