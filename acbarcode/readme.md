# Barcode Label Maker (Vue 3)

A Vue 3 tool to generate product labels with CODE128 barcodes, product info, website, and logo. Download as PNG/JPEG or PDF (styled like the Python script).

## Features
- Product dropdown (auto-fills item number)
- Serial number input (up to 10, multi-line)
- CODE128 barcode (with "NS" prefix)
- Fixed website URL and logo
- Download as PNG/JPEG or PDF
- Password protection (user + admin passwords)
- Change password from the UI (persisted to disk)

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Add your logo:**
   Place your logo as `public/logo.png`.

3. **Run dev server:**
   ```sh
   npm run dev
   ```

## Deploy to Production

1. **Build the frontend:**
   ```sh
   npm run build
   ```

2. **Upload project files to server** (need: `dist/`, `data/`, `server.js`, `package.json`):
   ```sh
   scp -P 30002 -r dist data server.js package.json root@s4m.suto-portal.com:/home/ex/acbarcode/
   ```

3. **Start the production server:**
   ```sh
   # Direct:
   node server.js              # default port 3000
   node server.js 8080         # custom port

   # With PM2:
   pm2 start server.js --name barcode-label-maker -- 3000

   # Or use the built-in PM2 script:
   npm run pm2:prod            # builds + starts via PM2
   ```

## Password Protection

- **User password:** `SUTOuser1234` (default, changeable from UI or by editing `data/password.json`)
- **Admin password:** `SUTOadmin1234` (fixed, hardcoded, cannot be changed)
- Both user and admin can change the user password via the 🔒 button in the app
- Password is stored in `data/password.json` — persists across server restarts

## Usage
- Select a product (item number auto-fills)
- Enter up to 10 serial numbers (one per line)
- Click "Generate Labels"
- Download as PNG or PDF