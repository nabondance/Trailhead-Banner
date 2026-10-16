import QRCodePage from '@/components/QRCodePage';

export const metadata = {
  title: 'Trailhead Banner - QR Code',
  description: 'Scan this QR code to access the Trailhead Banner generator',
  alternates: { canonical: 'https://thb.nabondance.me/qrcode' },
  robots: { index: false, follow: true },
};

export default function QRCode() {
  return <QRCodePage />;
}
