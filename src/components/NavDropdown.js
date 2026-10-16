'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

const NavDropdown = ({ label, options, defaultUrl, className = '' }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

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
      <button
        className={`nav-dropdown-button ${!defaultUrl ? 'non-navigable' : ''}`}
        onClick={handleMainClick}
        aria-expanded={isOpen}
      >
        {label}
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}></span>
      </button>

      {/* Always rendered (hidden when closed) so crawlers can follow the links */}
      <div className='nav-dropdown-content' hidden={!isOpen}>
        {options.map((option) => {
          const content = (
            <>
              <span>{option.label}</span>
              {option.isNew && <span className='new-badge'>NEW</span>}
            </>
          );
          return option.value.startsWith('http') ? (
            <a
              key={option.value}
              href={option.value}
              target='_blank'
              rel='noopener noreferrer'
              className='nav-dropdown-item'
              aria-label={`${option.label} (opens in a new tab)`}
              onClick={() => setIsOpen(false)}
            >
              {content}
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='external-icon' />
            </a>
          ) : (
            <Link key={option.value} href={option.value} className='nav-dropdown-item' onClick={() => setIsOpen(false)}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default NavDropdown;
