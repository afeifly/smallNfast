# Barcode Label Maker (Vue 3 Static)

A Vue 3 tool to generate product labels with CODE128 barcodes, product info, website, and logo. Download as PDF (styled for 100x60mm labels).

## Features
- Product dropdown (with search and auto-fill)
- Serial number input (up to 10, multi-line)
- CODE128 barcode (with "NS" prefix)
- Fixed website URL and logo
- Download labels as PDF (optimized for production)
- Hardcoded password protection (Static, no backend needed)

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

2. **Upload the `dist/` folder**:
   Upload the contents of the `dist/` folder to any static web server.
   
## Password Protection

The passwords are now hardcoded and do **not** require a server to store them:
- **User password:** `SUTOuser1234`
- **Admin password:** `SUTOadmin1234`

## Usage
- Select a product (use search to find items quickly)
- Enter up to 10 serial numbers (one per line)
- Click "Generate Labels"
- Download PDF for printing