import React from 'react';
import Image from 'next/image';

const HowToPage = () => {
  return (
    <div className='how-to-page'>
      <h1>How to Use Trailhead Banner</h1>
      <section className='how-to-section'>
        <h2>Find Your Trailhead Username</h2>
        <ol>
          <li>Log in to Trailhead.</li>
          <li>
            Go to{' '}
            <a href='https://www.salesforce.com/trailblazer/profile' target='_blank' rel='noopener noreferrer'>
              your Trailhead profile
            </a>
            .
          </li>
          <li>Copy the username, it is the string displayed after the `salesforce.com/trailblazer/`.</li>
        </ol>
        <div className='responsive-image'>
          <Image
            src='/assets/how-to/how-to-username.png'
            alt='Trailhead Username'
            layout='responsive'
            width={625}
            height={300}
          />
        </div>
      </section>
      <section className='how-to-section'>
        <h2>How to Make Your Trailhead Profile Public</h2>
        <ol>
          <li>Log in to Trailhead.</li>
          <li>
            Go to{' '}
            <a href='https://www.salesforce.com/trailblazer/settings' target='_blank' rel='noopener noreferrer'>
              your Trailhead settings
            </a>
            .
          </li>
          <li>Under &rdquo;Your Profile Privacy&rdquo;, select &rdquo;Public&rdquo;.</li>
        </ol>
      </section>
      <section className='how-to-section'>
        <h2>Generating Your LinkedIn Banner</h2>
        <ol>
          <li>Enter your Trailhead username in the input field.</li>
          <li>Personalize it by clicking on &rdquo;More Options&rdquo;.</li>
          <li>Click on &rdquo;Generate Banner&rdquo;.</li>
          <li>Download your banner.</li>
        </ol>
      </section>
      <section className='how-to-section'>
        <h2>How to Personalize the Banner</h2>
        <ol>
          <li>Click on &rdquo;More Options&rdquo;.</li>
          <li>Try the options, dropdown usually unlock other options.</li>
          <li>Click on &rdquo;Generate Banner&rdquo;.</li>
        </ol>
      </section>
      <section className='how-to-section'>
        <h2>How to Use a Custom Background</h2>
        <ol>
          <li>Click on &rdquo;More Options&rdquo; in the banner generator form.</li>
          <li>Select &rdquo;Custom URL&rdquo; from the &rdquo;Background Kind&rdquo; dropdown.</li>
          <li>Enter the URL of the image you want to use as the background.</li>
          <li>Click on &rdquo;Generate Banner&rdquo; to see your banner with the custom background.</li>
        </ol>
      </section>
      <section className='how-to-section'>
        <h2>How to Modify Your Personal Banner on LinkedIn</h2>
        <ol>
          <li>Log in to your LinkedIn account.</li>
          <li>
            Go to{' '}
            <a href='https://www.linkedin.com/in/me/' target='_blank' rel='noopener noreferrer'>
              your LinkedIn profile
            </a>
            .
          </li>{' '}
          <li>Click on the pencil icon on the banner image.</li>
          <li>Click on &rdquo;Change photo&rdquo; and upload the new banner image you have generated.</li>
          <li>Click &rdquo;Save&rdquo;.</li>
        </ol>
      </section>
      <section className='how-to-section'>
        <h2>Common Issues and Solutions</h2>
        <ul>
          <li>If you encounter an error, try refreshing the page and trying again.</li>
          <li>Ensure your Trailhead username is correct and not an email address.</li>
          <li>If the problem persists, consider writing an issue on the GitHub repository.</li>
        </ul>
      </section>
      <section className='how-to-section'>
        <h2>Need Further Assistance?</h2>
        <p>
          If the issue persists, please create an issue on our GitHub repository:{' '}
          <a href='https://github.com/nabondance/Trailhead-Banner/issues/new' target='_blank' rel='noopener noreferrer'>
            Create an Issue
          </a>
        </p>
      </section>
    </div>
  );
};

export default HowToPage;
