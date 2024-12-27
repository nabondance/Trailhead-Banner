import React, { useState } from 'react';

const BannerForm = ({ onSubmit }) => {
  const [username, setUsername] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#f3f4f6');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [displaySuperbadges, setDisplaySuperbadges] = useState(true);
  const [includeExpiredCertifications, setIncludeExpiredCertifications] = useState(false); // New state
  const [textColor, setTextColor] = useState('#111827'); // Default text color
  const [isGenerating, setIsGenerating] = useState(false); // State to manage button visibility

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true); // Hide the button when clicked
    await onSubmit({
      username,
      backgroundColor,
      backgroundImageUrl,
      displaySuperbadges,
      textColor,
      includeExpiredCertifications,
    }); // Pass the new state
    setIsGenerating(false); // Show the button again when the banner is generated
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
        name='trailhead-username'
        autoComplete='off'
        data-lpignore='true' // LastPass specific attribute to ignore
        data-form-type='other'
      />
      <button type='button' className='button more-options-button' onClick={() => setShowOptions(!showOptions)}>
        {showOptions ? 'Hide Options' : 'More Options'}
      </button>
      {showOptions && (
        <div className='options'>
          <label>
            Background Color:
            <input type='color' value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
          </label>
          <label>
            Background Image (1584x396):
            <input
              type='text'
              value={backgroundImageUrl}
              onChange={(e) => setBackgroundImageUrl(e.target.value)}
              placeholder='Enter image URL'
              className='input-url'
              autoComplete='off'
              data-lpignore='true' // LastPass specific attribute to ignore
              data-form-type='other'
            />
          </label>
          <label>
            Text Color:
            <input type='color' value={textColor} onChange={(e) => setTextColor(e.target.value)} />
          </label>
          <label>
            Display Superbadges:
            <input
              type='checkbox'
              checked={displaySuperbadges}
              onChange={(e) => setDisplaySuperbadges(e.target.checked)}
            />
          </label>
          <label>
            Include Expired Certifications:
            <input
              type='checkbox'
              checked={includeExpiredCertifications}
              onChange={(e) => setIncludeExpiredCertifications(e.target.checked)}
            />
          </label>
        </div>
      )}
      {!isGenerating && (
        <button type='submit' className='button submit-button'>
          Generate Banner
        </button>
      )}
    </form>
  );
};

export default BannerForm;
