import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CountUp } from 'countup.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BannerCount = forwardRef((props, ref) => {
  const [count, setCount] = useState(0);
  const countUpRef = useRef(null);
  const initialLoad = useRef(true);

  const animateCount = (start, end) => {
    if (countUpRef.current) {
      countUpRef.current.update(end);
    } else {
      countUpRef.current = new CountUp('countup-element', end, {
        startVal: start,
        duration: 1,
      });
      countUpRef.current.start();
    }
  };

  const fetchCount = async () => {
    const { count: newCount, error } = await supabase
      .from('banners')
      .select('*', { count: 'exact', head: true })
      .eq('source_env', process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development');

    if (error) {
      console.error('Error fetching banner count:', error);
    } else {
      if (initialLoad.current) {
        animateCount(0, newCount);
        initialLoad.current = false;
      } else {
        animateCount(count, newCount);
      }
      setCount(newCount);
    }
  };

  useEffect(() => {
    // Fetch initial count
    fetchCount();

    // Subscribe to changes in the 'banners' table
    const subscription = supabase
      .channel('realtime:banners')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'banners',
          filter: `source_env=eq.${process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development'}`,
        },
        (payload) => {
          console.log('Change detected:', payload);
          fetchCount(); // Update the count when a change is detected
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    fetchCount,
  }));

  return (
    <div className='banner-count'>
      <p>Already <span id='countup-element'>{count}</span> banners generated!</p>
    </div>
  );
});

BannerCount.displayName = 'BannerCount';

export default BannerCount;