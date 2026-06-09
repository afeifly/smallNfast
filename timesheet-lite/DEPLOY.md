# Deployment Guide (LAN Access)

## Prerequisites
- **Python 3.8+**
- **Node.js 16+**

## 1. Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate virtual environment:
    ```bash
    python -m venv .venv
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the backend:
    ```bash
    python run.py
    ```
    The backend will run on `0.0.0.0:8003`.

## 2. Frontend Setup (LAN Access)

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
    
## 3. Accessing from LAN

1.  Find your computer's LAN IP address (e.g., `192.168.1.100`).
2.  On any device in the same network, open the browser and go to:
    `http://<YOUR_IP>:5173`
    
    The frontend will load, and it will automatically proxy API requests to the backend running on your machine.
