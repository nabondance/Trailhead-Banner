'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { CountUp } from 'countup.js';
import { supabaseBrowser as supabase } from '../utils/supabaseBrowserClient';
import { fetchGenerationCount } from '../utils/generationCountUtils';
import { APP_ENV } from '../utils/envUtils';

// Backoff between retries when a count request fails; after the last one, the fallback count is shown
const RETRY_DELAYS_MS = [1000, 3000];

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
 * If the initial fetch keeps failing, the deploy-time `fallbackCount` is shown instead of 0
 * until the next broadcast brings the live count.
 *
 * @param {string} table - Table to count rows from ('banners', 'rewinds' or 'company_banners')
 * @param {string} elementId - Unique DOM id for the CountUp target span (must be unique per mounted instance)
 * @param {string} [className='banner-count'] - Wrapper class name
 * @param {string} [before='Already '] - Text rendered before the count
 * @param {string} after - Text rendered after the count
 * @param {number|null} [fallbackCount=null] - Count fetched at deploy time (see getGenerationCount)
 */
const GenerationCount = forwardRef(
  ({ table, elementId, className = 'banner-count', before = 'Already ', after, fallbackCount = null }, ref) => {
    const [count, setCount] = useState(0);
    const countUpRef = useRef(null);
    const latestUpdate = useRef(0);
    const retryTimer = useRef(null);
    const hasCount = useRef(false);

    // Returns false, without touching the display, when the value isn't a usable count
    const applyCount = (newCount) => {
      if (!Number.isFinite(newCount)) return false;
      // A valid count makes any pending retry unnecessary
      clearTimeout(retryTimer.current);
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
      hasCount.current = true;
      return true;
    };

    const fetchCount = async (attempt = 0) => {
      if (!supabase) return;
      clearTimeout(retryTimer.current);
      // Fetches and broadcasts can overlap: a response is dropped if a newer update arrived meanwhile
      const updateId = ++latestUpdate.current;
      const { count: newCount, error, status, retryable } = await fetchGenerationCount(supabase, table);
      if (updateId !== latestUpdate.current) return;
      if (applyCount(newCount)) return;

      console.error(`Error fetching ${table} count (attempt ${attempt + 1}, status ${status}):`, error);
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        retryTimer.current = setTimeout(() => fetchCount(attempt + 1), RETRY_DELAYS_MS[attempt]);
      } else if (!hasCount.current) {
        // Better than sticking at 0; the next broadcast brings the live count
        applyCount(fallbackCount);
      }
    };

    useEffect(() => {
      if (!supabase) return;

      fetchCount();

      const channel = supabase
        .channel(`generation-count:${table}:${APP_ENV}`, { config: { private: true } })
        .on('broadcast', { event: 'count' }, ({ payload }) => {
          // Only a valid count supersedes in-flight fetches; a malformed payload must not cancel them
          if (applyCount(payload?.count)) {
            latestUpdate.current++;
          } else {
            console.error(`Unexpected ${table} count broadcast:`, payload);
          }
        })
        .subscribe();

      // Catch up on anything missed while the tab was in the background
      const onVisibilityChange = () => {
        if (!document.hidden) fetchCount();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      // Retries give up after a few seconds: refetch when the connection comes back after a longer outage
      const onOnline = () => fetchCount();
      window.addEventListener('online', onOnline);

      return () => {
        // Marks in-flight responses as stale so they're dropped after unmount
        latestUpdate.current++;
        clearTimeout(retryTimer.current);
        supabase.removeChannel(channel);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('online', onOnline);
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
