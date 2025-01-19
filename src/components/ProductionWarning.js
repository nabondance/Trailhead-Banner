import React, { useEffect, useState } from 'react';

const ProductionWarning = () => {
  const [isProduction, setIsProduction] = useState(true);

  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname !== 'thb.nabondance.me') {
      setIsProduction(false);
    }
  }, []);

  if (isProduction) {
    return null;
  }

  return (
    <div className='warning-message'>
      <p>You are not on the production website. Some features may not work as expected.</p>
      <p>
        Please visit the production site:{" "}
        <a href='https://thb.nabondance.me' target='_blank' rel='noopener noreferrer'>
          thb.nabondance.me
        </a>
      </p>
    </div>
  );
};

export default ProductionWarning;
