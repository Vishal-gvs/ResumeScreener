# Model Score - Detailed Explanation

## What is Model Score?

The **Model Score** is a **Machine Learning (ML) / Natural Language Processing (NLP)** prediction that estimates how well a resume matches a job position. It's a probability value between **0.0 (0%) and 1.0 (100%)** that represents the model's confidence that a resume is a good match.

---

## How Model Score Works

### Two Modes of Operation:

#### 1. **With Trained Model** (ML/NLP Mode) ✅

When you've trained a machine learning model using the `/api/train_model` endpoint:

**Step-by-Step Process:**

1. **Text Normalization**
   ```
   Resume text → Lowercase → Remove extra spaces
   Example: "Python Developer with 5 Years Experience"
   → "python developer with 5 years experience"
   ```

2. **TF-IDF Vectorization** (Term Frequency-Inverse Document Frequency)
   - Converts the resume text into numerical features
   - **TF-IDF** measures how important a word is to a document
   - Uses **NLTK stopwords** to remove common words (the, a, an, etc.)
   - Creates up to **10,000 features** (most important words/phrases)
   - Uses **1-grams and 2-grams** (single words + word pairs)
     - Example: "machine learning", "python developer", "data science"
   
   **What TF-IDF does:**
   - Words that appear frequently in THIS resume but rarely in others get HIGH scores
   - Common words (stopwords) are ignored
   - Technical terms like "Python", "TensorFlow" get high importance

3. **Logistic Regression Prediction**
   - The trained model takes the TF-IDF vector
   - Outputs a probability: **P(good_match | resume_text)**
   - Returns a value between 0.0 and 1.0

4. **Result**
   - Model Score = predicted probability
   - Example: 0.75 = 75% confidence it's a good match

---

#### 2. **Without Trained Model** (Fallback Heuristic) ⚠️

If no model has been trained, the system uses a simple rule:

```python
if skills_found > 0:
    model_score = 0.5  # 50% - moderate match
else:
    model_score = 0.1  # 10% - poor match
```

**This is why you see 50.0% for all resumes when no model is trained!**

---

## Technology Stack

### 1. **TF-IDF Vectorization** (scikit-learn)
- **Purpose**: Convert text to numbers that ML models can understand
- **Features**: Up to 10,000 most important words/phrases
- **N-grams**: 1-gram (single words) + 2-gram (word pairs)
- **Stopwords**: Removes common English words using NLTK

**Example:**
```
Resume: "Python developer with machine learning experience"
TF-IDF Vector: [0.0, 0.0, 0.45, 0.0, 0.32, 0.0, 0.28, ...]
              (python) (developer) (machine learning) (experience)
```

### 2. **Logistic Regression** (scikit-learn)
- **Type**: Binary classifier (good match = 1, bad match = 0)
- **Training**: Learns from labeled examples
- **Output**: Probability of being a "good match" (0.0 to 1.0)
- **Class Weight**: Balanced (handles imbalanced datasets)

### 3. **NLTK (Natural Language Toolkit)**
- **Purpose**: Text preprocessing
- **Stopwords**: Removes common words (the, a, an, is, etc.)
- **Language**: English stopwords list

---

## Training the Model

### How to Train:

**Option 1: Upload CSV File**
```csv
text,label
"Python developer with 5 years experience in web development",1
"Cashier with retail experience",0
"Data scientist with ML and NLP expertise",1
```

**Option 2: JSON API Call**
```json
{
  "texts": [
    "Python developer with 5 years experience",
    "Cashier with retail experience"
  ],
  "labels": [1, 0]
}
```

### Training Process:

1. **Data Split**: 80% training, 20% testing
2. **Text Preprocessing**: Normalize all text
3. **Feature Extraction**: Create TF-IDF vectors
4. **Model Training**: Train Logistic Regression
5. **Evaluation**: Calculate accuracy, precision, recall, F1-score
6. **Save**: Store model and vectorizer to disk

### Training Metrics Returned:
- **Accuracy**: Overall correctness
- **Precision**: Of predicted "good matches", how many were actually good
- **Recall**: Of actual "good matches", how many were found
- **F1-Score**: Balance of precision and recall
- **Confusion Matrix**: Detailed breakdown

---

## Model Score in Combined Score

The Model Score contributes **20%** to the final Combined Score:

```
Combined Score = (50% × Skills) + 
                 (10% × Education) + 
                 (20% × Experience) + 
                 (20% × Model Score)  ← Here
```

**Example:**
- Model Score = 0.75 (75%)
- Contribution = 0.2 × 0.75 = 0.15 (15% of final score)

---

## Why Model Score Matters

### Advantages:

1. **Learns from Data**: Improves with more training examples
2. **Context Understanding**: Considers word relationships (bigrams)
3. **Semantic Clues**: Picks up patterns humans might miss
4. **Adaptive**: Can be retrained with new data

### Limitations (Current Implementation):

1. **Requires Training Data**: Needs labeled examples to work well
2. **Simple Model**: Logistic Regression is basic (not deep learning)
3. **No Semantic Understanding**: Doesn't understand synonyms well
   - "Python" ≠ "python programming" (treated as different)
4. **Language**: Only works with English (NLTK stopwords)

---

## Current Status in Your System

Based on your results showing **50.0% for all resumes**, it means:

❌ **No trained model exists** - Using fallback heuristic
✅ **Skills are being found** - So all get 50% (moderate match)

### To Improve Model Score:

1. **Train the Model**:
   ```bash
   POST /api/train_model
   ```
   - Provide CSV with resume texts and labels (1 = good, 0 = bad)
   - More training data = better predictions

2. **After Training**:
   - Model automatically loads on server restart
   - Scores will vary (0-100%) based on actual predictions
   - More accurate than the 50% fallback

---

## Example Scenarios

### Scenario 1: No Model Trained
```
Resume has skills → Model Score = 0.5 (50%)
Resume has no skills → Model Score = 0.1 (10%)
```

### Scenario 2: Model Trained (Good Match)
```
Resume: "Senior Python developer with 8 years experience in Django, 
         FastAPI, PostgreSQL, Docker, AWS. Master's in CS."
TF-IDF → [high scores for: python, django, fastapi, postgresql, ...]
Model Prediction → 0.87 (87%)
```

### Scenario 3: Model Trained (Poor Match)
```
Resume: "Retail cashier with 2 years experience. High school diploma."
TF-IDF → [low scores for technical terms]
Model Prediction → 0.15 (15%)
```

---

## Future Improvements

Potential enhancements to make Model Score better:

1. **Transformer Models**: Use BERT/RoBERTa for semantic understanding
2. **Named Entity Recognition**: Better skill/experience extraction
3. **Ensemble Models**: Combine multiple ML models
4. **Deep Learning**: Neural networks for complex patterns
5. **Multi-language Support**: Support for non-English resumes

---

## Summary

- **Model Score** = ML prediction of resume match quality (0-100%)
- **Uses TF-IDF + Logistic Regression** when trained
- **Falls back to 50%** if no model trained (and skills found)
- **Contributes 20%** to final Combined Score
- **Can be improved** by training with labeled data

The Model Score adds an intelligent, data-driven component to resume screening that learns from examples rather than just using fixed rules!

