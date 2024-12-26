import React from 'react';
import '../styles/globals.css';

const BackgroundLibraryPage = () => {
  return (
    <div className='background-library-container'>
      <h1>Background Library</h1>
      <p>Choose from a variety of backgrounds for your LinkedIn banner</p>
      <div className='background-library'>
        <img src='/path/to/example1.png' alt='Example 1' />
        <p>Description for Example 1</p>
      </div>
      <div className='background-library'>
        <img src='/path/to/example2.png' alt='Example 2' />
        <p>Description for Example 2</p>
      </div>
      {/* Add more examples as needed */}
    </div>
  );
};

export default BackgroundLibraryPage;
