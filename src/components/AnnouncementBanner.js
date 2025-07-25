import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const getEnvironment = () => {
    return process.env.NEXT_PUBLIC_VERCEL_ENV ? process.env.NEXT_PUBLIC_VERCEL_ENV : 'development';
  };

  const fetchAnnouncement = async () => {
    try {
      const currentEnv = getEnvironment();

      // Fetch all active announcements for the current environment
      const { data, error } = await supabase
        .from('announcement')
        .select('*')
        .eq('is_active', true)
        .eq('environment', currentEnv)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        setAnnouncements([]);
      } else if (data) {
        setAnnouncements(data);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      setAnnouncements([]);
    }
  };

  useEffect(() => {
    // Fetch initial announcements
    fetchAnnouncement();

    // Subscribe to changes in the 'announcement' table
    const subscription = supabase
      .channel('realtime:announcement')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement',
        },
        () => {
          fetchAnnouncements(); // Update the announcements when a change is detected
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleDismiss = (announcementId) => {
    setDismissedIds((prev) => new Set([...prev, announcementId]));
  };

  const formatText = (text) => {
    if (!text) return '';

    // Handle line breaks
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      // Handle markdown-style links [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      for (const match of line.matchAll(linkRegex)) {
        // Add text before the link
        if (match.index > lastIndex) {
          parts.push(line.slice(lastIndex, match.index));
        }

        // Add the link
        parts.push(
          <a
            key={`${lineIndex}-${match.index}`}
            href={match[2]}
            target='_blank'
            rel='noopener noreferrer'
            className='announcement-link'
          >
            {match[1]}
          </a>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text after the last link
      if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
      }

      // If no links were found, just return the line
      if (parts.length === 0) {
        parts.push(line);
      }

      return (
        <span key={lineIndex}>
          {parts}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  const getTypeStyles = (type) => {
    const baseStyles = 'announcement-banner';

    switch (type) {
      case 'error':
        return `${baseStyles} announcement-error`;
      case 'warning':
        return `${baseStyles} announcement-warning`;
      case 'success':
        return `${baseStyles} announcement-success`;
      case 'info':
      default:
        return `${baseStyles} announcement-info`;
    }
  };

  if (!announcements.length) {
    return null;
  }

  // Filter out dismissed announcements
  const visibleAnnouncements = announcements.filter((announcement) => !dismissedIds.has(announcement.id));

  if (!visibleAnnouncements.length) {
    return null;
  }

  return (
    <div className='announcements-container'>
      {visibleAnnouncements.map((announcement) => (
        <div key={announcement.id} className={getTypeStyles(announcement.type)}>
          <div className='announcement-content'>
            <span className='announcement-text'>{formatText(announcement.text)}</span>
            <button
              className='announcement-dismiss'
              onClick={() => handleDismiss(announcement.id)}
              aria-label='Dismiss announcement'
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;
