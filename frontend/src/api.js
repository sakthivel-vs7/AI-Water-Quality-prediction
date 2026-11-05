
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Backend health
export const getBackendHealth = async () => {
  const response = await api.get('/api/health')
  return response.data
}

// Fetch real sensor readings from PostgreSQL
export const getSensorReadings = async () => {
  const response = await api.get('/api/readings')
  return response.data
}

// Fetch live dashboard status and station counts
export const getDashboardStatus = async () => {
  const response = await api.get('/api/dashboard/status')
  return response.data
}

// Fetch alerts, optionally filtered by status
export const getAlerts = async (status = null) => {
  const response = await api.get('/api/alerts', {
    params: status ? { status } : {},
  })
  return response.data
}

// Acknowledge an alert
export const acknowledgeAlert = async (alertId) => {
  const response = await api.post(`/api/alerts/${alertId}/acknowledge`)
  return response.data
}

// Resolve an alert
export const resolveAlert = async (alertId) => {
  const response = await api.post(`/api/alerts/${alertId}/resolve`)
  return response.data
}

// Water quality prediction
export const predictWaterQuality = async (sensorData) => {
  const response = await api.post('/api/predict', sensorData)
  return response.data
}

// Anomaly detection
export const detectAnomaly = async (sensorData) => {
  const response = await api.post('/api/anomaly-detect', sensorData)
  return response.data
}

// CSV upload
export const uploadCSV = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post(
    '/api/readings/upload-csv',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )

  return response.data
}

export default api
export const getWaterQualityForecast = async (stationId) => {
  const response = await api.get(`/api/forecast/${stationId}`);
  return response.data;
};
