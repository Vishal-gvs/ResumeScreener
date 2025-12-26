# app/scoring.py
from typing import List, Dict
import re

def normalize_text(t: str) -> str:
    return re.sub(r'\s+', ' ', t.lower().strip())

def extract_skills_from_text(text: str, skills_master: List[str]) -> List[str]:
    text_n = normalize_text(text)
    found = set()
    for skill in skills_master:
        s = skill.lower().strip()
        # match word boundary or phrase
        if s and re.search(r'\b' + re.escape(s) + r'\b', text_n):
            found.add(skill)
    return sorted(found)

def detect_years_of_experience(text: str) -> int:
    """
    naive heuristic: find patterns like 'X years' or 'X+ years' and return max found
    """
    text_n = text.lower()
    matches = re.findall(r'(\d{1,2})\s*\+?\s*years?', text_n)
    if not matches:
        return 0
    years = [int(m) for m in matches]
    return max(years)

def simple_education_match(text: str) -> str:
    """
    returns 'exact', 'related', or 'none' as a simple heuristic
    """
    text_n = text.lower()
    exact_degrees = ["ph.d", "phd", "master", "msc", "m.sc", "m.tech", "mba", "bachelor", "b.sc", "btech", "bachelor"]
    for d in exact_degrees:
        if d in text_n:
            return "exact"
    keywords_related = ["degree", "graduate", "diploma"]
    for d in keywords_related:
        if d in text_n:
            return "related"
    return "none"

def compute_combined_score(skill_match_count: int, total_required_skills: int, degree_match_str: str,
                           cand_years: int, req_years: int, model_prob: float,
                           weights: Dict[str,float]=None) -> Dict:
    if weights is None:
        weights = {"skills":0.7, "education":0.1, "exp":0.2, "model":0.0}

    # Calculate skills score - cap at 1.0 to prevent scores > 100%
    if total_required_skills > 0:
        skills_score = min(skill_match_count / total_required_skills, 1.0)
    else:
        # If no required skills specified, use a normalized score based on found skills
        # Cap at 1.0: if 10+ skills found, give full score
        skills_score = min(skill_match_count / 10.0, 1.0)
    
    education_score = 1.0 if degree_match_str == 'exact' else 0.5 if degree_match_str == 'related' else 0.0
    exp_score = min(cand_years / max(1, req_years), 1.0) if req_years > 0 else min(cand_years/10.0, 1.0)
    model_score = float(model_prob)
    
    # Ensure model_score is between 0 and 1
    model_score = max(0.0, min(1.0, model_score))

    combined = (weights["skills"] * skills_score +
                weights["education"] * education_score +
                weights["exp"] * exp_score +
                weights["model"] * model_score)
    
    # Cap combined score at 1.0 (100%)
    combined = min(combined, 1.0)

    return {
        "skills_score": round(skills_score, 4),
        "education_score": round(education_score, 4),
        "exp_score": round(exp_score, 4),
        "model_score": round(model_score, 4),
        "combined_score": round(combined, 4)
    }
