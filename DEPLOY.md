# Deploy guide

This project can be deployed on a single Ubuntu VPS with Docker Compose and Caddy.

## What you need

- A VPS with a public IP
- A domain name you control
- SSH access to the server
- This repository on GitHub or available locally on your machine

## Architecture

- `app` runs the Node.js + React + SQLite application
- `caddy` is a reverse proxy in front of `app`
- Caddy automatically issues and renews HTTPS certificates for your domain

## 1. Point your domain to the server

In your domain provider DNS panel:

- Create an `A` record for `@` pointing to your server IPv4
- Create an `A` record for `www` pointing to your server IPv4

If your provider supports IPv6 and your server has one, add `AAAA` records too.

Wait until DNS propagates.

## 2. Connect to the server

```bash
ssh root@YOUR_SERVER_IP
```

If you use a non-root user:

```bash
ssh YOUR_USER@YOUR_SERVER_IP
```

## 3. Install Docker Engine and Compose plugin on Ubuntu

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
sudo systemctl enable --now docker
```

Optional: allow running Docker without `sudo`:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 4. Open ports 80 and 443

If you use UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

## 5. Upload the project to the server

### Option A: via GitHub

```bash
cd /opt
sudo git clone YOUR_REPO_URL site-ege
sudo chown -R $USER:$USER /opt/site-ege
cd /opt/site-ege
```

### Option B: from your local machine with `scp`

Run this on your local machine:

```bash
scp -r /path/to/project YOUR_USER@YOUR_SERVER_IP:/opt/site-ege
```

Then on the server:

```bash
cd /opt/site-ege
```

## 6. Configure the domain for Caddy

Create the root `.env` file:

```bash
cp .env.example .env
nano .env
```

Put your real domain there:

```bash
DOMAIN=example.com
```

If you want `www.example.com`, use that domain in `Caddyfile` or add another site block later.

## 7. Start the project

```bash
docker compose --profile prod up -d --build
```

Check status:

```bash
docker compose --profile prod ps
docker compose --profile prod logs app --tail=100
docker compose --profile prod logs caddy --tail=100
```

## 8. Verify the release

Open in your browser:

- `https://example.com`

Or from the server:

```bash
curl -I http://localhost:3000
curl -I https://example.com
```

Expected:

- `localhost:3000` should answer from the app container
- `https://example.com` should answer through Caddy with HTTPS

## 9. How to release updates

If you deployed via Git:

```bash
cd /opt/site-ege
git pull
docker compose --profile prod up -d --build
docker compose --profile prod ps
docker compose --profile prod logs app --tail=50
```

If you deployed via `scp`, copy the updated files again and rerun:

```bash
docker compose --profile prod up -d --build
```

## 10. Useful commands

See running containers:

```bash
docker compose --profile prod ps
```

Follow logs:

```bash
docker compose --profile prod logs -f app
docker compose --profile prod logs -f caddy
```

Restart:

```bash
docker compose --profile prod restart
```

Stop:

```bash
docker compose --profile prod down
```

## 11. Common problems

### Domain opens by IP but not by name

- DNS record still not propagated
- Domain points to the wrong server IP

### HTTPS certificate is not issued

- Port `80` or `443` is closed
- Domain does not point to this server yet
- Another process already occupies ports `80` or `443`

Check:

```bash
sudo ss -tulpn | grep -E ':80|:443'
docker compose --profile prod logs caddy --tail=200
```

### Container started, but site returns 502

This usually means Caddy is up but app is not reachable.

Check:

```bash
docker compose --profile prod logs app --tail=200
docker compose --profile prod ps
curl -I http://localhost:3000
```

## 12. Notes

- SQLite data is stored in the Docker volume `oge_sqlite_data`
- Caddy certificate data is stored in `caddy_data`
- The app port is bound only to `127.0.0.1:3000`, so it is not exposed publicly
