import React from 'react';

const LinkedInBannerTutorial = () => {
  return (
    <div className='tutorial'>
      <h2>How to Modify Your Personal Banner on LinkedIn</h2>
      <ol>
        <li>Log in to your LinkedIn account.</li>
        <li>
          Go to{' '}
          <a href='https://www.linkedin.com/in/me/' target='_blank' rel='noopener noreferrer'>
            your profile
          </a>
          .
        </li>{' '}
        <li>Click on the pencil icon on the banner image.</li>
        <li>Click on &quot;Change photo&quot; and upload the new banner image you have generated.</li>
        <li>Click &quot;Save&quot;.</li>
      </ol>
    </div>
  );
};

export default LinkedInBannerTutorial;
