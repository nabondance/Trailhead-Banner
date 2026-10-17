export const SITE_URL = 'https://thb.nabondance.me';

/**
 * Builds a schema.org BreadcrumbList for a first-level page (Home › page).
 * @param {string} name - Page name shown in search results
 * @param {string} path - Page path, e.g. '/how-to'
 */
export const breadcrumbJsonLd = (name, path) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Trailhead Banner', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name, item: `${SITE_URL}${path}` },
  ],
});

/**
 * Builds a schema.org FAQPage from question/answer pairs. Answers must match the visible page text.
 * @param {Array<{question: string, answer: string}>} faq
 */
export const faqJsonLd = (faq = []) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
});
