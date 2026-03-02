# Resume Scoring System Explanation

## Overview
This Resume Screener uses a **hybrid scoring approach** combining rule-based heuristics with **Machine Learning (ML) / NLP** techniques to rank resumes.

## Score Components

### 1. **Model Score** (ML/NLP Component)
- **What it is**: A machine learning prediction score (0.0 to 1.0) indicating how well a resume matches the job requirements
- **Technology Used**: 
  - **TF-IDF Vectorization** (Term Frequency-Inverse Document Frequency) - converts text to numerical features
  - **Logistic Regression** - binary classifier trained on resume data
  - **NLTK (Natural Language Toolkit)** - for text preprocessing (stopwords removal)
- **How it works**:
  - If a trained model exists, it uses the ML model to predict match probability
  - The model uses TF-IDF features (up to 10,000 features, 1-2 word n-grams)
  - If no model is trained, it falls back to a simple heuristic (0.5 if skills found, 0.1 otherwise)
- **Weight in combined score**: 20%

### 2. **Skills Score** (Rule-based)
- **What it is**: Percentage of required skills found in the resume (0.0 to 1.0)
- **How it works**: 
  - Uses regex pattern matching to find required skills in the resume text
  - Calculated as: `(number of skills found) / (total required skills)`
- **Weight in combined score**: 50% (highest weight)

### 3. **Education Score** (Rule-based)
- **What it is**: Match quality of education level (0.0, 0.5, or 1.0)
- **How it works**:
  - "exact" match (1.0): Finds degrees like PhD, Master's, MBA, Bachelor's
  - "related" match (0.5): Finds related keywords like "degree", "graduate", "diploma"
  - "none" (0.0): No education keywords found
- **Weight in combined score**: 10%

### 4. **Experience Score** (Rule-based)
- **What it is**: Years of experience match (0.0 to 1.0)
- **How it works**:
  - Extracts years of experience using regex patterns (e.g., "5 years", "3+ years")
  - If required years > 0: `min(candidate_years / required_years, 1.0)`
  - If required years = 0: `min(candidate_years / 10.0, 1.0)`
- **Weight in combined score**: 20%

### 5. **Combined Score** (Final Ranking Score)
- **What it is**: Weighted average of all components (0.0 to 1.0, displayed as percentage)
- **Formula**:
  ```
  Combined Score = (0.5 × Skills Score) + 
                   (0.1 × Education Score) + 
                   (0.2 × Experience Score) + 
                   (0.2 × Model Score)
  ```
- **Purpose**: Single metric to rank all candidates from best to worst match

## NLP/ML Technologies Used

### ✅ Yes, NLP is being used:

1. **NLTK (Natural Language Toolkit)**
   - Stopwords removal for text preprocessing
   - Used in TF-IDF vectorization

2. **TF-IDF Vectorization** (scikit-learn)
   - Converts resume text into numerical feature vectors
   - Considers word importance (rare words get higher weight)
   - Uses 1-gram and 2-gram (bigrams) for better context

3. **Logistic Regression** (scikit-learn)
   - Binary classifier to predict if a resume is a good match
   - Can be trained using the `/api/train_model` endpoint
   - Requires labeled training data (CSV with 'text' and 'label' columns)

4. **Text Normalization**
   - Lowercasing, whitespace normalization
   - Used throughout for consistent matching

## Training the ML Model

To improve the Model Score accuracy:
1. Prepare a CSV file with columns: `text` (resume text) and `label` (0 = bad match, 1 = good match)
2. Call `/api/train_model` endpoint with the CSV
3. The model will be saved and automatically used for future scoring

## Current Limitations

- **Model Score**: Currently uses a fallback heuristic (0.1 or 0.5) if no trained model exists
- **Skills Matching**: Simple regex-based, may miss synonyms or variations
- **Experience Extraction**: Basic pattern matching, may miss complex formats
- **Education Matching**: Keyword-based, doesn't understand degree equivalence

## Future Improvements

- Use transformer models (BERT, etc.) for better semantic understanding
- Named Entity Recognition (NER) for better skill/experience extraction
- Semantic similarity for skill matching (handles synonyms)
- More sophisticated ML models (Random Forest, XGBoost, Neural Networks)

