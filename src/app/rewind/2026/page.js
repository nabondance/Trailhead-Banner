import { permanentRedirect } from 'next/navigation';

// /rewind/2026 alone has no globe to show: the form lives on /rewind
export default function Rewind2026() {
  permanentRedirect('/rewind');
}
