# Enjazy Cloud Deploy (Ubuntu + Nginx + HTTPS)

This is a direct production deployment guide.

## 1) Requirements
- Ubuntu 22.04 VPS
- Domain name pointed to your VPS public IP (A record)
- Open ports `80` and `443` in firewall/security group

## 2) Upload project to VPS
From your local machine:

```bash
scp -r "enjazy-release.zip" user@YOUR_SERVER_IP:/tmp/
```

On VPS:

```bash
sudo mkdir -p /opt/enjazy
sudo chown -R $USER:$USER /opt/enjazy
cd /opt/enjazy
unzip -o /tmp/enjazy-release.zip
```

## 3) Run one-command installer
Inside `/opt/enjazy`:

```bash
chmod +x deploy/install-ubuntu.sh
DOMAIN=portfolio.example.com APP_DIR=/opt/enjazy bash deploy/install-ubuntu.sh
```

Replace `portfolio.example.com` with your real domain.

## 4) Verify
```bash
sudo systemctl status enjazy --no-pager
curl -I https://portfolio.example.com/health
```

Expected: HTTP `200` and JSON contains `"status":"ok"`.

## 5) Update app later
```bash
cd /opt/enjazy
# upload/replace updated files
sudo systemctl restart enjazy
sudo nginx -t && sudo systemctl reload nginx
```

## 6) Logs
```bash
sudo journalctl -u enjazy -f
```
