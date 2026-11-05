
import React, { useCallback, useEffect, useState } from "react";
import { getWaterQualityForecast } from "./api";
import {
  RefreshCw,
  TrendingUp,
  Activity,
  AlertCircle,
} from "lucide-react";

const SENSOR_INFO = [
  { key: "ph", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "tds", label: "TDS", unit: "ppm" },
  { key: "conductivity", label: "Conductivity", unit: "µS/cm" },
  { key: "dissolved_oxygen", label: "Dissolved Oxygen", unit: "mg/L" },
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "orp", label: "ORP", unit: "mV" },
];

const colors = {
  text: "#111827",
  muted: "#4b5563",
  border: "#d1d5db",
  background: "#ffffff",
  blue: "#2563eb",
};

const cardStyle = {
  background: colors.background,
  color: colors.text,
  border: `1px solid ${colors.border}`,
  borderRadius: "12px",
  padding: "18px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const mutedStyle = {
  color: colors.muted,
  fontSize: "14px",
};

function formatValue(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "—";
}

export default function ForecastPage({ stations = [] }) {
  const [stationId, setStationId] = useState("");
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getStationId = (station) => station.station_id ?? station.id;

  useEffect(() => {
    if (!stations.length) {
      setStationId("");
      setForecast(null);
      return;
    }

    const exists = stations.some(
      (station) => String(getStationId(station)) === String(stationId)
    );

    if (!stationId || !exists) {
      setStationId(String(getStationId(stations[0])));
    }
  }, [stations, stationId]);

  const loadForecast = useCallback(async () => {
    if (!stationId) return;

    setLoading(true);
    setError("");

    try {
      const data = await getWaterQualityForecast(stationId);
      setForecast(data);
    } catch (err) {
      setForecast(null);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Unable to load forecast."
      );
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    if (stationId) {
      loadForecast();
    }
  }, [stationId, loadForecast]);

  const metrics = forecast?.model_metrics || {};

  return (
    <div
      style={{
        display: "grid",
        gap: "20px",
        color: colors.text,
        width: "100%",
      }}
    >
      {/* PAGE HEADER */}
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "26px",
            fontWeight: 700,
            color: colors.text,
          }}
        >
          Time-Series Forecast
        </h2>

        <p style={{ ...mutedStyle, marginTop: "8px" }}>
          AI-based prediction of upcoming water sensor readings.
        </p>
      </div>

      {/* STATION SELECTION */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <label
          htmlFor="forecast-station"
          style={{ fontWeight: 700, color: colors.text }}
        >
          Select Station
        </label>

        <select
          id="forecast-station"
          value={stationId}
          onChange={(event) => setStationId(event.target.value)}
          disabled={!stations.length}
          style={{
            padding: "11px 14px",
            borderRadius: "8px",
            border: `1px solid ${colors.border}`,
            minWidth: "220px",
            background: "#ffffff",
            color: "#111827",
            fontSize: "14px",
            fontWeight: 600,
            cursor: stations.length ? "pointer" : "not-allowed",
            outlineColor: colors.blue,
          }}
        >
          {stations.map((station) => (
            <option
              key={getStationId(station)}
              value={String(getStationId(station))}
              style={{ background: "#ffffff", color: "#111827" }}
            >
              {station.station_name ||
                station.name ||
                `Station ${getStationId(station)}`}
            </option>
          ))}
        </select>

        <button
          onClick={loadForecast}
          disabled={loading || !stationId}
          style={{
            padding: "11px 17px",
            border: "none",
            borderRadius: "8px",
            cursor: loading || !stationId ? "not-allowed" : "pointer",
            background: loading ? "#64748b" : colors.blue,
            color: "#ffffff",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            opacity: !stationId ? 0.6 : 1,
          }}
        >
          <RefreshCw size={16} />
          {loading ? "Loading..." : "Refresh Forecast"}
        </button>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div
          style={{
            ...cardStyle,
            color: "#991b1b",
            background: "#fef2f2",
            borderColor: "#fecaca",
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* NO STATIONS */}
      {!stations.length && (
        <div style={cardStyle}>
          <h3 style={{ color: colors.text, marginTop: 0 }}>
            No Stations Available
          </h3>
          <p style={mutedStyle}>
            Add a station before requesting a forecast.
          </p>
        </div>
      )}

      {/* LOADING */}
      {loading && !forecast && (
        <div style={cardStyle}>
          <p style={{ color: colors.text, margin: 0 }}>
            Loading forecast data...
          </p>
        </div>
      )}

      {/* FORECAST RESULTS */}
      {forecast && (
        <>
          {/* FORECAST SUMMARY */}
          <div
            style={{
              ...cardStyle,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "20px",
            }}
          >
            <div>
              <div style={mutedStyle}>Forecast Station</div>
              <h3 style={{ margin: "7px 0", color: colors.text }}>
                {forecast.station_name ||
                  `Station ${forecast.station_id}`}
              </h3>
            </div>

            <div>
              <div style={mutedStyle}>Forecast Time</div>
              <strong style={{ color: colors.text }}>
                {forecast.forecast_for
                  ? new Date(forecast.forecast_for).toLocaleString()
                  : "Not available"}
              </strong>
            </div>

            <div>
              <div style={mutedStyle}>Forecast Interval</div>
              <strong style={{ color: colors.text }}>
                {forecast.forecast_interval_minutes ?? "—"} minutes
              </strong>
            </div>

            <div>
              <div style={mutedStyle}>Input Readings</div>
              <strong style={{ color: colors.text }}>
                {forecast.input_readings ?? "—"}
              </strong>
            </div>
          </div>

          {/* PREDICTED VALUES */}
          <div>
            <h3
              style={{
                display: "flex",
                gap: "9px",
                alignItems: "center",
                color: colors.text,
                fontSize: "19px",
              }}
            >
              <TrendingUp size={21} color={colors.blue} />
              Predicted Sensor Values
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
              }}
            >
              {SENSOR_INFO.map((sensor) => (
                <div key={sensor.key} style={cardStyle}>
                  <div
                    style={{
                      color: colors.muted,
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {sensor.label}
                  </div>

                  <div
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      color: "#111827",
                      marginTop: "10px",
                    }}
                  >
                    {formatValue(
                      forecast.predicted_values?.[sensor.key]
                    )}
                  </div>

                  <div
                    style={{
                      color: colors.muted,
                      fontSize: "13px",
                      marginTop: "5px",
                    }}
                  >
                    {sensor.unit || "Sensor reading"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MODEL PERFORMANCE */}
          <div>
            <h3
              style={{
                display: "flex",
                gap: "9px",
                alignItems: "center",
                color: colors.text,
                fontSize: "19px",
              }}
            >
              <Activity size={21} color={colors.blue} />
              Model Performance
            </h3>

            <div style={{ ...cardStyle, overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  color: colors.text,
                  minWidth: "450px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    {["Sensor", "MAE", "RMSE", "R²"].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "13px",
                          color: "#111827",
                          fontWeight: 700,
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {SENSOR_INFO.map((sensor) => {
                    const metric = metrics[sensor.key] || {};

                    return (
                      <tr key={sensor.key}>
                        <td
                          style={{
                            padding: "13px",
                            color: colors.text,
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: 600,
                          }}
                        >
                          {sensor.label}
                        </td>

                        <td style={{ padding: "13px", color: colors.text }}>
                          {formatValue(metric.MAE ?? metric.mae)}
                        </td>

                        <td style={{ padding: "13px", color: colors.text }}>
                          {formatValue(metric.RMSE ?? metric.rmse)}
                        </td>

                        <td style={{ padding: "13px", color: colors.text }}>
                          {formatValue(metric.R2 ?? metric.r2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DISCLAIMER */}
          <div
            style={{
              ...cardStyle,
              background: "#eff6ff",
              borderColor: "#bfdbfe",
              color: "#1e3a8a",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            <strong>Important:</strong> This forecast is an experimental
            estimate trained using synthetic demonstration data. Its test
            metrics do not establish real-world accuracy. It is not a
            water-safety certification or a substitute for proper water
            testing.
          </div>
        </>
      )}
    </div>
  );
}
