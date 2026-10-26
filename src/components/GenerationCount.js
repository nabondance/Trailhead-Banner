'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { CountUp } from 'countup.js';
import { supabaseBrowser as supabase } from '../utils/supabaseBrowserClient';

// Backoff between retries when the initial count request fails
const RETRY_DELAYS_MS = [1000, 3000, 10000];

/**
 * Reusable live generation counter backed by a Supabase table.
 *
 * Renders an animated count that ticks up in real time as new rows are inserted
 * into the given table. Used by the standard banner, rewind, and company banner
 * pages — each just passes the table it tracks and the wording to display.
 *
 * The browser never reads the analytics tables: the initial count comes from the
 * `generation_count` database function, and live updates arrive on the private
 * `generation-count:<table>:<env>` broadcast channel, which a database trigger
 * publishes to on each insert. Browsers can listen on that channel but not send.
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
    const latestUpdate = useRef(0);
    const retryTimer = useRef(null);
    const unmounted = useRef(false);

    const sourceEnv = process.env.NEXT_PUBLIC_VERCEL_ENV ? process.env.NEXT_PUBLIC_VERCEL_ENV : 'development';

    const applyCount = (newCount) => {
      if (!Number.isFinite(newCount)) {
        console.error(`Unexpected ${table} count:`, newCount);
        return;
      }
      if (countUpRef.current) {
        countUpRef.current.update(newCount);
      } else {
        countUpRef.current = new CountUp(elementId, newCount, {
          startVal: 0,
          duration: 4,
          useEasing: true,
          useGrouping: true,
          separator: ',',
        });
        countUpRef.current.start();
      }
      setCount(newCount);
    };

    const fetchCount = async (attempt = 0) => {
      if (!supabase) return;
      clearTimeout(retryTimer.current);
      // Fetches and broadcasts can overlap: a response is dropped if a newer update arrived meanwhile
      const updateId = ++latestUpdate.current;
      const { data, error } = await supabase.rpc('generation_count', {
        p_table: table,
        p_env: sourceEnv,
      });
      if (updateId !== latestUpdate.current || unmounted.current) return;

      if (error) {
        console.error(
          `Error fetching ${table} count (attempt ${attempt + 1}): ${error.message || error.code || error}`
        );
        // A single failed request would otherwise leave the counter at 0 until the next visibility change
        if (attempt < RETRY_DELAYS_MS.length) {
          retryTimer.current = setTimeout(() => fetchCount(attempt + 1), RETRY_DELAYS_MS[attempt]);
        }
      } else {
        applyCount(data);
      }
    };

    useEffect(() => {
      if (!supabase) return;
      // Reset for Strict Mode, which runs cleanup then the effect again on the same instance
      unmounted.current = false;

      fetchCount();

      const channel = supabase
        .channel(`generation-count:${table}:${sourceEnv}`, { config: { private: true } })
        .on('broadcast', { event: 'count' }, ({ payload }) => {
          latestUpdate.current++;
          applyCount(payload?.count);
        })
        .subscribe();

      // Catch up on anything missed while the tab was in the background
      const onVisibilityChange = () => {
        if (!document.hidden) fetchCount();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        unmounted.current = true;
        clearTimeout(retryTimer.current);
        supabase.removeChannel(channel);
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
