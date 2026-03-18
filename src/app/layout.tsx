import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WANIA EMS · Ladeparksteuerung",
  description: "Energiemanagementsystem für Elektrikerbetriebe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* Restore theme before first paint — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html:
          `(function(){var t=localStorage.getItem('ems-theme');` +
          `if(t==='light')document.documentElement.setAttribute('data-theme','light');})();`
        }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
