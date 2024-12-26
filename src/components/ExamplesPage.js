import React from 'react';
import Image from 'next/image';
import '../styles/globals.css';

const ExamplesPage = () => {
  return (
    <div className='examples-container'>
      <h1>Examples</h1>
      <h2>Check out some examples of LinkedIn banners generated with Trailhead-Banner</h2>
      <div className='example'>
        <Image src='/assets/examples/example1.png' alt='Example 1' width={600} height={400} />
        <p>Default Banner Generated</p>
      </div>
      <div className='example'>
        <Image src='/assets/examples/example2.png' alt='Example 2' width={600} height={400} />
        <p>Banner with custom background and text color</p>
      </div>
      <div className='example'>
        <Image src='/assets/examples/example3.png' alt='Example 3' width={600} height={400} />
        <p>Banner with custom background image from the library</p>
      </div>
      <div className='example'>
        <Image src='/assets/examples/example4.png' alt='Example 4' width={600} height={400} />
        <p>Banner without superbadges displayed</p>
      </div>
      <div className='example'>
        <Image src='/assets/examples/example5.png' alt='Example 5' width={600} height={400} />
        <p>Banner with custom background image from the internet</p>
      </div>
    </div>
  );
};

export default ExamplesPage;