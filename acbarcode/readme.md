# Barcode Label Maker (Vue 3)

A Vue 3 tool to generate product labels with CODE128 barcodes, product info, website, and logo. Download as PNG/JPEG or PDF (styled like the Python script).

## Features
- Product dropdown (auto-fills item number)
- Serial number input (up to 10, multi-line)
- CODE128 barcode (with "NS" prefix)
- Fixed website URL and logo
- Download as PNG/JPEG or PDF

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Add your logo:**
   Place your logo as `public/logo.png`.

3. **Run the app:**
   ```sh
   npm run dev
   ```

4. **Build for production:**
   ```sh
   npm run build
   ```


## Usage
- Select a product (item number auto-fills)
- Enter up to 10 serial numbers (one per line)
- Click "Generate Labels"
- Download as PNG or PDF

## Deploy
scp -P 30002 -r dist root@s4m.suto-portal.com:/home/ex/