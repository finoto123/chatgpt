import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseOrigin = "";
try {
  supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
} catch {
  supabaseOrigin = "";
}
const supabaseWebSocketOrigin = supabaseOrigin.replace(/^http/, "ws");
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWebSocketOrigin}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ").replace(/\s+/g, " ").trim();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Layout de pedido (PDF/imagem) pode passar de 1MB. O bucket aceita
      // até 10 MiB; 1 MiB adicional acomoda o envelope multipart. A validação
      // do arquivo continua limitada centralmente a 10 MiB no servidor.
      bodySizeLimit: '11mb',
    },
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }];
  },
};

export default nextConfig;
