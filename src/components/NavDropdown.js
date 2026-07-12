'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

const NavDropdown = ({ label, options, defaultUrl, className = '' }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleOptionClick = (value) => {
    if (value.startsWith('http')) {
      window.open(value, '_blank', 'noopener,noreferrer');
    } else {
      router.push(value);
    }
    setIsOpen(false);
  };

  const handleMainClick = () => {
    // Toggle dropdown visibility
    setIsOpen(!isOpen);

    // Navigate to default URL if provided (for Generators)
    if (defaultUrl) {
      router.push(defaultUrl);
    }
  };

  return (
    <div
      className={`nav-dropdown ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className={`nav-dropdown-button ${!defaultUrl ? 'non-navigable' : ''}`} onClick={handleMainClick}>
        {label}
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}></span>
      </button>

      {isOpen && (
        <div className='nav-dropdown-content'>
          {options.map((option, index) => {
            const isExternal = option.value.startsWith('http');
            return (
              <button
                key={index}
                className='nav-dropdown-item'
                onClick={() => handleOptionClick(option.value)}
                aria-label={isExternal ? `${option.label} (opens in a new tab)` : undefined}
              >
                <span>{option.label}</span>
                {option.isNew && <span className='new-badge'>NEW</span>}
                {isExternal && <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='external-icon' />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NavDropdown;
