#!/usr/bin/env bash
set -euo pipefail

# Usage:
# DOMAIN=portfolio.example.com APP_DIR=/opt/enjazy bash deploy/install-ubuntu.sh

DOMAIN="${DOMAIN:-}"
APP_DIR="${APP_DIR:-/opt/enjazy}"
APP_USER="${APP_USER:-www-data}"
PORT="${PORT:-8000}"

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: DOMAIN is required. Example:"
  echo "DOMAIN=portfolio.example.com bash deploy/install-ubuntu.sh"
  exit 1
fi

echo "[1/7] Installing system packages..."
sudo apt update
sudo apt install -y nginx python3 python3-venv python3-pip certbot python3-certbot-nginx unzip

echo "[2/7] Creating app directory..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"

echo "[3/7] Preparing python environment..."
cd "$APP_DIR"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
deactivate

echo "[4/7] Installing systemd service..."
sudo tee /etc/systemd/system/enjazy.service >/dev/null <<EOF
[Unit]
Description=Enjazy Portfolio App
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
ExecStart=$APP_DIR/.venv/bin/python $APP_DIR/app.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "[5/7] Installing nginx site..."
sudo tee /etc/nginx/sites-available/enjazy >/dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 30M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/enjazy /etc/nginx/sites-enabled/enjazy
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "[6/7] Starting app service..."
sudo systemctl daemon-reload
sudo systemctl enable enjazy
sudo systemctl restart enjazy

echo "[7/7] Issuing SSL certificate..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect

echo "Done."
echo "Check status:"
echo "  sudo systemctl status enjazy --no-pager"
echo "  curl -I https://$DOMAIN/health"
