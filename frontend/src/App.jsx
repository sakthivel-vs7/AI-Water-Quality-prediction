
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Activity, Bell, LayoutDashboard, MapPin, Waves, Droplets, Thermometer,
  Gauge, Menu, BrainCircuit, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Database, Check, Clock, XCircle, ChevronRight,
  Sparkles, ShieldCheck, Zap, Wind, TrendingUp, CircleDot,
  FlaskConical, FileSpreadsheet
} from 'lucide-react'

import {
  getBackendHealth,
  getSensorReadings,
  getDashboardStatus,
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  predictWaterQuality,
  detectAnomaly
} from './api'

import ReadingsChart from './ReadingsChart'
import CSVUpload from './CSVUpload'
import ForecastPage from './ForecastPage'

const initialSensorData = {
  ph: '7.2',
  temperature: '28.5',
  turbidity: '3.1',
  dissolved_oxygen: '6.8',
  conductivity: '420',
  tds: '250',
  orp: '300',
}

const statusConfig = {
  Normal: {
    pill: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
    dot: 'bg-emerald-400',
  },
  Warning: {
    pill: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
    dot: 'bg-amber-400',
  },
  Poor: {
    pill: 'bg-orange-400/10 text-orange-300 ring-orange-400/20',
    dot: 'bg-orange-400',
  },
  Critical: {
    pill: 'bg-rose-400/10 text-rose-300 ring-rose-400/20',
    dot: 'bg-rose-400',
  },
  'No Data': {
    pill: 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
    dot: 'bg-slate-500',
  },
  Anomaly: {
    pill: 'bg-rose-400/10 text-rose-300 ring-rose-400/20',
    dot: 'bg-rose-400',
  },
}

const severityConfig = {
  Low: 'bg-sky-400/10 text-sky-300 ring-sky-400/20',
  Medium: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  High: 'bg-orange-400/10 text-orange-300 ring-orange-400/20',
  Critical: 'bg-rose-400/10 text-rose-300 ring-rose-400/20',
}

const navItems = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Stations', icon: MapPin },
  { name: 'CSV Upload', icon: FileSpreadsheet },
  { name: 'Predictions', icon: BrainCircuit },
  { name: 'Forecast', icon: TrendingUp },
  { name: 'Anomaly Detection', icon: Activity },
  { name: 'Alerts', icon: Bell },
]

const sensorLabels = {
  ph: { label: 'pH', unit: 'pH' },
  temperature: { label: 'Temperature', unit: '°C' },
  turbidity: { label: 'Turbidity', unit: 'NTU' },
  dissolved_oxygen: { label: 'Dissolved oxygen', unit: 'mg/L' },
  conductivity: { label: 'Conductivity', unit: 'µS/cm' },
  tds: { label: 'Total dissolved solids', unit: 'ppm' },
  orp: { label: 'ORP', unit: 'mV' },
}

function App() {
  const [activePage, setActivePage] = useState('Overview')
  const [selectedStation, setSelectedStation] = useState('All Stations')
  const [menuOpen, setMenuOpen] = useState(false)

  const [backendStatus, setBackendStatus] = useState('Checking...')
  const [sensorData, setSensorData] = useState(initialSensorData)

  const [prediction, setPrediction] = useState(null)
  const [anomaly, setAnomaly] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [readings, setReadings] = useState([])
  const [readingsLoading, setReadingsLoading] = useState(false)
  const [readingsError, setReadingsError] = useState('')

  const [dashboard, setDashboard] = useState(null)
  const [dashboardError, setDashboardError] = useState('')

  const [alerts, setAlerts] = useState([])
  const [alertsError, setAlertsError] = useState('')
  const [alertsLoading, setAlertsLoading] = useState(false)

  const [alertFilter, setAlertFilter] = useState('All')
  const [actionLoading, setActionLoading] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadReadings = useCallback(async (showLoader = true) => {
    if (showLoader) setReadingsLoading(true)
    setReadingsError('')

    try {
      const data = await getSensorReadings()
      setReadings(Array.isArray(data) ? data : [])
    } catch (err) {
      setReadingsError(
        err.response?.data?.detail ||
        err.message ||
        'Unable to fetch database readings.'
      )
    } finally {
      if (showLoader) setReadingsLoading(false)
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    setDashboardError('')

    try {
      const data = await getDashboardStatus()
      setDashboard(data)
      setLastUpdated(new Date())
    } catch (err) {
      setDashboardError(
        err.response?.data?.detail ||
        err.message ||
        'Unable to fetch dashboard status.'
      )
    }
  }, [])

  const loadAlerts = useCallback(async (showLoader = false) => {
    if (showLoader) setAlertsLoading(true)
    setAlertsError('')

    try {
      const data = await getAlerts()
      setAlerts(Array.isArray(data) ? data : [])
    } catch (err) {
      setAlertsError(
        err.response?.data?.detail ||
        err.message ||
        'Unable to fetch alerts.'
      )
    } finally {
      if (showLoader) setAlertsLoading(false)
    }
  }, [])

  const checkBackend = useCallback(async () => {
    try {
      await getBackendHealth()
      setBackendStatus('Connected')
    } catch {
      setBackendStatus('Disconnected')
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      checkBackend(),
      loadDashboard(),
      loadReadings(false),
      loadAlerts(),
    ])
  }, [checkBackend, loadDashboard, loadReadings, loadAlerts])

  useEffect(() => {
    refreshAll()

    const interval = setInterval(refreshAll, 10000)

    return () => clearInterval(interval)
  }, [refreshAll])

  const updateSensor = (event) => {
    setSensorData(previous => ({
      ...previous,
      [event.target.name]: event.target.value,
    }))
  }

  const getNumericData = () => {
    const values = Object.values(sensorData)

    if (values.some(value => value.trim() === '')) {
      throw new Error('Please fill in all sensor values.')
    }

    const numericValues = values.map(Number)

    if (numericValues.some(value => !Number.isFinite(value))) {
      throw new Error('Please enter valid numeric values.')
    }

    return {
      ph: numericValues[0],
      temperature: numericValues[1],
      turbidity: numericValues[2],
      dissolved_oxygen: numericValues[3],
      conductivity: numericValues[4],
      tds: numericValues[5],
      orp: numericValues[6],
    }
  }

  const runPrediction = async () => {
    setLoading(true)
    setError('')
    setPrediction(null)
    setAnomaly(null)

    try {
      const result = await predictWaterQuality(getNumericData())
      setPrediction(result)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Prediction failed. Check backend connection.'
      )
    } finally {
      setLoading(false)
    }
  }

  const runAnomalyDetection = async () => {
    setLoading(true)
    setError('')
    setAnomaly(null)
    setPrediction(null)

    try {
      const result = await detectAnomaly(getNumericData())
      setAnomaly(result)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Anomaly detection failed. Check backend connection.'
      )
    } finally {
      setLoading(false)
    }
  }

  const resetResults = () => {
    setPrediction(null)
    setAnomaly(null)
    setError('')
    setSensorData(initialSensorData)
  }

  const handleAcknowledge = async (alertId) => {
    setActionLoading(alertId)
    setAlertsError('')

    try {
      await acknowledgeAlert(alertId)
      await loadAlerts()
    } catch (err) {
      setAlertsError(
        err.response?.data?.detail ||
        err.message ||
        'Unable to acknowledge alert.'
      )
    } finally {
      setActionLoading(null)
    }
  }

  const handleResolve = async (alertId) => {
    setActionLoading(alertId)
    setAlertsError('')

    try {
      await resolveAlert(alertId)

      setAlerts(current =>
        current.map(alert =>
          String(alert.id) === String(alertId)
            ? {
                ...alert,
                status: 'Resolved',
                resolved_at: new Date().toISOString(),
              }
            : alert
        )
      )

      await refreshAll()
    } catch (err) {
      setAlertsError(
        err.response?.data?.detail ||
        err.message ||
        'Unable to resolve alert.'
      )
    } finally {
      setActionLoading(null)
    }
  }

  const stations = dashboard?.stations || []
  console.log("Dashboard stations:", dashboard?.stations);
console.log("Forecast stations:", stations);
  const counts = dashboard?.counts || {}
  const totalStations = dashboard?.total_stations ?? stations.length

  const openAlerts = alerts.filter(
    alert =>
      String(alert.status || '').toLowerCase() !== 'resolved'
  ).length

  const stationNameById = useMemo(
    () => Object.fromEntries(
      stations.map(station => [
        station.station_id,
        station.station_name,
      ])
    ),
    [stations]
  )

  const filteredStations = selectedStation === 'All Stations'
    ? stations
    : stations.filter(
        station => station.station_name === selectedStation
      )

  const filteredAlerts = alertFilter === 'All'
    ? alerts
    : alerts.filter(
        alert =>
          String(alert.status || '').toLowerCase() ===
          alertFilter.toLowerCase()
      )

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">

      {menuOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-white/[0.07] bg-[#0b1728] px-5 py-6 transition-transform duration-300 lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <Waves size={24} />
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              AquaSense <span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Water intelligence
            </p>
          </div>
        </div>

        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
          Workspace
        </div>

        <nav className="mt-3 space-y-1.5">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => {
                setActivePage(name)
                setMenuOpen(false)
                setError('')
              }}
              className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-all ${
                activePage === name
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon
                size={18}
                className={
                  activePage === name
                    ? 'text-cyan-300'
                    : 'text-slate-500 group-hover:text-slate-300'
                }
              />

              <span>{name}</span>

              {name === 'Alerts' && openAlerts > 0 && (
                <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {openAlerts}
                </span>
              )}

              {activePage === name && (
                <ChevronRight
                  size={15}
                  className="ml-auto text-cyan-400"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/[0.04] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <Sparkles size={18} />
          </div>

          <p className="text-sm font-semibold text-white">
            AI monitoring system
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Sensor analytics, prediction and anomaly detection in one workspace.
          </p>

          <div className="mt-4 border-t border-white/[0.07] pt-3 text-[10px] text-slate-500">
            INTERNSHIP PROJECT · 2026
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-[272px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#07111f]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-xl border border-white/10 p-2 text-slate-300 lg:hidden"
            >
              <Menu size={19} />
            </button>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                AquaSense AI / Workspace
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-white">
                {activePage}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div
              className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold sm:flex ${
                backendStatus === 'Connected'
                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                  : backendStatus === 'Checking...'
                    ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                    : 'border-rose-400/20 bg-rose-400/10 text-rose-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  backendStatus === 'Connected'
                    ? 'bg-emerald-400'
                    : backendStatus === 'Checking...'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                }`}
              />
              {backendStatus}
            </div>

            <button
              onClick={refreshAll}
              title="Refresh dashboard"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-300"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setActivePage('Alerts')}
              className="relative rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-slate-300 transition hover:text-white"
            >
              <Bell size={17} />

              {openAlerts > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {openAlerts}
                </span>
              )}
            </button>

            <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-xs font-bold text-cyan-200 sm:flex">
              AS
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-4 sm:p-7 lg:p-9">

          {activePage === 'Overview' && (
            <OverviewPage
              normal={counts.Normal || 0}
              warning={counts.Warning || 0}
              poor={counts.Poor || 0}
              critical={counts.Critical || 0}
              noData={counts['No Data'] || 0}
              totalStations={totalStations}
              filteredStations={filteredStations}
              stations={stations}
              selectedStation={selectedStation}
              setSelectedStation={setSelectedStation}
              readings={readings}
              readingsLoading={readingsLoading}
              readingsError={readingsError}
              loadReadings={loadReadings}
              dashboardError={dashboardError}
              lastUpdated={lastUpdated}
              dashboardNote={dashboard?.status_note}
              alerts={alerts}
            />
          )}

          {activePage === 'Stations' && (
            <section>
              <PageHeading
                title="Monitoring stations"
                subtitle="Explore registered stations and their latest sensor measurements."
              />

              {dashboardError && (
                <ErrorMessage message={dashboardError} />
              )}

              {stations.length === 0 ? (
                <EmptyState message="No monitoring stations are available." />
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {stations.map(station => (
                    <StationCard
                      key={station.station_id}
                      station={station}
                    />
                  ))}
                </div>
              )}

              <PrototypeNotice />
            </section>
          )}

          {activePage === 'CSV Upload' && (
            <CSVUpload onUploadComplete={refreshAll} />
          )}

          {activePage === 'Predictions' && (
            <section>
              <PageHeading
                title="AI water quality prediction"
                subtitle="Enter sensor values and run the trained classification model."
              />

              <SensorForm
                sensorData={sensorData}
                updateSensor={updateSensor}
                loading={loading}
                onSubmit={runPrediction}
                onReset={resetResults}
                buttonText="Run prediction"
                buttonIcon={BrainCircuit}
              />

              {error && <ErrorMessage message={error} />}

              {prediction && (
                <ResultPanel
                  title="Prediction result"
                  status={prediction.predicted_status}
                  mlStatus={prediction.ml_predicted_status}
                  probabilities={prediction.probabilities}
                  parameterStatus={prediction.parameter_status}
                  violations={prediction.violations}
                  sensorData={sensorData}
                  note={prediction.model_note}
                />
              )}

              <PrototypeNotice />
            </section>
          )}

          {activePage === 'Forecast' && (
            <ForecastPage stations={stations} />
          )}

          {activePage === 'Anomaly Detection' && (
            <section>
              <PageHeading
                title="Anomaly detection"
                subtitle="Check sensor patterns for unusual combinations using the Isolation Forest model."
              />

              <SensorForm
                sensorData={sensorData}
                updateSensor={updateSensor}
                loading={loading}
                onSubmit={runAnomalyDetection}
                onReset={resetResults}
                buttonText="Detect anomaly"
                buttonIcon={Activity}
              />

              {error && <ErrorMessage message={error} />}

              {anomaly && (
                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
                      <Activity size={21} />
                    </div>

                    <div>
                      <h3 className="font-semibold text-white">
                        Anomaly analysis result
                      </h3>
                      <p className="text-xs text-slate-500">
                        Model response
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/[0.03] p-4">
                      <p className="text-xs text-slate-500">
                        Detection status
                      </p>
                      <p className="mt-2 text-xl font-bold text-white">
                        {anomaly.anomaly_status}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] p-4">
                      <p className="text-xs text-slate-500">
                        Anomaly score
                      </p>
                      <p className="mt-2 text-xl font-bold text-white">
                        {anomaly.anomaly_score ?? '—'}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-slate-400">
                    {anomaly.model_note}
                  </p>
                </div>
              )}

              <PrototypeNotice />
            </section>
          )}

          {activePage === 'Alerts' && (
            <AlertsPage
              alerts={filteredAlerts}
              allAlerts={alerts}
              alertFilter={alertFilter}
              setAlertFilter={setAlertFilter}
              loading={alertsLoading}
              error={alertsError}
              loadAlerts={() => loadAlerts(true)}
              actionLoading={actionLoading}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              stationNameById={stationNameById}
            />
          )}

        </div>
      </main>
    </div>
  )
}

function OverviewPage({
  normal, warning, poor, critical, noData,
  totalStations, filteredStations, stations,
  selectedStation, setSelectedStation,
  readings, readingsLoading, readingsError,
  loadReadings, dashboardError, lastUpdated,
  dashboardNote, alerts
}) {
  const unresolvedAlerts = alerts.filter(
    alert =>
      String(alert.status || '').toLowerCase() !== 'resolved'
  )

  const activeAlerts = unresolvedAlerts.length

  return (
    <>
      <div className="relative mb-7 overflow-hidden rounded-3xl border border-cyan-300/10 bg-gradient-to-br from-[#10314a] via-[#10283e] to-[#17234a] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-100px] right-[25%] h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Intelligent water monitoring
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Know your water.<br />
              <span className="text-cyan-300">
                Understand every signal.
              </span>
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              A unified view of station conditions, sensor trends and AI-powered insights across your monitoring network.
            </p>
          </div>

          <div className="relative flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Stations online
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {totalStations}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Active alerts
              </p>
              <p className="mt-1 text-2xl font-bold text-cyan-300">
                {activeAlerts}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-2">
            <RefreshCw size={12} />
            Auto-refresh: 10 seconds
          </span>

          <span className="flex items-center gap-2">
            <Clock size={12} />
            Last updated: {lastUpdated
              ? lastUpdated.toLocaleTimeString()
              : 'Waiting for data'}
          </span>
        </div>
      </div>

      {dashboardError && (
        <ErrorMessage message={dashboardError} />
      )}

      <div className="mb-3 flex items-center justify-between">
        <SectionTitle
          title="Network snapshot"
          subtitle="Current status across registered monitoring stations"
        />

        <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:inline">
          Live overview
        </span>
      </div>

      <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard title="Total stations" value={totalStations} subtitle="Registered in network" icon={MapPin} tone="cyan" />
        <MetricCard title="Normal" value={normal} subtitle="Within configured limits" icon={ShieldCheck} tone="green" />
        <MetricCard title="Warning" value={warning} subtitle="Needs attention" icon={AlertTriangle} tone="amber" />
        <MetricCard title="Poor / Critical" value={poor + critical} subtitle={`${poor} poor · ${critical} critical`} icon={Activity} tone="rose" />
        <MetricCard title="No data" value={noData} subtitle="Awaiting sensor readings" icon={Database} tone="slate" />
      </div>

      <div className="mb-7 grid grid-cols-1 gap-5 2xl:grid-cols-[1.55fr_1fr]">
        <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <SectionTitle title="Sensor analytics" subtitle="Historical readings stored in your database" />
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-slate-400">
              Time-series data
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartFrame>
              <ReadingsChart readings={readings} dataKey="ph" title="pH trend" unit="pH" stroke="#22d3ee" />
            </ChartFrame>

            <ChartFrame>
              <ReadingsChart readings={readings} dataKey="tds" title="TDS trend" unit="ppm" stroke="#34d399" />
            </ChartFrame>

            <div className="xl:col-span-2">
              <ChartFrame>
                <ReadingsChart readings={readings} dataKey="temperature" title="Temperature trend" unit="°C" stroke="#fb923c" />
              </ChartFrame>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
          <SectionTitle title="Station distribution" subtitle="Status breakdown of the network" />

          <div className="mt-7 flex items-center gap-5">
            <div
              className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#34d399 0 ${totalStations ? normal / totalStations * 100 : 0}%, #fbbf24 0 ${totalStations ? (normal + warning) / totalStations * 100 : 0}%, #fb923c 0 ${totalStations ? (normal + warning + poor) / totalStations * 100 : 0}%, #fb7185 0 ${totalStations ? (normal + warning + poor + critical) / totalStations * 100 : 0}%, #475569 0 100%)`,
              }}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#0d1b2d]">
                <span className="text-3xl font-bold text-white">{totalStations}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-500">Stations</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <Legend color="bg-emerald-400" label="Normal" value={normal} />
              <Legend color="bg-amber-400" label="Warning" value={warning} />
              <Legend color="bg-orange-400" label="Poor" value={poor} />
              <Legend color="bg-rose-400" label="Critical" value={critical} />
              <Legend color="bg-slate-600" label="No data" value={noData} />
            </div>
          </div>

          <div className="mt-7 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.06] p-4">
            <div className="flex items-center gap-2 text-cyan-300">
              <BrainCircuit size={17} />
              <span className="text-xs font-semibold">AI analysis tools</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Run water-quality classification and anomaly detection from the workspace navigation.
            </p>
          </div>
        </section>
      </div>

      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <SectionTitle title="Monitoring stations" subtitle="Latest sensor values and configured threshold status" />
          <p className="mt-2 max-w-3xl text-[10px] leading-5 text-slate-500">
            Water-quality status is based on the latest sensor reading. Resolving an alert changes its alert status only; it does not change the measured water-quality status. A new safe sensor reading is needed for the station status to become Normal.
          </p>
        </div>

        <select
          value={selectedStation}
          onChange={event => setSelectedStation(event.target.value)}
          className="rounded-xl border border-white/10 bg-[#0d1b2d] px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-cyan-400/50"
        >
          <option className="bg-[#0d1b2d]">All Stations</option>
          {stations.map(station => (
            <option className="bg-[#0d1b2d]" key={station.station_id} value={station.station_name}>
              {station.station_name}
            </option>
          ))}
        </select>
      </div>

      {filteredStations.length === 0 ? (
        <EmptyState message="No stations match this selection." />
      ) : (
        <div className="mb-7 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredStations.map(station => (
            <StationCard
              key={station.station_id}
              station={station}
              activeAlerts={unresolvedAlerts.filter(
                alert => String(alert.station_id) === String(station.station_id)
              )}
            />
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <SectionTitle title="Database readings" subtitle="Most recent sensor records returned by the backend" />

          <button
            onClick={() => loadReadings(true)}
            disabled={readingsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/15 disabled:opacity-50"
          >
            {readingsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh records
          </button>
        </div>

        {readingsError && <ErrorMessage message={readingsError} />}

        {readingsLoading && readings.length === 0 ? (
          <LoadingMessage message="Loading database readings..." />
        ) : readings.length === 0 ? (
          <EmptyState message="No sensor readings found in the database." />
        ) : (
          <>
            <div className="mb-4 text-xs text-slate-500">
              <span className="text-xl font-bold text-white">{readings.length}</span> records available
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
                    {['ID', 'Station', 'Recorded at', 'pH', 'Temp °C', 'Turbidity', 'DO', 'TDS'].map(label => (
                      <th key={label} className="px-3 py-3 font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {readings.map(reading => (
                    <tr key={reading.id} className="border-b border-white/[0.05] text-slate-300 transition hover:bg-white/[0.025]">
                      <td className="px-3 py-3 text-slate-500">{reading.id}</td>
                      <td className="px-3 py-3">
                        {stations.find(station => station.station_id === reading.station_id)?.station_name || `Station ${reading.station_id}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {reading.recorded_at ? new Date(reading.recorded_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-3">{reading.ph ?? '—'}</td>
                      <td className="px-3 py-3">{reading.temperature ?? '—'}</td>
                      <td className="px-3 py-3">{reading.turbidity ?? '—'}</td>
                      <td className="px-3 py-3">{reading.dissolved_oxygen ?? '—'}</td>
                      <td className="px-3 py-3">{reading.tds ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <p className="mt-5 text-[10px] leading-5 text-slate-500">
        {dashboardNote || 'Prototype notice: station statuses use configurable demonstration thresholds. This dashboard is not a certified water-safety assessment.'}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard icon={Droplets} title="Water parameters" text="Monitor pH, turbidity, dissolved oxygen, temperature, conductivity and TDS." />
        <InfoCard icon={TrendingUp} title="Time-series analytics" text="Review historical sensor readings and changing parameter trends." />
        <InfoCard icon={Zap} title="AI insights" text="Explore model-based quality predictions and unusual sensor patterns." />
      </div>
    </>
  )
}

function AlertsPage({
  alerts, allAlerts, alertFilter, setAlertFilter,
  loading, error, loadAlerts, actionLoading,
  onAcknowledge, onResolve, stationNameById
}) {
  const open = allAlerts.filter(alert => String(alert.status || '').toLowerCase() === 'open').length
  const acknowledged = allAlerts.filter(alert => String(alert.status || '').toLowerCase() === 'acknowledged').length
  const resolved = allAlerts.filter(alert => String(alert.status || '').toLowerCase() === 'resolved').length

  return (
    <section>
      <PageHeading title="Alerts centre" subtitle="Review threshold events, acknowledge observations and track resolutions." />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard title="Open alerts" value={open} subtitle="Awaiting review" icon={AlertTriangle} tone="rose" />
        <MetricCard title="Acknowledged" value={acknowledged} subtitle="Seen by an operator" icon={Clock} tone="amber" />
        <MetricCard title="Resolved" value={resolved} subtitle="Marked as resolved" icon={CheckCircle2} tone="green" />
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <SectionTitle title="Alert history" subtitle={`${allAlerts.length} alert records from the database`} />

          <div className="flex gap-2">
            <select
              value={alertFilter}
              onChange={event => setAlertFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#102238] px-3 py-2 text-xs text-slate-200 outline-none"
            >
              <option>All</option>
              <option>Open</option>
              <option>Acknowledged</option>
              <option>Resolved</option>
            </select>

            <button
              onClick={loadAlerts}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>
        </div>

        {loading && allAlerts.length === 0 ? (
          <LoadingMessage message="Loading alerts..." />
        ) : alerts.length === 0 ? (
          <EmptyState message="No alerts found for this filter." />
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <article key={alert.id} className="rounded-xl border border-white/[0.07] bg-[#101f32] p-4 transition hover:border-cyan-400/20 sm:p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${severityConfig[alert.severity] || 'bg-slate-500/10 text-slate-300 ring-slate-500/20'}`}>
                        {alert.severity || 'Unspecified'} severity
                      </span>
                      <StatusPill status={alert.status} />
                    </div>

                    <h3 className="font-semibold text-white">
                      {alert.sensor_name || alert.sensor || 'Sensor'} threshold alert
                    </h3>

                    <p className="mt-1 text-xs text-slate-400">
                      {stationNameById[alert.station_id] || `Station ${alert.station_id}`}
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-300">{alert.message}</p>

                    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 text-[11px] text-slate-500 sm:grid-cols-3">
                      <p>Alert ID: <span className="text-slate-300">#{alert.id}</span></p>
                      <p>Observed: <span className="text-slate-300">{alert.observed_value ?? '—'}</span></p>
                      <p>Threshold: <span className="text-slate-300">{alert.threshold_value ?? '—'}</span></p>
                      <p>Created: <span className="text-slate-300">{alert.created_at ? new Date(alert.created_at).toLocaleString() : '—'}</span></p>

                      {alert.acknowledged_at && (
                        <p>Acknowledged: <span className="text-slate-300">{new Date(alert.acknowledged_at).toLocaleString()}</span></p>
                      )}

                      {alert.resolved_at && (
                        <p>Resolved: <span className="text-slate-300">{new Date(alert.resolved_at).toLocaleString()}</span></p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {String(alert.status || '').toLowerCase() === 'open' && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        disabled={actionLoading === alert.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/15 disabled:opacity-50"
                      >
                        {actionLoading === alert.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Acknowledge
                      </button>
                    )}

                    {String(alert.status || '').toLowerCase() !== 'resolved' && (
                      <button
                        onClick={() => onResolve(alert.id)}
                        disabled={actionLoading === alert.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-50"
                      >
                        {actionLoading === alert.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <PrototypeNotice />
    </section>
  )
}

function StationCard({ station, activeAlerts }) {
  const reading = station.latest_reading
  const status = station.status || 'No Data'

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <MapPin size={18} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{station.station_name}</h3>
            <p className="mt-1 truncate text-[11px] text-slate-500">{station.location || 'Location not specified'}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Water quality</span>
          <StatusPill status={status} />
        </div>
      </div>

      {reading ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ReadingTile label="pH level" value={reading.ph ?? '—'} icon={Droplets} />
            <ReadingTile label="Temperature" value={reading.temperature != null ? `${reading.temperature}°C` : '—'} icon={Thermometer} />
            <ReadingTile label="Turbidity" value={reading.turbidity != null ? `${reading.turbidity} NTU` : '—'} icon={Waves} />
            <ReadingTile label="Dissolved oxygen" value={reading.dissolved_oxygen != null ? `${reading.dissolved_oxygen} mg/L` : '—'} icon={Wind} />
            <ReadingTile label="Conductivity" value={reading.conductivity != null ? `${reading.conductivity} µS/cm` : '—'} icon={Gauge} />
            <ReadingTile label="TDS" value={reading.tds != null ? `${reading.tds} ppm` : '—'} icon={FlaskConical} />
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Clock size={11} />
            Latest reading: {reading.recorded_at ? new Date(reading.recorded_at).toLocaleString() : 'Timestamp unavailable'}
          </p>
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 py-6 text-center text-xs text-slate-500">
          <Database size={18} className="mx-auto mb-2 opacity-50" />
          No sensor readings available
        </div>
      )}

      {Array.isArray(activeAlerts) && activeAlerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-400/15 bg-orange-400/[0.06] p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-orange-300">
            <AlertTriangle size={13} />
            Active alerts
          </p>

          {activeAlerts.map(alert => (
            <p key={alert.id} className="mt-1 text-[11px] leading-5 text-orange-200/80">
              {alert.sensor_name || alert.sensor || 'Sensor'}: {alert.message || `${alert.severity || 'Unspecified'} severity alert`}
            </p>
          ))}
        </div>
      )}

      {activeAlerts === undefined && station.violations?.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-400/15 bg-orange-400/[0.06] p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-orange-300">
            <AlertTriangle size={13} />
            Threshold observations
          </p>

          {station.violations.map((violation, index) => (
            <p key={index} className="mt-1 text-[11px] leading-5 text-orange-200/80">
              {typeof violation === 'string'
                ? violation
                : `${violation.sensor_name || violation.sensor || 'Sensor'}: ${violation.message || violation.severity || 'Threshold exceeded'}`}
            </p>
          ))}
        </div>
      )}
    </article>
  )
}

function SensorForm({
  sensorData, updateSensor, loading,
  onSubmit, onReset, buttonText, buttonIcon: ButtonIcon
}) {
  const fields = [
    { name: 'ph', label: 'pH', unit: 'pH', icon: Droplets },
    { name: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer },
    { name: 'turbidity', label: 'Turbidity', unit: 'NTU', icon: Waves },
    { name: 'dissolved_oxygen', label: 'Dissolved oxygen', unit: 'mg/L', icon: Wind },
    { name: 'conductivity', label: 'Conductivity', unit: 'µS/cm', icon: Gauge },
    { name: 'tds', label: 'Total dissolved solids', unit: 'ppm', icon: FlaskConical },
    { name: 'orp', label: 'ORP', unit: 'mV', icon: Zap },
  ]

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-7">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-violet-400/10 p-3 text-violet-300">
          <BrainCircuit size={20} />
        </div>

        <div>
          <h3 className="font-semibold text-white">Sensor input parameters</h3>
          <p className="mt-1 text-xs text-slate-500">Provide all seven sensor values to run the model.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map(field => (
          <label key={field.name} className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300">
              <field.icon size={14} className="text-cyan-400" />
              {field.label}
              <span className="text-slate-600">({field.unit})</span>
            </span>

            <input
              type="number"
              step="any"
              name={field.name}
              value={sensorData[field.name]}
              onChange={updateSensor}
              className="w-full rounded-xl border border-white/10 bg-[#081525] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
            />
          </label>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          onClick={onSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ButtonIcon size={16} />}
          {loading ? 'Processing...' : buttonText}
        </button>

        <button
          onClick={onReset}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-50"
        >
          <RefreshCw size={15} />
          Reset
        </button>
      </div>
    </div>
  )
}

function ResultPanel({
  title, status, mlStatus, note,
  probabilities, parameterStatus, violations, sensorData
}) {
  const getStatusStyle = (value) => {
    if (['Normal', 'Within configured range'].includes(value)) {
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20'
    }

    if (value === 'Warning' || value === 'Medium') {
      return 'bg-amber-400/10 text-amber-300 ring-amber-400/20'
    }

    if (value === 'Poor' || value === 'High') {
      return 'bg-orange-400/10 text-orange-300 ring-orange-400/20'
    }

    if (value === 'Critical') {
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/20'
    }

    return 'bg-slate-500/10 text-slate-300 ring-slate-500/20'
  }

  const formatSensorName = (name) => sensorLabels[name]?.label || name.replaceAll('_', ' ')

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-2xl border border-cyan-400/15 bg-[#0d1b2d] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
            <BrainCircuit size={21} />
          </div>

          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-500">Combined prediction and threshold analysis</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-xs text-slate-500">Final water quality status</p>
            <div className="mt-3"><StatusPill status={status || 'No Data'} /></div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">
              Combines configured threshold checks with the model output.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-xs text-slate-500">Random Forest prediction</p>
            <div className="mt-3"><StatusPill status={mlStatus || 'No Data'} /></div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">
              Separate prediction from the trained machine-learning model.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-white">Individual sensor analysis</h3>
          <p className="mt-1 text-xs text-slate-500">Input values and their configured threshold evaluation.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(sensorLabels).map(([key, sensor]) => {
            const value = sensorData?.[key]
            const result = parameterStatus?.[key] || 'Status unavailable'

            return (
              <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-300">{sensor.label}</p>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ring-1 ring-inset ${getStatusStyle(result)}`}>
                    {result}
                  </span>
                </div>

                <p className="mt-4 text-xl font-bold text-white">
                  {value ?? '—'}
                  <span className="ml-1 text-xs font-normal text-slate-500">{sensor.unit}</span>
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={17} className="text-amber-300" />
          <h3 className="text-sm font-semibold text-white">Threshold violations</h3>
        </div>

        {Array.isArray(violations) && violations.length > 0 ? (
          <div className="space-y-3">
            {violations.map((violation, index) => (
              <div key={index} className="rounded-xl border border-rose-400/15 bg-rose-400/[0.05] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    {formatSensorName(violation.sensor_name || violation.sensor || 'Sensor')}
                  </p>

                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${getStatusStyle(violation.severity)}`}>
                    {violation.severity || 'Violation'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] text-slate-500">Observed value</p>
                    <p className="mt-1 text-sm font-semibold text-white">{violation.observed_value ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Threshold value</p>
                    <p className="mt-1 text-sm font-semibold text-white">{violation.threshold_value ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Direction</p>
                    <p className="mt-1 text-sm font-semibold capitalize text-white">{violation.direction || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 size={17} />
              <p className="text-xs font-semibold">No threshold violations reported</p>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              No configured threshold violations were returned for these inputs.
            </p>
          </div>
        )}
      </div>

      {probabilities && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-white">Random Forest class probabilities</h3>
          <p className="mt-1 text-xs text-slate-500">Probability values returned by the trained model.</p>

          <div className="mt-5 space-y-4">
            {Object.entries(probabilities).map(([label, probability]) => {
              const numericProbability = Math.max(0, Math.min(100, Number(probability) || 0))

              return (
                <div key={label}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-200">{probability}%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                      style={{ width: `${numericProbability}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {note && (
        <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-300" />
            <h3 className="text-xs font-semibold text-cyan-200">Model explanation</h3>
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-400">{note}</p>
        </div>
      )}
    </div>
  )
}

function MetricCard({ title, value, subtitle, icon: Icon, tone = 'cyan' }) {
  const tones = {
    cyan: 'bg-cyan-400/10 text-cyan-300 ring-cyan-400/10',
    green: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/10',
    amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/10',
    rose: 'bg-rose-400/10 text-rose-300 ring-rose-400/10',
    slate: 'bg-slate-400/10 text-slate-300 ring-slate-400/10',
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-4 transition hover:border-white/[0.14] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ring-1 ring-inset ${tones[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">{subtitle}</p>
    </div>
  )
}

function ReadingTile({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <Icon size={12} className="text-cyan-400" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  )
}

function StatusPill({ status }) {
  const config = statusConfig[status] || statusConfig['No Data']

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${config.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
    </div>
  )
}

function ChartFrame({ children }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a1727] p-3">
      {children}
    </div>
  )
}

function Legend({ color, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-2 text-slate-400">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-semibold text-slate-200">{value}</span>
    </div>
  )
}

function InfoCard({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1b2d] p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
        <Icon size={18} />
      </div>
      <h3 className="text-xs font-semibold text-white">{title}</h3>
      <p className="mt-2 text-[11px] leading-5 text-slate-400">{text}</p>
    </div>
  )
}

function PageHeading({ title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">
        <CircleDot size={11} />
        AquaSense workspace
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  )
}

function ErrorMessage({ message }) {
  return (
    <div className="my-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4 text-xs text-rose-200">
      <strong>Request failed:</strong> {String(message)}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-xs text-slate-500">
      <XCircle size={23} className="mx-auto mb-2 text-slate-600" />
      {message}
    </div>
  )
}

function LoadingMessage({ message }) {
  return (
    <div className="flex items-center justify-center gap-2 py-9 text-xs text-slate-400">
      <Loader2 size={16} className="animate-spin text-cyan-400" />
      {message}
    </div>
  )
}

function PrototypeNotice() {
  return (
    <p className="mt-6 text-[10px] leading-5 text-slate-500">
      Prototype notice: threshold values are configurable demonstration values. ML models use synthetic training data. Results are not certified water-safety assessments.
    </p>
  )
}

export default App
