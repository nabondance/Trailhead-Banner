'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSliders, faChevronDown } from '@fortawesome/free-solid-svg-icons';

// Disclosure toggle for the banner forms' customization panel (expands in place, so outlined rather than filled)
const OptionsToggle = ({ expanded, onToggle, controlsId }) => (
  <button
    type='button'
    className='options-toggle'
    onClick={onToggle}
    aria-expanded={expanded}
    aria-controls={expanded ? controlsId : undefined}
  >
    <FontAwesomeIcon icon={faSliders} className='fa-fw' aria-hidden='true' />
    <span>Customize your banner</span>
    <FontAwesomeIcon icon={faChevronDown} className='fa-fw options-toggle-chevron' aria-hidden='true' />
  </button>
);

export default OptionsToggle;
