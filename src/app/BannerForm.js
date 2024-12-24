import React, { useState } from 'react';
import Image from 'next/image';
import LinkedInBannerTutorial from './LinkedInBannerTutorial';
const BannerForm = ({ onSubmit }) => {
    const [username, setUsername] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const [backgroundColor, setBackgroundColor] = useState('#f3f4f6');
    const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
    const [displaySuperbadges, setDisplaySuperbadges] = useState(true);

    const handleSubmit = (e) => {
      e.preventDefault();
      onSubmit({ username, backgroundColor, backgroundImageUrl, displaySuperbadges });
    };

    return (
      <form onSubmit={handleSubmit} className='form'>
        <input
          type='text'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder='Enter Trailhead username'
          required
          className='input'
        />
        <button type='button' className='button' onClick={() => setShowOptions(!showOptions)}>
          More Options
        </button>
        {showOptions && (
          <div className='options'>
            <label>
              Background Color:
              <input
                type='color'
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
            </label>
            <label>
              Background Image URL:
              <input
                type='text'
                value={backgroundImageUrl}
                onChange={(e) => setBackgroundImageUrl(e.target.value)}
                placeholder='Enter image URL'
              />
            </label>
            <label>
              Display Superbadges:
              <input
                type='checkbox'
                checked={displaySuperbadges}
                onChange={(e) => setDisplaySuperbadges(e.target.checked)}
              />
            </label>
          </div>
        )}
        <button type='submit' className='button'>
          Generate Banner
        </button>
      </form>
    );
  };

  export default BannerForm;