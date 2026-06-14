# Server Setup — LevelUp on petersyoo.com

Everything you need to run on the server once, in order.
Assumes Ubuntu 22.04 and that `petersyoo.com` DNS already points to this machine's IP.

---

## 1 — Install Docker

```bash
# Add Docker's official apt repo
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let your user run docker without sudo
sudo usermod -aG docker $USER

# Apply the group change — log out and back in, OR run:
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 2 — Install nginx + certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 3 — Clone the repo

If the repo is **public**:
```bash
git clone https://github.com/<your-username>/gamify.git ~/gamify
```

If the repo is **private**, set up an SSH deploy key first:
```bash
# On the server — generate a key (no passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -C "deploy@petersyoo.com"
cat ~/.ssh/github_deploy.pub
# Copy that output → GitHub repo → Settings → Deploy keys → Add deploy key (read-only)

# Tell SSH to use it for GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF

git clone git@github.com:<your-username>/gamify.git ~/gamify
```

---

## 4 — Create the root .env file

This is the file docker compose reads automatically for variable substitution.

```bash
cat > ~/gamify/.env << 'EOF'
MONGODB_URI=<your MongoDB Atlas connection string from apps/api/.env>
API_KEY=<your API key from apps/api/.env>
EOF

chmod 600 ~/gamify/.env
```

> Copy the values from your local `apps/api/.env` — do not commit that file.

---

## 5 — Configure nginx

```bash
# Copy the config from the repo
sudo cp ~/gamify/apps/nginx.conf /etc/nginx/sites-available/petersyoo.com

# Enable it and remove the default placeholder
sudo ln -sf /etc/nginx/sites-available/petersyoo.com /etc/nginx/sites-enabled/petersyoo.com
sudo rm -f /etc/nginx/sites-enabled/default

# Test the config, then reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6 — Get SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d petersyoo.com -d www.petersyoo.com
```

certbot will:
- Obtain a certificate automatically
- Edit your nginx config to add the HTTPS server block and the HTTP→HTTPS redirect
- Set up auto-renewal via a systemd timer (verify with `sudo certbot renew --dry-run`)

---

## 7 — First launch

```bash
cd ~/gamify
docker compose up --build -d
```

The first build takes a few minutes (downloading base images, compiling TypeScript, running `next build`).

Check everything is running:
```bash
docker compose ps
docker compose logs -f          # stream logs from both containers
```

Hit the health check:
```bash
curl http://localhost:4000/health
```

Hit the date-debug endpoint to confirm timezone is correct:
```bash
curl -H "x-api-key: <your-api-key>" http://localhost:4000/api/v1/admin/date-debug
```

Open `https://petersyoo.com` in a browser — you should see the app.

---

## 8 — Set up the auto-redeploy webhook

### 8a — Create the webhook secret

Pick any long random string for the shared secret:
```bash
openssl rand -hex 32
# example output: a3f9c2e1b4d7...  ← copy this, you'll use it in two places
```

### 8b — Create the env file for the webhook service

```bash
sudo tee /etc/levelup-webhook.env << 'EOF'
WEBHOOK_SECRET=<the random string from above>
REPO_DIR=/home/ubuntu/gamify
WEBHOOK_PORT=9000
EOF

sudo chmod 600 /etc/levelup-webhook.env
```

### 8c — Install and start the systemd service

```bash
# Make the script executable
chmod +x ~/gamify/deploy/webhook.py

# Copy the service unit (update the User= and ExecStart= paths if your username isn't ubuntu)
sudo cp ~/gamify/deploy/webhook.service /etc/systemd/system/levelup-webhook.service

# If your username is NOT ubuntu, fix the paths before enabling:
sudo sed -i "s|ubuntu|$USER|g" /etc/systemd/system/levelup-webhook.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable levelup-webhook
sudo systemctl start levelup-webhook

# Confirm it's running
sudo systemctl status levelup-webhook
```

### 8d — Open port 9000 in the firewall

```bash
sudo ufw allow 9000/tcp
sudo ufw status
```

### 8e — Add secrets to GitHub

Go to: **GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|---|---|
| `DEPLOY_WEBHOOK_SECRET` | The random string from step 8a |
| `DEPLOY_WEBHOOK_URL` | `http://<your-server-ip>:9000` |

> Use the raw IP address, not the domain — the webhook doesn't go through nginx.

---

## 9 — Test the auto-redeploy

```bash
# Watch the webhook logs live on the server
sudo journalctl -u levelup-webhook -f
```

Then push any commit to `main` on GitHub. Within a few seconds you should see:

```
=== Deploy started ===
$ git -C /home/ubuntu/gamify pull origin main
$ docker compose -f /home/ubuntu/gamify/docker-compose.yml up --build -d
=== Deploy complete ===
```

---

## Useful day-to-day commands

```bash
# View live logs from both containers
docker compose -f ~/gamify/docker-compose.yml logs -f

# View just the API logs
docker compose -f ~/gamify/docker-compose.yml logs -f api

# Restart without rebuilding (config-only change)
docker compose -f ~/gamify/docker-compose.yml restart

# Full rebuild (same as what the webhook triggers)
cd ~/gamify && docker compose up --build -d

# View webhook listener logs
sudo journalctl -u levelup-webhook -f

# Reload nginx after editing the config
sudo nginx -t && sudo systemctl reload nginx

# Renew SSL manually (runs automatically via timer, but useful to test)
sudo certbot renew --dry-run
```

---

## How it all fits together

```
Browser
  │
  ▼ HTTPS :443
nginx  (host)
  │
  ▼ http://localhost:3000
Next.js container  (web)
  │  /api/v1/* rewrite
  ▼ http://api:4000   (Docker internal network)
Express container  (api)
  │
  ▼ MongoDB Atlas (cloud)


GitHub push to main
  │
  ▼ GitHub Actions (.github/workflows/deploy.yml)
  │  POST http://<server-ip>:9000/deploy  +  HMAC signature
  ▼
webhook.py  (port 9000, managed by systemd)
  │  git pull + docker compose up --build -d
  ▼
Updated containers running on the same host
```
