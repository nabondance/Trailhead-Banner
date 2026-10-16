import Link from 'next/link';
import JsonLd from './JsonLd';
import faq from '../data/faq.json';
import { faqJsonLd } from '../utils/seoUtils';

// FAQ section of the How-To page; the same text feeds the FAQPage structured data
const HowToFaq = () => (
  <section id='faq' className='how-to-section'>
    <JsonLd data={faqJsonLd(faq)} />
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
);

export default HowToFaq;
