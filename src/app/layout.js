import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Trailhead Banner",
  description: "Generate your LinkedIn Banner with your Trailhead data",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="header">
          <h1>Trailhead Banner Generator</h1>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <p>&copy; 2024 Trailhead-Banner By nabondance</p>
        </footer>
      </body>
    </html>
  );
}