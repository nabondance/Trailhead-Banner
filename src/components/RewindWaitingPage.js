'use client';

import Link from 'next/link';

const RewindWaitingPage = () => {
  return (
    <div className='container'>
      <div className='rewind-header'>
        <h1>Trailhead Rewind</h1>
        <h2>Rewind isn't available yet, see you on December 1st!</h2>
        <p>Your year of achievements, in a snow globe you can shake and share ❄️</p>
        <p>In the meantime, keep learning and connecting with the Trailblazer community!</p>
        <p>
          You can still <Link href='/'>generate your banner</Link> 👈
        </p>
        <p>🫶</p>
      </div>
    </div>
  );
};

export default RewindWaitingPage;
