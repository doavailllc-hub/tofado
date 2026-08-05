# GitHub and EC2 Deployment

## 1. Upload to GitHub

Open PowerShell inside the project folder:

```bash
git init
git add .
git commit -m "Create Tofado Merchant landing website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/tofado-merchant-landing.git
git push -u origin main
```

For later updates:

```bash
git add .
git commit -m "Update Tofado landing website"
git push origin main
```

## 2. EC2 preparation — Amazon Linux 2023

```bash
sudo dnf update -y
sudo dnf install -y nginx git
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v
npm -v
```

## 3. Clone project

```bash
cd /home/ec2-user
git clone https://github.com/YOUR-USERNAME/tofado-merchant-landing.git
cd tofado-merchant-landing
```

## 4. Configure environment

```bash
cp .env.example .env
nano .env
```

Example:

```env
VITE_MERCHANT_APP_URL=https://merchant.tofado.com/login
```

## 5. Build

```bash
npm install
npm run build
```

## 6. Copy build to Nginx

```bash
sudo mkdir -p /var/www/tofado
sudo rm -rf /var/www/tofado/*
sudo cp -r dist/* /var/www/tofado/
sudo chown -R nginx:nginx /var/www/tofado
```

## 7. Nginx configuration

```bash
sudo nano /etc/nginx/conf.d/tofado.conf
```

Paste:

```nginx
server {
    listen 80;
    server_name tofado.com www.tofado.com;

    root /var/www/tofado;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2)$ {
        expires 30d;
        access_log off;
        add_header Cache-Control "public";
    }
}
```

Test and restart:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## 8. DNS

Create these records:

```text
A     @       YOUR_EC2_PUBLIC_IP
A     www     YOUR_EC2_PUBLIC_IP
```

## 9. SSL

```bash
sudo dnf install -y python3-certbot-nginx
sudo certbot --nginx -d tofado.com -d www.tofado.com
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

## 10. Deploy future updates

```bash
cd /home/ec2-user/tofado-merchant-landing
git pull origin main
npm install
npm run build
sudo rm -rf /var/www/tofado/*
sudo cp -r dist/* /var/www/tofado/
sudo chown -R nginx:nginx /var/www/tofado
sudo nginx -t
sudo systemctl reload nginx
```

## Separate subdomain recommendation

Use:

```text
tofado.com             Landing website
merchant.tofado.com    Merchant application
api.tofado.com         Node.js API
```
