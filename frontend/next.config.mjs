const isDev = process.env.NODE_ENV === 'development'

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Two worlds, same code:
    //  - Dev: `npm run dev` here (port 3000); the rewrite proxies every
    //    /api call to the Express backend on 5003, so fetch('/api/...')
    //    is same-origin and needs no CORS.
    //  - Build: output 'export' emits static HTML/JS to frontend/out,
    //    which gets copied into the backend's public/ folder and served
    //    by Express — one server, one origin, no CORS in production either.
    // (rewrites are unsupported under output:'export', hence the split.)
    ...(isDev
        ? {
            async rewrites() {
                return [
                    {
                        source: '/api/:path*',
                        destination: 'http://localhost:5003/api/:path*'
                    }
                ]
            }
        }
        : {
            output: 'export'
        }),

    // next/image optimization needs a server; a static export has none
    images: { unoptimized: true }
}

export default nextConfig
