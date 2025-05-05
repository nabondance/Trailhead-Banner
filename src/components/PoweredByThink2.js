import React from 'react';
import Image from 'next/image';

const PoweredByThink2 = () => {
  return (
    <div className='think2-container' onClick={() => window.open('https://think2.ai', '_blank')}>
      <div className='think2-background'>
        <Image
          src='/assets/logos/think2-urls-5-large.svg'
          alt='Think2 Background Pattern'
          fill
          priority
          className='think2-pattern'
        />
      </div>
      <div className='think2-content'>
        <p className='think2-description'>
          Powered by <span className='think2-highlight'>Think2</span>
        </p>
      </div>
    </div>
  );
};

export default PoweredByThink2;
