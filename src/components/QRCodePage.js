'use client';

import React from 'react';
import Image from 'next/image';

const QRCodePage = () => {
  return (
    <div className='qrcode-container'>
      <div className='qrcode-content'>
        <Image src='/assets/logos/thb-qr-code.png' alt='https://thb.nabondance.me/' width={300} height={300} priority />
      </div>
    </div>
  );
};
export default QRCodePage;
