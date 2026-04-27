import { useState, useEffect } from 'react'
import './App.css'

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = rawApiUrl.replace(/\/+$/, '');


function App() {
  const [currentJobId, setCurrentJobId] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobFile, setJobFile] = useState(null)
  const [requiredSkills, setRequiredSkills] = useState('')
  const [reqYears, setReqYears] = useState('')
  const [jobStatus, setJobStatus] = useState('')
  const [selectedResumeFiles, setSelectedResumeFiles] = useState([])
  const [uploaderStatus, setUploaderStatus] = useState('')
  const [results, setResults] = useState([])
  const [topN, setTopN] = useState(10)
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [modelStatus, setModelStatus] = useState(null)
  const [trainingFile, setTrainingFile] = useState(null)
  const [isTraining, setIsTraining] = useState(false)
  const [trainingMetrics, setTrainingMetrics] = useState(null)
  const [trainingStatus, setTrainingStatus] = useState('')

  useEffect(() => {
    const storedJobId = localStorage.getItem('currentJobId')
    if (storedJobId) {
      const parsedId = parseInt(storedJobId, 10)
      if (!isNaN(parsedId)) {
        setCurrentJobId(parsedId)
        setJobStatus('Using existing job id: ' + parsedId)
      } else {
        localStorage.removeItem('currentJobId')
      }
    }
    checkModelStatus()
  }, [])

  const checkModelStatus = async () => {
    try {
      const resp = await fetch(API_BASE + '/api/model_status')
      if (resp.ok) {
        const data = await resp.json()
        setModelStatus(data)
      }
    } catch (err) {
      console.error('Error checking model status:', err)
    }
  }

  const humanSize = (bytes) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024
      i++
    }
    return bytes.toFixed(1) + ' ' + units[i]
  }

  const handleCreateJob = async () => {
    setJobStatus('')
    if (!jobTitle.trim()) {
      setJobStatus('⚠️ Please enter a job title.')
      return
    }

    setIsCreating(true)
    const form = new FormData()
    form.append('title', jobTitle.trim())
    if (jobFile) {
      form.append('description_text', jobDescription.trim() || '')
      form.append('file', jobFile)
    } else {
      form.append('description_text', jobDescription.trim())
    }
    form.append('required_skills', '')
    form.append('req_years', '0')

    try {
      const resp = await fetch(API_BASE + '/api/upload_job', {
        method: 'POST',
        body: form
      })
      if (!resp.ok) {
        const txt = await resp.text()
        throw new Error(txt)
      }
      const data = await resp.json()
      setCurrentJobId(data.job_id)
      if (data.job_id != null) {
        localStorage.setItem('currentJobId', String(data.job_id))
      }
      setJobStatus('✅ Job created — ID: ' + data.job_id)
    } catch (err) {
      console.error(err)
      setJobStatus('❌ Error creating job: ' + (err.message || err))
    } finally {
      setIsCreating(false)
    }
  }

  const handleClearJob = () => {
    setJobTitle('')
    setJobDescription('')
    setJobFile(null)
    setCurrentJobId(null)
    setJobStatus('')
    localStorage.removeItem('currentJobId')
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    addFiles(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files || [])
    addFiles(files)
  }

  const addFiles = (files) => {
    setSelectedResumeFiles(prev => {
      const newFiles = files.filter(f =>
        !prev.find(x => x.name === f.name && x.size === f.size)
      )
      return [...prev, ...newFiles]
    })
  }

  const removeFile = (index) => {
    setSelectedResumeFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUploadResumes = async () => {
    setUploaderStatus('')
    if (!currentJobId) {
      setUploaderStatus('⚠️ Create a job first.')
      return
    }
    if (selectedResumeFiles.length === 0) {
      setUploaderStatus('⚠️ Select at least one resume.')
      return
    }

    setIsUploading(true)
    setUploaderStatus('Uploading...')
    try {
      const form = new FormData()
      form.append('job_id', currentJobId)
      selectedResumeFiles.forEach(f => form.append('files', f, f.name))

      const resp = await fetch(API_BASE + '/api/upload_resumes', {
        method: 'POST',
        body: form
      })
      if (!resp.ok) {
        const txt = await resp.text()
        let errorMsg = txt
        try {
          const errorJson = JSON.parse(txt)
          errorMsg = errorJson.detail || txt
        } catch {
          // Not JSON, use as is
        }
        throw new Error(errorMsg)
      }
      const data = await resp.json()
      const count = (data.resume_ids || []).length
      setUploaderStatus(`✅ Successfully uploaded ${count} resume${count !== 1 ? 's' : ''}`)
      setSelectedResumeFiles([])
      setResults([]) // Clear previous results
      // Reset file input
      const fileInput = document.getElementById('resumeFiles')
      if (fileInput) fileInput.value = ''
    } catch (err) {
      console.error('Upload error:', err)
      setUploaderStatus('❌ Upload error: ' + (err.message || err))
    } finally {
      setIsUploading(false)
    }
  }

  const handleParseScore = async () => {
    if (!currentJobId) {
      setUploaderStatus('⚠️ Create a job first.')
      return
    }
    setIsProcessing(true)
    setUploaderStatus('Processing resumes...')
    try {
      const resp = await fetch(API_BASE + '/api/parse_and_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: currentJobId })
      })

      if (!resp.ok) {
        let errorMsg = await resp.text()
        try {
          const errorJson = JSON.parse(errorMsg)
          errorMsg = errorJson.detail || errorMsg
        } catch {
          // Not JSON, use as is
        }
        throw new Error(errorMsg)
      }

      const data = await resp.json()
      const processed = data.processed || 0
      const resultsList = data.results || []

      if (processed === 0) {
        setUploaderStatus('⚠️ No resumes found. Upload resumes first.')
        setResults([])
      } else {
        // Results are already sorted by backend, but ensure they're sorted
        const sortedResults = [...resultsList].sort((a, b) =>
          (b.score?.combined_score || 0) - (a.score?.combined_score || 0)
        )
        setResults(sortedResults)
        setUploaderStatus(`✅ Processed ${processed} resume${processed !== 1 ? 's' : ''}. Showing top ${Math.min(topN, sortedResults.length)}.`)
      }
    } catch (err) {
      console.error('Processing error:', err)
      setUploaderStatus('❌ Processing error: ' + (err.message || err))
      setResults([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTrainModel = async () => {
    if (!trainingFile) {
      setTrainingStatus('⚠️ Please select a CSV file to train the model.')
      return
    }

    setIsTraining(true)
    setTrainingStatus('Training model... This may take a few moments.')
    setTrainingMetrics(null)

    try {
      const form = new FormData()
      form.append('file', trainingFile)

      const resp = await fetch(API_BASE + '/api/train_model', {
        method: 'POST',
        body: form
      })

      if (!resp.ok) {
        let errorMsg = await resp.text()
        try {
          const errorJson = JSON.parse(errorMsg)
          errorMsg = errorJson.detail || errorMsg
        } catch {
          // Not JSON, use as is
        }
        throw new Error(errorMsg)
      }

      const data = await resp.json()
      setTrainingMetrics(data.metrics)
      setTrainingStatus('✅ Model trained successfully!')
      setTrainingFile(null)

      // Reset file input
      const fileInput = document.getElementById('trainingFile')
      if (fileInput) fileInput.value = ''

      // Check model status again
      await checkModelStatus()

      // Clear previous results to force re-scoring with new model
      setResults([])
    } catch (err) {
      console.error('Training error:', err)
      setTrainingStatus('❌ Training error: ' + (err.message || err))
      setTrainingMetrics(null)
    } finally {
      setIsTraining(false)
    }
  }

  const downloadSampleCSV = () => {
    const sampleData = `text,label
"Python developer with 5 years experience in Django, FastAPI, PostgreSQL. Strong background in web development and REST APIs.",1
"Senior software engineer with expertise in machine learning, data science, and Python. PhD in Computer Science.",1
"Full stack developer with React, Node.js, and MongoDB experience. 3 years building web applications.",1
"Retail cashier with 2 years experience. High school diploma. Looking for entry-level position.",0
"Customer service representative with phone and email support experience. No technical background.",0
"Data entry clerk with Microsoft Office skills. Associate degree in Business.",0
"Backend developer with Java, Spring Boot, and MySQL. 4 years experience in enterprise applications.",1
"Frontend developer specializing in React, TypeScript, and CSS. Portfolio of modern web applications.",1
"Sales associate with retail experience. No programming or technical skills.",0
"DevOps engineer with Docker, Kubernetes, and AWS experience. CI/CD pipeline expertise.",1`

    const blob = new Blob([sampleData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'training_data_sample.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const renderResults = () => {
    if (!results || results.length === 0) {
      return (
        <div className="small muted" style={{ padding: '20px', textAlign: 'center' }}>
          No results yet. Create a job, upload resumes, then run "Parse & Score".
        </div>
      )
    }

    const displayResults = results.slice(0, topN)
    const rows = displayResults.map((r, index) => {
      const skills = (r.found_skills || [])
      const score = r.score || {}
      const combinedScore = score.combined_score || 0
      const modelScore = score.model_score || 0

      // Color code based on score
      const getScoreColor = (score) => {
        if (score >= 0.7) return '#10b981' // green
        if (score >= 0.5) return '#f59e0b' // amber
        return '#ef4444' // red
      }

      return (
        <tr key={r.resume_id}>
          <td style={{ textAlign: 'center' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: index < 3 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              color: index < 3 ? '#a5b4fc' : '#94a3b8',
              border: index < 3 ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '13px',
              fontWeight: 'bold'
            }}>
              {index + 1}
            </span>
          </td>
          <td>
            <div>
              <strong>{r.filename}</strong>
              <div className="small muted">ID: {r.resume_id}</div>
            </div>
          </td>
          <td>
            {skills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {skills.slice(0, 5).map((skill, i) => (
                  <span key={i} className="badge">{skill}</span>
                ))}
                {skills.length > 5 && (
                  <span className="small muted">+{skills.length - 5} more</span>
                )}
              </div>
            ) : (
              <span className="small muted">-</span>
            )}
          </td>
          <td>
            <strong>{r.candidate_years || 0}</strong>
            <span className="small muted"> years</span>
          </td>
          <td>
            <strong style={{ color: getScoreColor(Math.min(combinedScore, 1.0)) }}>
              {(Math.min(combinedScore, 1.0) * 100).toFixed(1)}%
            </strong>
          </td>
          <td>
            <span style={{ color: getScoreColor(modelScore) }}>
              {(modelScore * 100).toFixed(1)}%
            </span>
          </td>
        </tr>
      )
    })

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="results-table">
          <thead>
            <tr>
              <th style={{ padding: '12px', fontWeight: '600' }}>Rank</th>
              <th style={{ padding: '12px', fontWeight: '600' }}>Candidate</th>
              <th style={{ padding: '12px', fontWeight: '600' }}>Skills Matched</th>
              <th style={{ padding: '12px', fontWeight: '600' }}>Experience</th>
              <th style={{ padding: '12px', fontWeight: '600' }}>Combined Score</th>
              <th style={{ padding: '12px', fontWeight: '600' }}>Model Score</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="container">
      <header>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="8" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.3)" strokeWidth="1" />
          <path d="M8 12h8M8 7h8M8 17h8" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <h1>Resume Screener</h1>
          <div className="small muted">Upload a Job Description and many resumes (bulk). This UI calls the FastAPI backend endpoints.</div>
        </div>
      </header>

      <div className="card" id="job-card">
        <label htmlFor="jobTitle">Job Title</label>
        <input
          id="jobTitle"
          type="text"
          placeholder="Backend Python Developer"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
        />

        <label style={{ marginTop: '12px' }}>Job Description (text OR upload file)</label>
        <textarea
          id="jobDescription"
          rows="4"
          placeholder="Paste job description here (or upload a file below)"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />

        <div style={{ marginTop: '12px' }}>
          <label>Upload Job Description File (.txt / .pdf / .docx)</label>
          <input
            id="jobFile"
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => setJobFile(e.target.files[0] || null)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button
            className="btn"
            id="createJobBtn"
            onClick={handleCreateJob}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Job'}
          </button>
          <button
            className="btn secondary"
            id="clearJobBtn"
            onClick={handleClearJob}
          >
            Clear
          </button>
          <div className="small muted" style={{ alignSelf: 'center', marginLeft: '8px' }}>
            {jobStatus}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '18px' }}>
        <label>Upload Resumes (bulk)</label>
        <div
          className="uploader"
          tabIndex="0"
          onClick={() => document.getElementById('resumeFiles').click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          Drag & drop resumes here or click to select<br />
          <span className="small muted">Supports multiple files: .pdf, .docx, .txt</span>
        </div>
        <input
          id="resumeFiles"
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        <div className="file-list">
          {selectedResumeFiles.length === 0 ? (
            <div className="small muted">No files selected.</div>
          ) : (
            selectedResumeFiles.map((f, idx) => (
              <div key={idx} className="file-row">
                <div>
                  <strong>{f.name}</strong>
                  <div className="small muted">{humanSize(f.size)}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn secondary"
                    onClick={() => removeFile(idx)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button
            className="btn"
            id="uploadResumesBtn"
            onClick={handleUploadResumes}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Resumes'}
          </button>
          <button
            className="btn secondary"
            id="parseScoreBtn"
            onClick={handleParseScore}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Parse & Score (server)'}
          </button>
          <div className="small muted" style={{ alignSelf: 'center' }}>
            {uploaderStatus}
          </div>
        </div>
      </div>

      <div className="card" id="results-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Results</h2>
            {results.length > 0 && (
              <div className="small muted" style={{ marginTop: '4px' }}>
                Showing top {Math.min(topN, results.length)} of {results.length} processed resume{results.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          {results.length > 0 && (
            <div className="center">
              <span className="small muted">Show top</span>
              <select
                id="topN"
                value={topN}
                onChange={(e) => setTopN(parseInt(e.target.value))}
                style={{ marginLeft: '8px', padding: '6px 10px' }}
              >
                <option>5</option>
                <option>10</option>
                <option>20</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ marginTop: '12px' }}>
          {renderResults()}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>ML Model Training</h2>
          {modelStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: modelStatus.is_trained ? '#10b981' : '#ef4444'
              }}></span>
              <span className="small" style={{ color: modelStatus.is_trained ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {modelStatus.is_trained ? 'Model Trained' : 'No Model'}
              </span>
            </div>
          )}
        </div>

        <div className="small muted" style={{ marginBottom: '16px' }}>
          Train the ML model with labeled resume data to improve scoring accuracy. The model uses TF-IDF vectorization and Logistic Regression.
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>Upload Training Data (CSV)</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              id="trainingFile"
              type="file"
              accept=".csv"
              onChange={(e) => setTrainingFile(e.target.files[0] || null)}
              style={{ flex: 1 }}
            />
            <button
              className="btn secondary"
              onClick={downloadSampleCSV}
              type="button"
            >
              Download Sample CSV
            </button>
          </div>
          <div className="small muted" style={{ marginTop: '8px' }}>
            CSV must have columns: <code>text</code> (resume text) and <code>label</code> (1 = good match, 0 = bad match)
          </div>
        </div>

        {trainingFile && (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>{trainingFile.name}</strong>
              <div className="small muted">{humanSize(trainingFile.size)}</div>
            </div>
            <button
              className="btn secondary"
              onClick={() => {
                setTrainingFile(null)
                const fileInput = document.getElementById('trainingFile')
                if (fileInput) fileInput.value = ''
              }}
              type="button"
            >
              Remove
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={handleTrainModel}
            disabled={isTraining || !trainingFile}
          >
            {isTraining ? 'Training...' : 'Train Model'}
          </button>
          {trainingStatus && (
            <div className="small" style={{
              color: trainingStatus.includes('✅') ? '#10b981' :
                trainingStatus.includes('⚠️') ? '#f59e0b' : '#ef4444',
              fontWeight: '500'
            }}>
              {trainingStatus}
            </div>
          )}
        </div>

        {trainingMetrics && (
          <div style={{
            marginTop: '20px',
            padding: '24px',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <h3 style={{ fontSize: '15px', marginBottom: '16px', fontWeight: '600', color: '#f1f5f9' }}>Training Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div>
                <div className="small muted">Accuracy</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0b5fff' }}>
                  {(trainingMetrics.accuracy * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="small muted">Precision</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0b5fff' }}>
                  {(trainingMetrics.precision * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="small muted">Recall</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0b5fff' }}>
                  {(trainingMetrics.recall * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="small muted">F1-Score</div>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#0b5fff' }}>
                  {(trainingMetrics.f1 * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            {trainingMetrics.confusion_matrix && (
              <div style={{ marginTop: '16px' }}>
                <div className="small muted" style={{ marginBottom: '8px' }}>Confusion Matrix</div>
                <div style={{
                  display: 'inline-block',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  <div>True Neg: {trainingMetrics.confusion_matrix[0]?.[0] || 0} | False Pos: {trainingMetrics.confusion_matrix[0]?.[1] || 0}</div>
                  <div>False Neg: {trainingMetrics.confusion_matrix[1]?.[0] || 0} | True Pos: {trainingMetrics.confusion_matrix[1]?.[1] || 0}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {modelStatus && modelStatus.is_trained && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <div className="small" style={{ color: '#34d399', fontWeight: '500' }}>
              ✅ Model is active and will be used for scoring resumes. Model scores will now vary based on ML predictions instead of the 50% fallback.
            </div>
          </div>
        )}
      </div>

      <footer style={{ marginTop: '18px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
        This is a React frontend — connected to FastAPI backend at <span>{API_BASE}</span>
      </footer>
    </div>
  )
}

export default App

