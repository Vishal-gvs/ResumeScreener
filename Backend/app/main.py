# app/main.py
import os
import io
import joblib
import nltk
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, create_engine, Session, select
from typing import List, Optional
from .models import Job, Resume, Score
from .parsers import extract_text_from_upload
from .scoring import extract_skills_from_text, detect_years_of_experience, simple_education_match, compute_combined_score, normalize_text
from fastapi.responses import JSONResponse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
import pandas as pd

# Download NLTK stopwords if not already downloaded
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

from nltk.corpus import stopwords

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./resumes.db")
if DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if "sqlite" in DB_URL else {}
engine = create_engine(DB_URL, echo=False, connect_args=connect_args)

# create DB
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

app = FastAPI(
    title="Resume Screener API (with training)",
    docs_url=None,  # Disable automatic docs at /docs
    redoc_url=None,  # Disable ReDoc at /redoc
    openapi_url=None  # Disable OpenAPI schema at /openapi.json
)

# Root route - return simple JSON instead of HTML docs
@app.get("/")
def root():
    return {
        "message": "Resume Screener API",
        "status": "running",
        "docs": "API documentation is disabled. Use the React frontend at http://localhost:5173"
    }

# CORS settings to allow local frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "http://localhost",
    "http://127.0.0.1",
    "https://automated-resume-screeining.vercel.app",
    "https://automated-resume-screeining.vercel.app/",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = "./models"
os.makedirs(MODELS_DIR, exist_ok=True)

# load master skills
SKILLS_MASTER = []
skills_file = os.path.join(os.path.dirname(__file__), "skills_master.txt")
if os.path.exists(skills_file):
    with open(skills_file, "r", encoding="utf-8") as f:
        SKILLS_MASTER = [line.strip() for line in f if line.strip()]

# Model globals
MODEL_PATH = os.path.join(MODELS_DIR, "model.joblib")
VECTORIZER_PATH = os.path.join(MODELS_DIR, "vectorizer.joblib")

MODEL = None
VECTORIZER = None

def save_model_and_vectorizer(model, vectorizer):
    joblib.dump(model, MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)

def load_model_and_vectorizer():
    global MODEL, VECTORIZER
    if os.path.exists(MODEL_PATH) and os.path.exists(VECTORIZER_PATH):
        try:
            MODEL = joblib.load(MODEL_PATH)
            VECTORIZER = joblib.load(VECTORIZER_PATH)
            print("Loaded model and vectorizer from disk.")
        except Exception as e:
            print("Error loading model artifacts:", e)
            MODEL = None
            VECTORIZER = None
    else:
        MODEL = None
        VECTORIZER = None

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    load_model_and_vectorizer()

@app.get("/api/model_status")
def get_model_status():
    """Check if model is trained and available"""
    is_trained = MODEL is not None and VECTORIZER is not None
    return {
        "is_trained": is_trained,
        "model_path": MODEL_PATH if is_trained else None,
        "vectorizer_path": VECTORIZER_PATH if is_trained else None
    }

@app.post("/api/upload_job")
async def upload_job(
    title: str = Form(...),
    description_text: Optional[str] = Form(""),
    required_skills: Optional[str] = Form(None),
    req_years: Optional[str] = Form("0"),
):
    skills_list = []
    if required_skills:
        skills_list = [s.strip().lower() for s in required_skills.split(",") if s.strip()]

    years_int = 0
    if req_years not in (None, ""):
        try:
            years_int = int(req_years)
        except ValueError:
            years_int = 0

    job = Job(
        title=title,
        description_text=description_text or "",
        required_skills=skills_list,
        req_years=years_int,
    )
    with Session(engine) as session:
        session.add(job)
        session.commit()
        session.refresh(job)
    return {"job_id": job.id}

@app.post("/api/upload_resumes")
async def upload_resumes(job_id: int = Form(...), files: List[UploadFile] = File(...)):
    with Session(engine) as session:
        job_obj = session.get(Job, job_id)
        if not job_obj:
            raise HTTPException(status_code=404, detail="Job not found")

    saved_ids = []
    for f in files:
        try:
            text, tmp_path = extract_text_from_upload(f)
            
            resume = Resume(job_id=job_id, filename=f.filename, raw_text=text or "")
            with Session(engine) as session:
                session.add(resume)
                session.commit()
                session.refresh(resume)
                saved_ids.append(resume.id)
        except Exception as e:
            print(f"Error processing file {f.filename}: {e}")
            # Continue with other files even if one fails
            continue
        finally:
            # Clean up temp file
            try:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass

    if not saved_ids:
        raise HTTPException(status_code=400, detail="Failed to upload any resumes. Please check file formats.")
    
    return {"resume_ids": saved_ids, "count": len(saved_ids)}

@app.post("/api/parse_and_score")
async def parse_and_score(request: Request):
    # accept job_id from JSON body {"job_id": ...} or from form data
    job_id_val = None
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        data = await request.json()
        job_id_val = data.get("job_id")
    else:
        form = await request.form()
        job_id_val = form.get("job_id")

    if job_id_val is None or job_id_val == "":
        raise HTTPException(status_code=400, detail="job_id is required")

    try:
        job_id = int(job_id_val)
    except ValueError:
        raise HTTPException(status_code=400, detail="job_id must be an integer")

    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        resumes = session.exec(select(Resume).where(Resume.job_id == job_id)).all()
        if not resumes:
            return {"processed": 0, "message": "No resumes uploaded for this job."}

        results = []
        total_required = len(job.required_skills) if job.required_skills else 0

        for r in resumes:
            text = r.raw_text or ""
            found_skills = extract_skills_from_text(text, job.required_skills if total_required>0 else SKILLS_MASTER)
            cand_years = detect_years_of_experience(text)
            edu = simple_education_match(text)

            # Use trained model if available
            model_prob = 0.1
            if MODEL is not None and VECTORIZER is not None:
                try:
                    X_vec = VECTORIZER.transform([normalize_text(text)])
                    proba = MODEL.predict_proba(X_vec)[0]
                    # assuming positive class is at index 1
                    model_prob = float(proba[1])
                except Exception as e:
                    print("Model predict error:", e)
                    model_prob = 0.1
            else:
                # fallback heuristic
                model_prob = 0.5 if len(found_skills) > 0 else 0.1

            score_dict = compute_combined_score(
                skill_match_count=len(found_skills),
                total_required_skills=total_required,
                degree_match_str=edu,
                cand_years=cand_years,
                req_years=job.req_years or 0,
                model_prob=model_prob
            )

            r.parsed_fields = {
                "found_skills": found_skills,
                "candidate_years": cand_years,
                "education": edu
            }
            r.candidate_years = cand_years
            session.add(r)
            session.commit()
            session.refresh(r)

            sc = Score(
                resume_id=r.id,
                job_id=job_id,
                skills_score=score_dict["skills_score"],
                education_score=score_dict["education_score"],
                exp_score=score_dict["exp_score"],
                model_score=score_dict["model_score"],
                combined_score=score_dict["combined_score"]
            )
            session.add(sc)
            session.commit()
            session.refresh(sc)

            results.append({
                "resume_id": r.id,
                "filename": r.filename,
                "found_skills": found_skills,
                "candidate_years": cand_years,
                "education": edu,
                "score": score_dict
            })

        # Sort results by combined_score in descending order (highest first)
        results.sort(key=lambda x: x["score"]["combined_score"], reverse=True)

    return {"processed": len(results), "results": results}

@app.get("/api/jobs/{job_id}/results")
def get_job_results(job_id: int, top: int = 10):
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        q = select(Score, Resume).where(Score.job_id == job_id).join(Resume, Resume.id == Score.resume_id)
        rows = session.exec(q).all()
        items = []
        for sc, rv in rows:
            items.append({
                "resume_id": rv.id,
                "filename": rv.filename,
                "combined_score": sc.combined_score,
                "skills_score": sc.skills_score,
                "education_score": sc.education_score,
                "exp_score": sc.exp_score,
                "model_score": sc.model_score,
                "parsed_fields": rv.parsed_fields
            })
        sorted_items = sorted(items, key=lambda x: x["combined_score"], reverse=True)
        return {"job_id": job_id, "top": top, "results": sorted_items[:top]}

@app.get("/api/resumes/{resume_id}")
def get_resume(resume_id: int):
    with Session(engine) as session:
        r = session.get(Resume, resume_id)
        if not r:
            raise HTTPException(status_code=404, detail="Resume not found")
        return {"id": r.id, "filename": r.filename, "raw_text": r.raw_text, "parsed_fields": r.parsed_fields, "candidate_years": r.candidate_years}

# ------------------------
# Training endpoint
# ------------------------
@app.post("/api/train_model")
async def train_model(file: Optional[UploadFile] = File(None), payload: Optional[dict] = Body(None)):
    """
    Train TF-IDF + Logistic Regression model.
    Input options:
    - Upload a CSV file (multipart/form-data) with columns: 'text' and 'label' (0/1)
    - Or pass JSON body: {"texts": [...], "labels": [...]}
    Returns training metrics and saves model artifacts.
    """
    # 1) Load data
    df = None
    if file is not None:
        contents = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unable to read CSV file: {e}")
    elif payload is not None:
        # expect payload to have 'texts' and 'labels'
        texts = payload.get("texts")
        labels = payload.get("labels")
        if not texts or not labels:
            raise HTTPException(status_code=400, detail="JSON payload must contain 'texts' and 'labels'")
        if len(texts) != len(labels):
            raise HTTPException(status_code=400, detail="'texts' and 'labels' length mismatch")
        df = pd.DataFrame({"text": texts, "label": labels})
    else:
        raise HTTPException(status_code=400, detail="Provide a CSV file upload or JSON payload with texts & labels.")

    # Basic validation
    if "text" not in df.columns or "label" not in df.columns:
        raise HTTPException(status_code=400, detail="CSV must contain 'text' and 'label' columns")

    # clean and normalize text
    df["text"] = df["text"].astype(str).apply(lambda t: normalize_text(t))
    df["label"] = df["label"].astype(int)

    # split
    X_train, X_test, y_train, y_test = train_test_split(df["text"].tolist(), df["label"].tolist(), test_size=0.2, random_state=42, stratify=df["label"].tolist() if len(set(df["label"]))>1 else None)

    # vectorize using NLTK stopwords
    stop_words_list = stopwords.words('english')
    vectorizer = TfidfVectorizer(stop_words=stop_words_list, max_features=10000, ngram_range=(1,2))
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    # model
    model = LogisticRegression(max_iter=1000, class_weight='balanced')
    model.fit(X_train_vec, y_train)

    # metrics
    preds = model.predict(X_test_vec)
    probs = model.predict_proba(X_test_vec)[:, 1]
    acc = accuracy_score(y_test, preds)
    cm = confusion_matrix(y_test, preds).tolist()
    prf = precision_recall_fscore_support(y_test, preds, average="binary", zero_division=0)
    precision, recall, f1, _ = prf

    # save artifacts
    save_model_and_vectorizer(model, vectorizer)
    # reload into globals
    load_model_and_vectorizer()

    return {
        "status": "trained",
        "metrics": {
            "accuracy": float(acc),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
            "confusion_matrix": cm
        },
        "model_path": MODEL_PATH,
        "vectorizer_path": VECTORIZER_PATH
    }
