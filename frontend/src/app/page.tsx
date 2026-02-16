'use client'

import { useState, useCallback, useMemo } from 'react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001'

interface PageRange {
  id: string
  startPage: string
  endPage: string
}

interface JobStatus {
  job_id: string
  batch_id?: string
  range_index?: number
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

interface BatchStatus {
  batch_id: string
  status: 'running' | 'completed' | 'completed_with_errors'
  catalog_url: string
  ranges: Array<{ start_page: number; end_page: number }>
  job_ids: string[]
  jobs: JobStatus[]
  created_at: string
  completed_at?: string
  combined_pdf_available: boolean
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center hover:bg-blue-200 transition-colors ml-2"
      >
        i
      </button>
      {show && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [catalogUrl, setCatalogUrl] = useState('')
  const [ranges, setRanges] = useState<PageRange[]>([
    { id: '1', startPage: '1', endPage: '100' }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)

  // Check if all ranges are valid
  const rangesValidation = useMemo(() => {
    const errors: Record<string, string> = {}
    let totalPages = 0

    for (const range of ranges) {
      const startStr = range.startPage.trim()
      const endStr = range.endPage.trim()
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      // Check for empty or non-numeric input
      if (startStr === '' || isNaN(start)) {
        errors[range.id] = 'Start page required'
        continue
      }
      if (endStr === '' || isNaN(end)) {
        errors[range.id] = 'End page required'
        continue
      }
      // Start must be >= 1
      if (start < 1) {
        errors[range.id] = 'Start must be at least 1'
        continue
      }
      // End must be >= start (strictly increasing within range)
      if (end < start) {
        errors[range.id] = 'End must be >= start'
        continue
      }
      // Valid range - add to total
      totalPages += end - start + 1
    }

    if (totalPages > 800) {
      errors['_total'] = `Total pages (${totalPages}) exceeds maximum of 800`
    }

    return {
      errors,
      isValid: Object.keys(errors).length === 0,
      totalPages
    }
  }, [ranges])

  const addRange = () => {
    const lastRange = ranges[ranges.length - 1]
    const lastEnd = parseInt(lastRange?.endPage) || 0
    const newStart = lastEnd > 0 ? lastEnd + 1 : 1
    setRanges([
      ...ranges,
      { id: Date.now().toString(), startPage: String(newStart), endPage: String(newStart + 99) }
    ])
  }

  const removeRange = (id: string) => {
    if (ranges.length > 1) {
      setRanges(ranges.filter(r => r.id !== id))
    }
  }

  const updateRange = (id: string, field: 'startPage' | 'endPage', value: string) => {
    // Allow empty string and numbers only
    if (value !== '' && !/^\d*$/.test(value)) return

    setRanges(ranges.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ))
  }

  const pollBatchStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/batch/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch batch status')
      }
      const status: BatchStatus = await response.json()
      setBatchStatus(status)

      // Continue polling if batch is still running
      if (status.status === 'running') {
        setTimeout(() => pollBatchStatus(id), 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch batch status')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!rangesValidation.isValid) {
      setError('Please fix the range errors before submitting')
      return
    }

    setLoading(true)
    setError(null)
    setBatchId(null)
    setBatchStatus(null)

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog_url: catalogUrl,
          ranges: ranges.map(r => ({
            start_page: parseInt(r.startPage),
            end_page: parseInt(r.endPage)
          }))
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create batch job')
      }

      setBatchId(data.batch_id)
      pollBatchStatus(data.batch_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadZip = (jobId: string) => {
    window.location.href = `${API_BASE_URL}/jobs/${jobId}/download.zip`
  }

  const handleDownloadPdf = (jobId: string) => {
    window.location.href = `${API_BASE_URL}/jobs/${jobId}/download.pdf`
  }

  const handleDownloadCombinedPdf = () => {
    if (batchId) {
      window.location.href = `${API_BASE_URL}/batch/${batchId}/download.pdf`
    }
  }

  const isRunning = batchStatus?.status === 'running'
  const isCompleted = batchStatus?.status === 'completed' || batchStatus?.status === 'completed_with_errors'
  const hasUrl = catalogUrl.trim() !== ''
  const canSubmit = rangesValidation.isValid && hasUrl && !loading && !isRunning
  const showProgress = batchStatus !== null

  // Determine what's blocking submission
  const getSubmitHint = () => {
    if (isRunning) return null
    if (!hasUrl && !rangesValidation.isValid) return 'Enter a catalog URL and fix range errors'
    if (!hasUrl) return 'Enter a catalog URL to enable fetch'
    if (!rangesValidation.isValid) return 'Fix range errors to enable fetch'
    return null
  }
  const submitHint = getSubmitHint()

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent mb-3">
          NARA Image Scraper
        </h1>
        <p className="text-gray-600">
          Download images from the National Archives catalog
        </p>
      </div>

      {/* Main Content - Side by Side Layout */}
      <div className={`flex flex-col ${showProgress ? 'lg:flex-row' : ''} gap-6`}>
        {/* Left Panel - Form */}
        <div className={`${showProgress ? 'lg:w-1/2' : 'max-w-2xl mx-auto w-full'}`}>
          <form onSubmit={handleSubmit} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 lg:p-8 border border-blue-100">
            {/* Catalog URL */}
            <div className="mb-6">
              <label htmlFor="catalogUrl" className="block text-sm font-semibold text-gray-700 mb-2">
                Catalog URL {!hasUrl && rangesValidation.isValid && <span className="text-red-500 font-normal">(required)</span>}
              </label>
              <input
                type="url"
                id="catalogUrl"
                value={catalogUrl}
                onChange={(e) => setCatalogUrl(e.target.value)}
                placeholder="https://catalog.archives.gov/id/178788901"
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent bg-white/50 transition-all ${
                  !hasUrl && rangesValidation.isValid
                    ? 'border-amber-400 ring-2 ring-amber-200'
                    : 'border-blue-200 focus:ring-blue-400'
                }`}
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter a NARA catalog URL (e.g., https://catalog.archives.gov/id/123456)
              </p>
            </div>

            {/* Page Ranges */}
            <div className="mb-6">
              <div className="flex items-center mb-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Page Ranges
                </label>
                <InfoTooltip text="Add multiple page ranges to download different sections. Each range gets its own ZIP file. Use 'Download Complete PDF' to combine all ranges into one PDF document in page order." />
              </div>

              <div className="space-y-3">
                {ranges.map((range, index) => {
                  const rangeError = rangesValidation.errors[range.id]
                  return (
                    <div key={range.id}>
                      <div className={`flex items-center gap-2 lg:gap-3 p-3 rounded-xl border ${
                        rangeError
                          ? 'bg-red-50/50 border-red-200'
                          : 'bg-blue-50/50 border-blue-100'
                      }`}>
                        <span className="text-sm font-medium text-blue-600 w-16 lg:w-20">Range {index + 1}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={range.startPage}
                          onChange={(e) => updateRange(range.id, 'startPage', e.target.value)}
                          placeholder="Start"
                          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white text-sm ${
                            rangeError && !range.startPage
                              ? 'border-red-300 focus:ring-red-400'
                              : 'border-blue-200 focus:ring-blue-400'
                          }`}
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={range.endPage}
                          onChange={(e) => updateRange(range.id, 'endPage', e.target.value)}
                          placeholder="End"
                          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white text-sm ${
                            rangeError && !range.endPage
                              ? 'border-red-300 focus:ring-red-400'
                              : 'border-blue-200 focus:ring-blue-400'
                          }`}
                        />
                        {ranges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRange(range.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove range"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {rangeError && (
                        <p className="text-xs text-red-500 mt-1 ml-1">{rangeError}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Total pages feedback */}
              {rangesValidation.errors['_total'] ? (
                <p className="text-xs text-red-500 mt-2">{rangesValidation.errors['_total']}</p>
              ) : rangesValidation.isValid && rangesValidation.totalPages > 0 ? (
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {rangesValidation.totalPages} pages across {ranges.length} range{ranges.length > 1 ? 's' : ''}
                </p>
              ) : null}

              <button
                type="button"
                onClick={addRange}
                className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Another Range
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Starting...' : isRunning ? 'Processing...' : `Fetch ${ranges.length} Range${ranges.length > 1 ? 's' : ''}`}
            </button>

            {/* Validation hint */}
            {submitHint && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                {submitHint}
              </p>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mt-4">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Right Panel - Progress */}
        {showProgress && (
          <div className="lg:w-1/2 space-y-4">
            {/* Completion Banner */}
            {isCompleted && (
              <div className={`rounded-2xl shadow-xl p-6 text-white ${
                batchStatus.jobs.length > 1
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  : 'bg-gradient-to-r from-emerald-400 to-teal-500'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {batchStatus.jobs.length > 1 ? 'All Ranges Complete!' : 'Download Complete!'}
                      {batchStatus.status === 'completed_with_errors' && (
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">Some errors</span>
                      )}
                    </h3>
                    <p className={`text-sm mt-1 ${batchStatus.jobs.length > 1 ? 'text-blue-100' : 'text-emerald-100'}`}>
                      {batchStatus.jobs.length > 1
                        ? 'Download individual ZIPs below, or get everything as one PDF'
                        : 'Your images are ready to download below'}
                    </p>
                  </div>
                  {batchStatus.jobs.length > 1 && (
                    <InfoTooltip text="ZIP files contain images for each range separately. The Complete PDF combines all images from all ranges into a single document, ordered by range then page number." />
                  )}
                </div>

                {/* Combined PDF button for multiple ranges */}
                {batchStatus.jobs.length > 1 && (
                  batchStatus.combined_pdf_available ? (
                    <button
                      onClick={handleDownloadCombinedPdf}
                      className="w-full bg-white text-blue-600 py-3 px-6 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-md"
                    >
                      Download Complete PDF (All Ranges)
                    </button>
                  ) : (
                    <div className="w-full bg-white/20 text-white/80 py-3 px-6 rounded-xl text-center text-sm">
                      Combined PDF not available (check if img2pdf is installed)
                    </div>
                  )
                )}
              </div>
            )}

            {/* Individual Range Cards */}
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
              {batchStatus.jobs.map((job, index) => (
                <div key={job.job_id} className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      Range {index + 1}: Pages {job.start_page} - {job.end_page}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      job.status === 'failed' ? 'bg-red-100 text-red-700' :
                      job.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{job.pages_done} / {job.pages_total} pages</span>
                      <span>{Math.round((job.pages_done / job.pages_total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          job.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                          job.status === 'failed' ? 'bg-red-500' :
                          'bg-gradient-to-r from-blue-400 to-cyan-500'
                        }`}
                        style={{ width: `${Math.round((job.pages_done / job.pages_total) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Status message */}
                  <p className="text-xs text-gray-500 font-mono mb-2 truncate">{job.message}</p>

                  {/* Error */}
                  {job.status === 'failed' && job.error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-2 py-1.5 rounded-lg mb-2">
                      {job.error}
                    </div>
                  )}

                  {/* Download buttons */}
                  {job.status === 'completed' && (
                    <div className="flex gap-2">
                      {job.zip_available && (
                        <button
                          onClick={() => handleDownloadZip(job.job_id)}
                          className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-500 text-white py-1.5 px-3 rounded-lg text-xs font-medium hover:from-emerald-500 hover:to-teal-600 transition-all shadow-sm"
                        >
                          Download ZIP
                        </button>
                      )}
                      {job.pdf_available && (
                        <button
                          onClick={() => handleDownloadPdf(job.job_id)}
                          className="flex-1 bg-gradient-to-r from-blue-400 to-cyan-500 text-white py-1.5 px-3 rounded-lg text-xs font-medium hover:from-blue-500 hover:to-cyan-600 transition-all shadow-sm"
                        >
                          Download PDF
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
