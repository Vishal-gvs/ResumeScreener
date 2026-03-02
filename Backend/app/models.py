# app/models.py
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON

class Job(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description_text: str
    # store required skills as list in JSON
    required_skills: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    req_years: Optional[int] = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Resume(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: Optional[int] = Field(default=None, index=True)
    filename: str
    raw_text: Optional[str] = None
    parsed_fields: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    candidate_years: Optional[int] = 0
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class Score(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    resume_id: int = Field(foreign_key="resume.id")
    job_id: int = Field(foreign_key="job.id")
    skills_score: float
    education_score: float
    exp_score: float
    model_score: float
    combined_score: float
    computed_at: datetime = Field(default_factory=datetime.utcnow)
