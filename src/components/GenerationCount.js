'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CountUp } from 'countup.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Null when env vars are missing (e.g. CI builds): this module is also evaluated during server prerender
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// How often to re-check the count while the tab is visible
const POLL_INTERVAL_MS = 30000;

/**
 * Reusable generation counter backed by a Supabase table.
 *
 * Renders an animated count that refreshes every POLL_INTERVAL_MS while the tab is visible.
 * Used by the standard banner, rewind, and company banner pages — each just passes the
 * table it tracks and the wording to display.
 *
 * The count comes from the `generation_count` database function, so the browser never
 * reads the analytics tables directly.
 *
 * @param {string} table - Table to count rows from ('banners', 'rewinds' or 'company_banners')
 * @param {string} elementId - Unique DOM id for the CountUp target span (must be unique per mounted instance)
 * @param {string} [className='banner-count'] - Wrapper class name
 * @param {string} [before='Already '] - Text rendered before the count
 * @param {string} after - Text rendered after the count
 */
const GenerationCount = forwardRef(
  ({ table, elementId, className = 'banner-count', before = 'Already ', after }, ref) => {
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
      if (!supabase) return;
      const { data, error } = await supabase.rpc('generation_count', {
        p_table: table,
        p_env: sourceEnv,
      });
      const newCount = Number(data) || 0;

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
      if (!supabase) return;

      fetchCount();

      // Poll while the tab is visible, and refresh as soon as it becomes visible again
      const interval = setInterval(() => {
        if (!document.hidden) fetchCount();
      }, POLL_INTERVAL_MS);
      const onVisibilityChange = () => {
        if (!document.hidden) fetchCount();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
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
