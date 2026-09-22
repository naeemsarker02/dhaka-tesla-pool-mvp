import "./globals.css";

export const metadata = {
  title: "Dhaka Tesla Pool",
  description: "Ride-pooling MVP for the RoBenDevs assessment",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
