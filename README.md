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

## Run With Nginx (Single Machine)

1. Build:
```bash
npm ci
npm run build
```
2. Copy site files:
```bash
sudo mkdir -p /var/www/hunter-dashboard
sudo rsync -a --delete out/ /var/www/hunter-dashboard/out/
```
3. Install nginx config:
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/hunter-dashboard.conf
sudo ln -sf /etc/nginx/sites-available/hunter-dashboard.conf /etc/nginx/sites-enabled/hunter-dashboard.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Build Elsewhere, Serve Only Nginx On Runtime Host

Use GitHub Actions workflow: `.github/workflows/build-nginx-static.yml`

- It runs `npm ci`, `npm run lint`, `npm run build`
- It publishes artifact `hunter-dashboard-nginx`
- The artifact contains:
  - `out/`
  - `deploy/nginx.conf`
  - `package-name.txt`

### Runtime Host Deploy (No Node Needed)

1. Download the latest artifact tarball on your runtime host (from GitHub Actions UI or GitHub CLI).
2. Extract and sync:
```bash
tar -xzf hunter-dashboard-nginx-<sha>.tar.gz
sudo mkdir -p /var/www/hunter-dashboard
sudo rsync -a --delete out/ /var/www/hunter-dashboard/out/
```
3. Install nginx config and reload:
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/hunter-dashboard.conf
sudo ln -sf /etc/nginx/sites-available/hunter-dashboard.conf /etc/nginx/sites-enabled/hunter-dashboard.conf
sudo nginx -t
sudo systemctl reload nginx
```

## GitHub CLI Pull Example

```bash
# On a machine with GitHub CLI authenticated:
RUN_ID="$(gh run list --workflow build-nginx-static.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run download "$RUN_ID" --name hunter-dashboard-nginx
```

## Notes

- Node.js is only required at build time.
- At runtime, only nginx is required to serve static files.
- If ROS bridge is on a private network, you can proxy websocket traffic through nginx (sample block included in `deploy/nginx.conf`).
