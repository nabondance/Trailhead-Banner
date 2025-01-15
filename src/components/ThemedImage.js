'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';

function ThemedImage({ basePath, alt, className, width, height }) {
  const { resolvedTheme } = useTheme();
  const themeSuffix = resolvedTheme === 'dark' ? '-dark' : '-light';
  const src = `${basePath}${themeSuffix}.svg`;

  return <Image alt={alt} src={src} className={className} width={width} height={height} />;
}

export default ThemedImage;