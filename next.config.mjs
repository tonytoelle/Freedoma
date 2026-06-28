/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true
  },
  // Allow the local network IP for HMR development origin checking
  allowedDevOrigins: ["localhost:3000", "172.20.10.12:3000", "172.20.10.12"]
};

export default nextConfig;
