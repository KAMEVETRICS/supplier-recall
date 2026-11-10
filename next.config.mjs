/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['@libsql/client', '@mysten-incubation/memwal'],
};
export default config;
