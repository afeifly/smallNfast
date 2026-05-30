# Creator Center

Creator Center is a web-based document translation and generation workspace. It allows users to upload, segment, translate, and export DOCX and Markdown documents with support for key/value localization, image asset management, and PDF/DOCX exporting.

---

## Features

- **Document Parsing**: Parses incoming `.docx` and `.md` files into translatable segments.
- **Translation Management**: Organize segments, keys, translations, and project metadata in a structured database workspace.
- **Interactive Markdown Editor**: Edit segment content dynamically using a built-in markdown editor.
- **Asset Management**: Upload and link images relative to translation segments.
- **Multi-Format Export**: Export finalized work back to DOCX, Markdown, or styled PDF formats.
- **Docker Support**: Preconfigured container layout for simple development sandbox or production deployment.

---

## Tech Stack

### Backend
- **FastAPI**: Modern, high-performance web framework for APIs.
- **Uvicorn**: Lightning-fast ASGI server implementation.
- **python-docx & python-markdown**: Document parsing and generation engines.
- **SQLite**: Local relational database storage.
- **fpdf2**: PDF generation with support for international fonts.

### Frontend
- **React 19 & TypeScript**: Component architecture and type safety.
- **Vite**: Ultra-fast frontend build tooling and development server.
- **Tailwind CSS v4**: Utility-first styling framework.
- **TanStack React Query**: Server-state management and query caching.
- **React MD Editor**: Markdown preview and writing interface.

---

## Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 22+**
- **Docker & Docker Compose** (Optional, for containerized run)

---

### Running for Development

Running the backend and frontend separately gives you hot-reloading for both servers:

#### 1. Start the Backend API
Navigate to the root directory, activate the virtual environment, and launch Uvicorn:
```bash
# Activate virtual environment
source .venv/bin/activate

# Install dependencies (if needed)
pip install -r requirements.txt

# Run server with live reload enabled
uvicorn backend.main:app --reload
```
The API documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

#### 2. Start the Frontend Dev Server
In a new terminal window, navigate to the frontend folder and start Vite:
```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

---

### Running via Docker Compose

To compile, build, and run the backend and frontend together inside a container:
```bash
docker-compose up --build
```
The application will bundle the React assets, launch the FastAPI server, and host the completed application at [http://localhost:8000](http://localhost:8000).

---

### Production Build & Serve

To bundle the application manually:
1. Build the frontend distribution files:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Serve the application using the backend ASGI server:
   ```bash
   cd ..
   source .venv/bin/activate
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
The backend automatically detects the built assets under `frontend/dist/` and hosts them statically.
