'use client'

import { useState, useEffect, useCallback } from 'react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001'

interface JobStatus {
  job_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  catalog_url: string
  start_page: number
  end_page: number
  pages_done: number
  pages_total: number
  message: string
  created_at: string
  completed_at?: string
  zip_available: boolean
  pdf_available: boolean
  error?: string
  result?: {
    success: boolean
    total_available: number
    downloaded: number
    skipped: number
    errors: string[]
  }
}

export default function Home() {
  const [catalogUrl, setCatalogUrl] = useState('')
  const [startPage, setStartPage] = useState(1)
  const [endPage, setEndPage] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)

  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch job status')
      }
      const status: JobStatus = await response.json()
      setJobStatus(status)

      // Continue polling if job is still running
      if (status.status === 'queued' || status.status === 'running') {
        setTimeout(() => pollJobStatus(id), 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch job status')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setJobId(null)
    setJobStatus(null)

    try {
      const response = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          catalog_url: catalogUrl,
          start_page: startPage,
          end_page: endPage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create job')
      }

      setJobId(data.job_id)
      pollJobStatus(data.job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadZip = () => {
    if (jobId) {
      window.location.href = `${API_BASE_URL}/jobs/${jobId}/download.zip`
    }
  }

  const handleDownloadPdf = () => {
    if (jobId) {
      window.location.href = `${API_BASE_URL}/jobs/${jobId}/download.pdf`
    }
  }

  const progressPercent = jobStatus
    ? Math.round((jobStatus.pages_done / jobStatus.pages_total) * 100)
    : 0

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">NARA Image Scraper</h1>
      <p className="text-gray-600 mb-8">
        Download images from the National Archives catalog
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          <label htmlFor="catalogUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Catalog URL
          </label>
          <input
            type="url"
            id="catalogUrl"
            value={catalogUrl}
            onChange={(e) => setCatalogUrl(e.target.value)}
            placeholder="https://catalog.archives.gov/id/178788901"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter a NARA catalog URL (e.g., https://catalog.archives.gov/id/123456)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="startPage" className="block text-sm font-medium text-gray-700 mb-1">
              Start Page
            </label>
            <input
              type="number"
              id="startPage"
              value={startPage}
              onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="endPage" className="block text-sm font-medium text-gray-700 mb-1">
              End Page
            </label>
            <input
              type="number"
              id="endPage"
              value={endPage}
              onChange={(e) => setEndPage(parseInt(e.target.value) || 100)}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || (jobStatus?.status === 'queued') || (jobStatus?.status === 'running')}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Starting...' : 'Fetch Pages'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {jobStatus && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Download Progress</h2>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              jobStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
              jobStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
              jobStatus.status === 'running' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {jobStatus.status.toUpperCase()}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{jobStatus.pages_done} / {jobStatus.pages_total} pages</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  jobStatus.status === 'completed' ? 'bg-green-500' :
                  jobStatus.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Status message */}
          <div className="bg-gray-50 rounded-md p-3 mb-4">
            <p className="text-sm text-gray-700 font-mono">{jobStatus.message}</p>
          </div>

          {/* Error display */}
          {jobStatus.status === 'failed' && jobStatus.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
              {jobStatus.error}
            </div>
          )}

          {/* Result summary */}
          {jobStatus.status === 'completed' && jobStatus.result && (
            <div className="bg-gray-50 rounded-md p-3 mb-4">
              <p className="text-sm text-gray-700">
                <strong>Total available:</strong> {jobStatus.result.total_available} |{' '}
                <strong>Downloaded:</strong> {jobStatus.result.downloaded} |{' '}
                <strong>Skipped:</strong> {jobStatus.result.skipped}
              </p>
              {jobStatus.result.errors.length > 0 && (
                <p className="text-sm text-red-600 mt-1">
                  {jobStatus.result.errors.length} error(s) occurred
                </p>
              )}
            </div>
          )}

          {/* Download buttons */}
          {jobStatus.status === 'completed' && (
            <div className="flex gap-3">
              {jobStatus.zip_available && (
                <button
                  onClick={handleDownloadZip}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Download ZIP
                </button>
              )}
              {jobStatus.pdf_available && (
                <button
                  onClick={handleDownloadPdf}
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
                >
                  Download PDF
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>
          Data from the{' '}
          <a
            href="https://catalog.archives.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            National Archives Catalog
          </a>
        </p>
      </footer>
    </main>
  )
}
