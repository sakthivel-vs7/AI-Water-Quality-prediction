
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

function ReadingsChart({ readings, dataKey, title, unit, stroke }) {
  const chartData = [...readings]
    .filter(
      (reading) =>
        reading.recorded_at &&
        reading[dataKey] !== null &&
        reading[dataKey] !== undefined
    )
    .sort(
      (a, b) =>
        new Date(a.recorded_at) - new Date(b.recorded_at)
    )
    .map((reading) => ({
      time: new Date(reading.recorded_at).toLocaleTimeString(
        [],
        { hour: '2-digit', minute: '2-digit' }
      ),
      value: Number(reading[dataKey]),
    }))
    .filter((reading) => Number.isFinite(reading.value))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 mb-5">
        Historical sensor readings ({unit})
      </p>

      {chartData.length < 2 ? (
        <div className="h-64 flex items-center justify-center text-sm text-slate-400 text-center">
          At least two valid readings are needed to display a trend.
        </div>
      ) : (
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={45}
              />
              <Tooltip
                formatter={(value) => [`${value} ${unit}`, title]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Based on stored database readings.
      </p>
    </div>
  )
}

export default ReadingsChart
