# How Resume Scoring Works

## Score Calculation Breakdown

The system calculates a **Combined Score** (0-100%) using a weighted formula with 4 components:

### Formula:
```
Combined Score = (50% × Skills Score) + 
                 (10% × Education Score) + 
                 (20% × Experience Score) + 
                 (20% × Model Score)
```

All scores are capped at 1.0 (100%) to prevent values exceeding 100%.

---

## Component Details

### 1. Skills Score (50% weight - Most Important)

**Calculation:**
- **If required skills are specified:**
  ```
  Skills Score = min(found_skills / required_skills, 1.0)
  ```
  Example: Found 8 out of 10 required skills = 0.8 (80%)

- **If NO required skills specified:**
  ```
  Skills Score = min(found_skills / 10.0, 1.0)
  ```
  Example: Found 13 skills = min(13/10, 1.0) = 1.0 (100%)
  - This prevents scores > 100% when no required skills are set
  - Assumes 10+ skills found = excellent match

**How it works:**
- Uses regex pattern matching to find skills in resume text
- Case-insensitive matching with word boundaries
- Matches against either:
  - Required skills (if job has them)
  - Master skills list (if no required skills specified)

---

### 2. Education Score (10% weight)

**Values:**
- **1.0 (100%)**: Exact degree match
  - Keywords: "ph.d", "phd", "master", "msc", "m.sc", "m.tech", "mba", "bachelor", "b.sc", "btech"
- **0.5 (50%)**: Related education
  - Keywords: "degree", "graduate", "diploma"
- **0.0 (0%)**: No education keywords found

---

### 3. Experience Score (20% weight)

**Calculation:**
- **If required years > 0:**
  ```
  Experience Score = min(candidate_years / required_years, 1.0)
  ```
  Example: Candidate has 5 years, required is 3 = min(5/3, 1.0) = 1.0 (100%)

- **If required years = 0:**
  ```
  Experience Score = min(candidate_years / 10.0, 1.0)
  ```
  Example: Candidate has 7 years = min(7/10, 1.0) = 0.7 (70%)

**How it works:**
- Extracts years using regex: finds patterns like "5 years", "3+ years"
- Takes the maximum value found in the resume

---

### 4. Model Score (20% weight - ML/NLP Component)

**Values:**
- **If ML model is trained:**
  - Uses TF-IDF vectorization + Logistic Regression
  - Predicts probability (0.0 to 1.0) of good match
  - Based on trained data

- **If NO model trained (fallback):**
  - 0.5 (50%) if any skills found
  - 0.1 (10%) if no skills found

**Technology:**
- TF-IDF Vectorization (up to 10,000 features, 1-2 word n-grams)
- Logistic Regression classifier
- NLTK for stopwords removal

---

## Example Calculation

**Scenario:**
- Found 8 out of 10 required skills
- Education: "exact" match (Master's degree)
- Experience: 5 years (required: 3 years)
- Model score: 0.6 (60%)

**Calculation:**
```
Skills Score = 8/10 = 0.8 (80%)
Education Score = 1.0 (100%)
Experience Score = min(5/3, 1.0) = 1.0 (100%)
Model Score = 0.6 (60%)

Combined = (0.5 × 0.8) + (0.1 × 1.0) + (0.2 × 1.0) + (0.2 × 0.6)
         = 0.4 + 0.1 + 0.2 + 0.12
         = 0.82 (82%)
```

---

## Why Scores Were > 100% (Fixed)

**Previous Bug:**
- When no required skills were specified, `total_required_skills = 0`
- Formula: `skills_score = skill_match_count / max(1, 0) = skill_match_count / 1`
- If 13 skills found: `skills_score = 13`
- Weighted: `0.5 × 13 = 6.5`
- Displayed: `6.5 × 100 = 650%` ❌

**Fix:**
- Now caps skills_score at 1.0 when no required skills specified
- Uses normalized calculation: `min(found_skills / 10.0, 1.0)`
- All scores capped at 1.0 (100%) maximum

---

## Tips for Better Scores

1. **Specify Required Skills**: Always enter required skills when creating a job
   - This gives more accurate skills matching
   - Prevents inflated scores

2. **Train the ML Model**: Use `/api/train_model` endpoint
   - Provides better Model Score predictions
   - Requires labeled training data (CSV with 'text' and 'label' columns)

3. **Complete Job Requirements**: Fill in required years and skills
   - More accurate experience matching
   - Better overall scoring

