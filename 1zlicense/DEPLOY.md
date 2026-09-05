# Deployment Guide - Ubuntu Server

This guide provides step-by-step instructions for deploying the Suto License Portal on an Ubuntu server using Docker Compose.

## 1. Prerequisites

Ensure your Ubuntu server is up to date and has Docker installed.

### Install Docker
```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
```

### Add user to Docker group (Optional)
```bash
sudo usermod -aG docker $USER
# Log out and log back in for changes to take effect
```

## 2. Clone the Repository

Clone the project to your server:
```bash
git clone <repository_url>
cd 1zlicense
```

### Common Build Issues
If you encounter a Babel version mismatch error during `docker-compose up --build`, try clearing the Docker build cache:
```bash
docker builder prune -a
docker-compose build --no-cache
```
Also ensure your local `package-lock.json` is up to date by running `npm install` before building.

## Manual Verification

Ensure `systemctl.json` matches your server's database requirements if you are not using the default Docker DB. However, the provided `docker-compose.yml` handles the database automatically.

## 4. Deploy with Docker Compose

To build and start the services in the background:
```bash
docker-compose up -d --build
```

- `--build`: Ensures the latest code changes are built into the image.
- `-d`: Runs the containers in detached mode.

## 5. Useful Commands

### Check logs
```bash
docker-compose logs -f easylicense
```

### Stop the services
```bash
docker-compose down
```

### Create/Update Database Tables (Secure Internal Access)
Since the database port is now hidden from the host for security, you should use `docker-compose exec` to run commands inside the container:
```bash
docker-compose exec licensedb mysql -u licenseuser -psutouser2019 easylicense -e "CREATE TABLE IF NOT EXISTS s332licenses (id INT AUTO_INCREMENT PRIMARY KEY, machine_code VARCHAR(255), note TEXT, license VARCHAR(255), createdatetime DATETIME, create_by VARCHAR(100));"
```

> [!NOTE]
> Port `3307` is no longer exposed to the host machine. The application connects to `licensedb:3306` internally.

## 6. Accessing the Portal
Once running, the portal will be accessible at `http://your-server-ip:8080`.
