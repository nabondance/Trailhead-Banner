import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CountUp } from 'countup.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RewindCount = forwardRef((props, ref) => {
  const [count, setCount] = useState(0);
  const countUpRef = useRef(null);
  const initialLoad = useRef(true);

  const animateCount = (start, end) => {
    if (countUpRef.current) {
      countUpRef.current.update(end);
    } else {
      countUpRef.current = new CountUp('rewind-countup-element', end, {
        startVal: start,
        duration: 4,
        useEasing: true,
        useGrouping: true,
        separator: ',',
      });
      countUpRef.current.start();
    }
  };

  const fetchCount = async () => {
    const { count: newCount, error } = await supabase
      .from('rewinds')
      .select('id', { count: 'estimated', head: true })
      .eq('source_env', process.env.NEXT_PUBLIC_VERCEL_ENV ? process.env.NEXT_PUBLIC_VERCEL_ENV : 'development');

    if (error) {
      console.error('Error fetching rewind count:', error);
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

    // Subscribe to changes in the 'rewinds' table
    const subscription = supabase
      .channel('realtime:rewinds')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewinds',
          filter: `source_env=eq.${process.env.NEXT_PUBLIC_VERCEL_ENV ? process.env.NEXT_PUBLIC_VERCEL_ENV : 'development'}`,
        },
        () => {
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
    <div className='rewind-count'>
      <p>
        Already <span id='rewind-countup-element'>{count}</span> rewinds generated, create yours now !
      </p>
    </div>
  );
});

RewindCount.displayName = 'RewindCount';

export default RewindCount;
