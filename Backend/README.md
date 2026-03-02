# Resume Screener Backend

FastAPI backend for the Resume Screener application.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Server

### Option 1: Using Python module (Recommended)
```bash
python -m uvicorn app.main:app --reload
```

### Option 2: Using the batch script (Windows)
```bash
.\run_server.bat
```

### Option 3: Using the PowerShell script (Windows)
```powershell
.\run_server.ps1
```

The server will start on `http://127.0.0.1:8000` (or `http://localhost:8000`)

## Note

If you get an error that `uvicorn` is not recognized, use `python -m uvicorn` instead of just `uvicorn`. This is because the Scripts directory may not be in your PATH.

## API Endpoints

- `GET /` - API status (returns JSON)
- `POST /api/upload_job` - Create a new job posting
- `POST /api/upload_resumes` - Upload resumes for a job
- `POST /api/parse_and_score` - Parse and score resumes
- `GET /api/jobs/{job_id}/results` - Get results for a job
- `GET /api/resumes/{resume_id}` - Get a specific resume
- `POST /api/train_model` - Train the ML model

## Frontend

The React frontend should be running on `http://localhost:5173` and will make API calls to this backend.


