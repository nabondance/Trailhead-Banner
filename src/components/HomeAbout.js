import Link from 'next/link';
import JsonLd from './JsonLd';
import faq from '../data/homeFaq.json';
import { faqJsonLd } from '../utils/seoUtils';

// Server-rendered explainer + FAQ below the generator, so search engines and AI assistants
// can read what the tool does without running the form.
const HomeAbout = () => (
  <div className='how-to-page home-about'>
    <JsonLd data={faqJsonLd(faq)} />
    <section className='how-to-section'>
      <h2>Free LinkedIn Banner Generator for Salesforce Trailblazers</h2>
      <p>
        Trailhead Banner turns your public Trailhead profile into a 1584 × 396 px LinkedIn banner. Enter your Trailhead
        username and it pulls your rank, badge, superbadge and certification counts, certification and superbadge logos,
        Agentblazer rank and MVP status, then draws them on one of 33 backgrounds or your own image. It is free, open
        source and needs no account.
      </p>
      <p>
        New here? Read the <Link href='/how-to'>step-by-step guide</Link> or browse{' '}
        <Link href='/examples'>example banners</Link>.
      </p>
    </section>
    <section className='how-to-section'>
      <h2>Frequently Asked Questions</h2>
      {faq.map(({ question, answer, link }) => (
        <div key={question} className='faq-item'>
          <h3>{question}</h3>
          <p>
            {answer}
            {link && (
              <>
                {' '}
                {link.href.startsWith('http') ? (
                  <a href={link.href} target='_blank' rel='noopener noreferrer'>
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href}>{link.label}</Link>
                )}
              </>
            )}
          </p>
        </div>
      ))}
    </section>
  </div>
);

export default HomeAbout;
