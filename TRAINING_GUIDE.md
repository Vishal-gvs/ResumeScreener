# Model Training Guide

## Overview

The Resume Screener uses a Machine Learning (ML) model to improve scoring accuracy. By training the model with labeled resume data, you can get more accurate and varied Model Scores (instead of the default 50% fallback).

## How to Train the Model

### Step 1: Prepare Training Data

Create a CSV file with two columns:
- **`text`**: The resume text content
- **`label`**: `1` for good matches, `0` for bad matches

**Example CSV (`training_data.csv`):**
```csv
text,label
"Python developer with 5 years experience in Django, FastAPI, PostgreSQL. Strong background in web development and REST APIs.",1
"Senior software engineer with expertise in machine learning, data science, and Python. PhD in Computer Science.",1
"Full stack developer with React, Node.js, and MongoDB experience. 3 years building web applications.",1
"Retail cashier with 2 years experience. High school diploma. Looking for entry-level position.",0
"Customer service representative with phone and email support experience. No technical background.",0
"Data entry clerk with Microsoft Office skills. Associate degree in Business.",0
```

### Step 2: Use the Training Interface

1. **Open the Resume Screener** application in your browser
2. **Scroll down** to the "ML Model Training" section
3. **Click "Download Sample CSV"** to see the format (optional)
4. **Click "Upload Training Data (CSV)"** and select your CSV file
5. **Click "Train Model"** button
6. **Wait for training to complete** (usually takes a few seconds to a minute)

### Step 3: View Training Results

After training completes, you'll see:
- **Training Metrics**:
  - **Accuracy**: Overall correctness of predictions
  - **Precision**: Of predicted "good matches", how many were actually good
  - **Recall**: Of actual "good matches", how many were found
  - **F1-Score**: Balance of precision and recall
  - **Confusion Matrix**: Detailed breakdown of predictions

### Step 4: Use the Trained Model

Once trained, the model is **automatically active**:
- ✅ Model status indicator turns green
- ✅ Model scores will now vary (0-100%) instead of fixed 50%
- ✅ More accurate predictions based on your training data
- ✅ Model persists across server restarts

## Training Data Tips

### Good Training Data:
- ✅ **Balanced**: Mix of good (1) and bad (0) examples
- ✅ **Representative**: Matches your actual resume types
- ✅ **Sufficient**: At least 20-30 examples (more is better)
- ✅ **Accurate Labels**: Correctly labeled as good/bad matches

### Example Good Matches (label = 1):
- Software developers with relevant skills
- Engineers with required experience
- Candidates matching job requirements

### Example Bad Matches (label = 0):
- Non-technical backgrounds for tech jobs
- Unrelated experience
- Missing required qualifications

## Model Technology

The model uses:
- **TF-IDF Vectorization**: Converts text to numerical features
  - Up to 10,000 most important words/phrases
  - Uses 1-grams and 2-grams (word pairs)
  - Removes common English stopwords
- **Logistic Regression**: Binary classifier
  - Predicts probability of good match (0.0 to 1.0)
  - Balanced class weights for imbalanced data

## Retraining

You can retrain the model anytime:
1. Upload a new CSV file
2. Click "Train Model"
3. The new model replaces the old one
4. Previous results are cleared (re-score resumes to see new predictions)

## Troubleshooting

### "CSV must contain 'text' and 'label' columns"
- Make sure your CSV has exactly these column names
- Check for typos or extra spaces

### "Unable to read CSV file"
- Ensure the file is a valid CSV
- Check for proper encoding (UTF-8 recommended)

### Model scores still showing 50%
- Make sure training completed successfully
- Check the model status indicator (should be green)
- Try re-scoring resumes after training

### Low accuracy metrics
- Add more training examples
- Ensure labels are accurate
- Balance good and bad examples

## API Usage

You can also train via API:

```bash
# Using CSV file
curl -X POST "http://localhost:8000/api/train_model" \
  -F "file=@training_data.csv"

# Using JSON
curl -X POST "http://localhost:8000/api/train_model" \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "Python developer with 5 years experience",
      "Retail cashier with 2 years experience"
    ],
    "labels": [1, 0]
  }'
```

## Benefits of Training

✅ **More Accurate Scores**: Model learns patterns from your data
✅ **Varied Predictions**: Scores range from 0-100% instead of fixed 50%
✅ **Better Ranking**: More accurate sorting of candidates
✅ **Adaptive**: Can be retrained with new data

## Next Steps

After training:
1. Create a job posting with required skills
2. Upload resumes
3. Click "Parse & Score"
4. See improved Model Scores based on ML predictions!

