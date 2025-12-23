'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
          {options.map((option, index) => (
            <button key={index} className='nav-dropdown-item' onClick={() => handleOptionClick(option.value)}>
              <span>{option.label}</span>
              {option.isNew && <span className='new-badge'>NEW</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NavDropdown;
