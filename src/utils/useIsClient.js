import { useSyncExternalStore } from 'react';

const subscribeNothing = () => () => {};

// false during server render and hydration, true afterwards, without a setState-in-effect re-render
export const useIsClient = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  );
