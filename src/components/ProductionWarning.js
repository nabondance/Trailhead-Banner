import { APP_ENV } from '../utils/envUtils';
import { SITE_URL } from '../utils/seoUtils';

// Decided at build time, not from window.location after hydration: showing it late shifts the form (CLS)
const ProductionWarning = () => {
  if (APP_ENV === 'production') {
    return null;
  }

  return (
    <div className='warning-message'>
      <p>This version isn&apos;t released yet. Some features may not work as expected.</p>
      <p>
        Please visit the latest release:{' '}
        <a href={SITE_URL} target='_blank' rel='noopener noreferrer'>
          thb.nabondance.me
        </a>
      </p>
    </div>
  );
};

export default ProductionWarning;
