# Hunter Dashboard

This project is configured for static export and nginx-only runtime hosting.

## Development

```bash
npm install
npm run dev
```

## Build Static Output

```bash
npm run build
```

The static site is generated in `out/`.

## Local Static Preview

```bash
npm run start
```

This serves `out/` on `http://localhost:8080` using Python's static file server.

## Deploy With Nginx

1. Build on your CI/build host: `npm ci && npm run build`
2. Copy `out/` to your nginx host, for example `/var/www/hunter-dashboard/out`
3. Use `deploy/nginx.conf` as your server block template
4. Reload nginx: `sudo nginx -t && sudo systemctl reload nginx`

## Notes

- Node.js is only required at build time.
- At runtime, only nginx is required to serve static files.
- If ROS bridge is on a private network, you can proxy websocket traffic through nginx (sample block included in `deploy/nginx.conf`).
