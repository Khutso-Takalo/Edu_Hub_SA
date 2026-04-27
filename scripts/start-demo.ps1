# PowerShell script to start Vite and nginx for local demo on Windows
# Launches Vite dev server and nginx reverse-proxy in parallel

# Ensure script runs from project root
defaultLocation = $PSScriptRoot
Set-Location $defaultLocation

# Start Vite dev server
Write-Host "Starting Vite dev server on port 8080..."
$vite = Start-Process -NoNewWindow -PassThru -FilePath "npx" -ArgumentList "vite"

# Start nginx (assumes nginx is installed in C:\nginx and config is nginx/eduhub-demo.conf)
$nginxPath = "C:\nginx"
$nginxExe = Join-Path $nginxPath "nginx.exe"
$nginxConf = Join-Path $defaultLocation "nginx/eduhub-demo.conf"

if (Test-Path $nginxExe) {
    Write-Host "Starting nginx reverse-proxy..."
    Start-Process -NoNewWindow -FilePath $nginxExe -ArgumentList "-c `"$nginxConf`""
    Write-Host "nginx started with config: $nginxConf"
} else {
    Write-Warning "nginx.exe not found at $nginxExe. Please install nginx for Windows and update the path if needed."
}

Write-Host "Demo environment started."
Write-Host "- Vite: http://localhost:8080/"
Write-Host "- nginx reverse-proxy: http://localhost/"
Write-Host "Press Ctrl+C to stop the Vite server. To stop nginx, run 'nginx -s stop' from the nginx directory."
