import "./globals.css";

export const metadata = {
  title: "Freedoma",
  description: "Minimalist iOS-style Color Grading Project & Billing Manager",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Freedoma",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="h-full bg-black text-white selection:bg-brand-green selection:text-black">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <script dangerouslySetInnerHTML={{__html: `
          document.addEventListener('gesturestart', function (e) {
            e.preventDefault();
          });
        `}} />
      </head>
      <body className="h-full bg-black text-white antialiased flex flex-col items-center justify-center p-0 m-0">
        <div className="w-full max-w-md h-full min-h-screen bg-black flex flex-col relative overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}

