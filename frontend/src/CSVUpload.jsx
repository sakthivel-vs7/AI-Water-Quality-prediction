
import { useState } from 'react'
import {
  FileSpreadsheet,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'

import { uploadCSV } from './api'

const requiredHeaders = [
  'station_id',
  'recorded_at',
  'ph',
  'temperature',
  'turbidity',
  'dissolved_oxygen',
  'conductivity',
  'tds',
  'orp',
]

// Handles CSV values containing quoted commas.
function parseCSVLine(line) {
  const values = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

function CSVUpload({ onUploadComplete }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [headers, setHeaders] = useState([])
  const [recordCount, setRecordCount] = useState(0)
  const [fileError, setFileError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]

    setSelectedFile(null)
    setPreview([])
    setHeaders([])
    setRecordCount(0)
    setFileError('')
    setUploadError('')
    setResult(null)

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Please select a CSV file.')
      event.target.value = ''
      return
    }

    try {
      const content = (await file.text()).replace(/^\uFEFF/, '')
      const lines = content
        .split(/\r?\n/)
        .filter(line => line.trim() !== '')

      if (lines.length < 2) {
        throw new Error('The CSV file must contain a header and at least one data row.')
      }

      const fileHeaders = parseCSVLine(lines[0]).map(header =>
        header.trim().toLowerCase()
      )

      const missingHeaders = requiredHeaders.filter(
        header => !fileHeaders.includes(header)
      )

      if (missingHeaders.length > 0) {
        throw new Error(
          `Missing required columns: ${missingHeaders.join(', ')}`
        )
      }

      const dataRows = lines.slice(1).map(line => {
        const values = parseCSVLine(line)
        return Object.fromEntries(
          fileHeaders.map((header, index) => [
            header,
            values[index] ?? '',
          ])
        )
      })

      setSelectedFile(file)
      setHeaders(fileHeaders)
      setRecordCount(dataRows.length)
      setPreview(dataRows.slice(0, 5))
    } catch (err) {
      setFileError(err.message || 'Unable to read this CSV file.')
      event.target.value = ''
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a valid CSV file first.')
      return
    }

    setUploading(true)
    setUploadError('')
    setResult(null)

    try {
      const response = await uploadCSV(selectedFile)
      setResult(response)

      if (Number(response.inserted_records) > 0) {
        await onUploadComplete?.()
      }
    } catch (err) {
      const detail = err.response?.data?.detail

      setUploadError(
        Array.isArray(detail)
          ? detail.map(item => item.msg).join(', ')
          : detail || err.message || 'CSV upload failed.'
      )
    } finally {
      setUploading(false)
    }
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setPreview([])
    setHeaders([])
    setRecordCount(0)
    setFileError('')
    setUploadError('')
    setResult(null)

    const input = document.getElementById('aquasense-csv-input')
    if (input) input.value = ''
  }

  return (
    <section>
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">
          <FileSpreadsheet size={13} />
          AquaSense workspace
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white">
          CSV data upload
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Import sensor readings into the AquaSense database.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
            <Upload size={21} />
          </div>

          <div>
            <h3 className="font-semibold text-white">
              Select your dataset
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Choose a CSV file containing sensor readings.
            </p>
          </div>
        </div>

        <label
          htmlFor="aquasense-csv-input"
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] px-5 py-10 text-center transition hover:border-cyan-300/60 hover:bg-cyan-400/[0.07]"
        >
          <FileSpreadsheet size={34} className="mb-3 text-cyan-300" />

          <span className="text-sm font-semibold text-white">
            Click to select a CSV file
          </span>

          <span className="mt-2 text-xs text-slate-500">
            CSV format only
          </span>

          <input
            id="aquasense-csv-input"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {selectedFile && (
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <FileText size={20} className="shrink-0 text-cyan-300" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {selectedFile.name}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB · {recordCount} data rows
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <CheckCircle2 size={14} />
              File validated
            </span>
          </div>
        )}

        {fileError && (
          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-xs text-rose-200">
            <AlertTriangle size={15} className="mr-2 inline" />
            {fileError}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploading
              ? <Loader2 size={15} className="animate-spin" />
              : <Upload size={15} />}
            {uploading ? 'Uploading...' : 'Upload to database'}
          </button>

          <button
            onClick={resetUpload}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-40"
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>

        {uploadError && (
          <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-xs text-rose-200">
            <XCircle size={15} className="mr-2 inline" />
            {uploadError}
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Dataset preview
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Showing the first {preview.length} of {recordCount} records.
              </p>
            </div>

            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              Preview only
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
                  {headers.map(header => (
                    <th key={header} className="px-3 py-3 font-semibold">
                      {header.replaceAll('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {preview.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-white/[0.05] text-slate-300"
                  >
                    {headers.map(header => (
                      <td key={header} className="whitespace-nowrap px-3 py-3">
                        {row[header] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-[#0d1b2d] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
              <CheckCircle2 size={21} />
            </div>

            <div>
              <h3 className="font-semibold text-white">
                CSV processing completed
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {result.message || 'The backend has processed your CSV file.'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ResultMetric
              label="Inserted records"
              value={result.inserted_records ?? 0}
              tone="green"
            />
            <ResultMetric
              label="Generated alerts"
              value={result.generated_alerts ?? 0}
              tone="cyan"
            />
            <ResultMetric
              label="Failed records"
              value={result.failed_records ?? 0}
              tone="rose"
            />
          </div>

          {Array.isArray(result.errors) && result.errors.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-amber-300">
                <AlertTriangle size={15} />
                Record processing errors
              </p>

              <ul className="space-y-2 text-xs leading-5 text-slate-300">
                {result.errors.map((item, index) => (
                  <li key={index}>
                    {typeof item === 'string'
                      ? item
                      : JSON.stringify(item)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
        <p className="text-xs font-semibold text-cyan-200">
          Required CSV columns
        </p>
        <p className="mt-2 break-words text-[11px] leading-6 text-slate-400">
          {requiredHeaders.join(', ')}
        </p>
        <p className="mt-3 text-[10px] leading-5 text-slate-500">
          The preview checks the required column names. The backend performs the actual record processing and reports row-level errors.
        </p>
      </div>
    </section>
  )
}

function ResultMetric({ label, value, tone }) {
  const styles = {
    green: 'text-emerald-300',
    cyan: 'text-cyan-300',
    rose: 'text-rose-300',
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${styles[tone]}`}>
        {value}
      </p>
    </div>
  )
}

export default CSVUpload
