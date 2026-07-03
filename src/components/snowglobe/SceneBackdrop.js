'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { loadFont, makeBackdropTexture } from './textures';

/* Bakes the seeded branded backdrop into scene.background once its fonts
   (Dela Gothic One for the title/year, Anta for the watermark pill) load */
function SceneBackdrop({ username, rankTitle, year }) {
  const { scene } = useThree();
  useEffect(() => {
    let cancelled = false;
    let tex = null;
    Promise.all([
      loadFont('Dela Gothic One', '/assets/fonts/DelaGothicOne-Regular.ttf'),
      loadFont('Anta', '/assets/fonts/Anta-Regular.ttf'),
    ]).then(() => {
      if (cancelled) return;
      tex = makeBackdropTexture(username, rankTitle, year);
      scene.background = tex;
    });
    return () => {
      cancelled = true;
      scene.background = null;
      tex?.dispose();
    };
  }, [scene, username, rankTitle, year]);
  return null;
}

export { SceneBackdrop };
