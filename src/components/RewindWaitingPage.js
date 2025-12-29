'use client';

import Link from 'next/link';
import '../styles/globals.css';

const RewindWaitingPage = () => {
  return (
    <div className='container'>
      <div className='rewind-header'>
        <h1>Trailhead Rewind</h1>
        <h2>Rewind isn't available yet, see you in December !</h2>
        <p>In the meantime, keep learning and connecting with the Trailblazer community !</p>
        <p>
          You can still generate your banner 👉 <Link href='https://thb.nabondance.me'>here</Link>
        </p>
        <p>🫶</p>
      </div>
    </div>
  );
};

export default RewindWaitingPage;
