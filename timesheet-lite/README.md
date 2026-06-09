# Timesheet Lite

A lightweight timesheet management application built with a modern tech stack.

## Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) - High performance, easy to learn, fast to code, ready for production.
- **Database ORM**: [SQLModel](https://sqlmodel.tiangolo.com/) - SQL databases in Python, designed to simplify interacting with SQL databases.
- **Authentication**: JWT (JSON Web Tokens) with `python-jose` and `passlib`.
- **Server**: Uvicorn.

### Frontend
- **Framework**: [Vue 3](https://vuejs.org/) - The Progressive JavaScript Framework.
- **Build Tool**: [Vite](https://vitejs.dev/) - Next Generation Frontend Tooling.
- **UI Library**: [Element Plus](https://element-plus.org/) - A Vue 3 based component library for designers and developers.
- **State Management**: [Pinia](https://pinia.vuejs.org/).
- **HTTP Client**: Axios.
- **Charts**: Chart.js with `vue-chartjs`.
- **Utilities**: `dayjs` for date manipulation, `xlsx`/`exceljs` for Excel export.

## Project Structure

```
timesheet-lite/
├── backend/            # FastAPI backend
│   ├── app/            # Application source code
│   ├── requirements.txt # Python dependencies
│   ├── run.py          # Entry point
│   └── ...
├── frontend/           # Vue 3 frontend
│   ├── src/            # Source code
│   ├── package.json    # Node dependencies
│   └── ...
└── README.md
```

## Setup & Running

### Prerequisites
- Python 3.8+
- Node.js 16+

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the server:
   ```bash
   python run.py
   ```
   The backend API will be available at `http://localhost:8000`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend application will be available at `http://localhost:5173` (or the port shown in the terminal).

## Features
- User Authentication & Access Control
- Timesheet Management
- Reporting & Excel Export
- Dashboard with Visualizations
