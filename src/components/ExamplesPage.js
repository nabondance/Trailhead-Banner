import React from 'react';

const ExamplesPage = () => {
  return (
    <div className='examples-container'>
      <h1>Examples</h1>
      <div className='example'>
        <img src='/path/to/example1.png' alt='Example 1' />
        <p>Description for Example 1</p>
      </div>
      <div className='example'>
        <img src='/path/to/example2.png' alt='Example 2' />
        <p>Description for Example 2</p>
      </div>
      {/* Add more examples as needed */}
    </div>
  );
};

export default ExamplesPage;
