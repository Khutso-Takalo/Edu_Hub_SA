# nginx Demo Setup for Windows

This project runs locally on Vite at `http://127.0.0.1:8080`.

## What this does

The nginx config in [nginx/eduhub-demo.conf](../nginx/eduhub-demo.conf) reverse-proxies `http://localhost` to the local Vite dev server. That means:
- you keep running the app with `npm run dev`
- nginx becomes the public-facing local URL for the demo
- the app still behaves like a single-page app

## Windows setup

### 1) Start the app

Open PowerShell in the project folder and run:

```powershell
npm run dev
```

Leave that terminal open. Vite should listen on `127.0.0.1:8080`.

### 2) Install nginx on Windows

1. Download the Windows nginx ZIP from https://nginx.org/en/download.html
2. Extract it somewhere simple, for example `C:\nginx`
3. Confirm `C:\nginx\nginx.exe` exists

### 3) Apply the demo config

Copy [nginx/eduhub-demo.conf](../nginx/eduhub-demo.conf) into:

```text
C:\nginx\conf\eduhub-demo.conf
```

Then include it from `C:\nginx\conf\nginx.conf` inside the `http { ... }` block:

```nginx
include conf/eduhub-demo.conf;
```

### 4) Start or reload nginx

From PowerShell:

```powershell
cd C:\nginx
.\nginx.exe
```

To reload after editing config:

```powershell
cd C:\nginx
.\nginx.exe -s reload
```

To stop nginx:

```powershell
cd C:\nginx
.\nginx.exe -s quit
```

## Useful notes

- `listen 80;` means you can open `http://localhost` in the browser.
- If port 80 is busy on Windows, change it to `8081` and use `http://localhost:8081`.
- The config includes WebSocket headers so Vite dev features keep working.
- If Windows Firewall prompts for access, allow nginx on private networks for local demo use.

## Alternative: preview build through nginx

If you want to demo the production build instead of dev mode:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Then update nginx to proxy to `127.0.0.1:4173`.

## Quick check

Open `http://localhost` in your browser. If it does not load:
1. Confirm `npm run dev` is still running
2. Confirm `nginx.exe` is running
3. Confirm `C:\nginx\conf\nginx.conf` includes `eduhub-demo.conf`
4. Confirm port `80` is not blocked by another app
