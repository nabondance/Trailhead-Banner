import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BannerCount = forwardRef((props, ref) => {
  const [count, setCount] = useState(null);

  const fetchCount = async () => {
    const { count, error } = await supabase
      .from('banners')
      .select('*', { count: 'exact', head: true })
      .eq('source_env', process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development');

    if (error) {
      console.error('Error fetching banner count:', error);
    } else {
      setCount(count);
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
          filter: `source_env=eq.${process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development'}`, // Filter changes based on `source_env`
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
      {count !== null ? (
        <p>Already {count} banners generated!</p>
      ) : (
        <p>Counting generated banners...</p>
      )}
    </div>
  );
});

BannerCount.displayName = 'BannerCount';

export default BannerCount;