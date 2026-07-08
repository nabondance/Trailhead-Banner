'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CountUp } from 'countup.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Reusable live generation counter backed by a Supabase table.
 *
 * Renders an animated count that ticks up in real time as new rows are inserted
 * into the given table. Used by the standard banner, rewind, and company banner
 * pages — each just passes the table it tracks and the wording to display.
 *
 * @param {string} table - Supabase table to count rows from (e.g. 'banners', 'rewinds', 'company_banners')
 * @param {string} [envColumn='source_env'] - Column holding the source environment to filter on
 * @param {string} elementId - Unique DOM id for the CountUp target span (must be unique per mounted instance)
 * @param {string} [className='banner-count'] - Wrapper class name
 * @param {string} [before='Already '] - Text rendered before the count
 * @param {string} after - Text rendered after the count
 */
const GenerationCount = forwardRef(
  ({ table, envColumn = 'source_env', elementId, className = 'banner-count', before = 'Already ', after }, ref) => {
    const [count, setCount] = useState(0);
    const countUpRef = useRef(null);
    const initialLoad = useRef(true);

    const sourceEnv = process.env.NEXT_PUBLIC_VERCEL_ENV ? process.env.NEXT_PUBLIC_VERCEL_ENV : 'development';

    const animateCount = (start, end) => {
      if (countUpRef.current) {
        countUpRef.current.update(end);
      } else {
        countUpRef.current = new CountUp(elementId, end, {
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
        .from(table)
        .select('id', { count: 'estimated', head: true })
        .eq(envColumn, sourceEnv);

      if (error) {
        console.error(`Error fetching ${table} count:`, error);
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

      // Subscribe to changes in the table so the count updates live
      const subscription = supabase
        .channel(`realtime:${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `${envColumn}=eq.${sourceEnv}`,
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      fetchCount,
    }));

    return (
      <div className={className}>
        <p>
          {before}
          <span id={elementId}>{count}</span>
          {after}
        </p>
      </div>
    );
  }
);

GenerationCount.displayName = 'GenerationCount';

export default GenerationCount;
