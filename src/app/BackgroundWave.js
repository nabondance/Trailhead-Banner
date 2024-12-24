import React from 'react';
import './BackgroundWave.css'; // Import the CSS styles for the waves

const BackgroundWave = () => {
  return (
    <div className='waveWrapper waveAnimation'>
      <div className='waveWrapperInner bgTop'>
        <div
          className='wave waveTop'
          style={{
            backgroundImage: "url('/assets/background_wave-top.png')", // Adjust the path if necessary
          }}
        ></div>
      </div>
      <div className='waveWrapperInner bgMiddle'>
        <div
          className='wave waveMiddle'
          style={{
            backgroundImage: "url('/assets/background_wave-mid.png')",
          }}
        ></div>
      </div>
      <div className='waveWrapperInner bgBottom'>
        <div
          className='wave waveBottom'
          style={{
            backgroundImage: "url('/assets/background_wave-bot.png')",
          }}
        ></div>
      </div>
    </div>
  );
};

export default BackgroundWave;