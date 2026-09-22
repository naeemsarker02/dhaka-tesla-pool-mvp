import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Dhaka Tesla Pool",
  description: "Ride-pooling MVP for the RoBenDevs assessment",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
