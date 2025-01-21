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
    fetchCount();
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