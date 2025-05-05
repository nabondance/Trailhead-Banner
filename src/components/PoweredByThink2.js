import React from 'react';
import Image from 'next/image';

const PoweredByThink2 = () => {
  return (
    <div className='think2-container' onClick={() => window.open('https://think2.ai', '_blank')}>
      <div className='think2-logo-container'>
        <Image
          src='/assets/logos/style_urls.svg'
          //   src='/assets/logos/wallpaper-patterns.svg'
          alt='Think2 Logo'
          width={700}
          height={550}
          priority
          className='think2-logo'
        />
      </div>
      <p className='think2-description'>
        Infrastructure costs graciously handled by <span className='think2-highlight'>Think2</span>
      </p>
    </div>
  );
};

export default PoweredByThink2;
