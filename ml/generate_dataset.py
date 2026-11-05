
import numpy as np
import pandas as pd
from pathlib import Path

np.random.seed(42)

number_of_records = 5000

# Generate sequential timestamps (5-minute intervals)
timestamps = pd.date_range(
    start="2026-01-01",
    periods=number_of_records,
    freq="5min"
)

# Generate sensor readings with gradual time variation
time = np.arange(number_of_records)

data = pd.DataFrame({
    "timestamp": timestamps,
    "ph": 7.2 + 0.3 * np.sin(time / 100) + np.random.normal(0, 0.15, number_of_records),
    "temperature": 28 + 2 * np.sin(time / 150) + np.random.normal(0, 0.8, number_of_records),
    "turbidity": 3.5 + 0.5 * np.sin(time / 80) + np.random.normal(0, 0.4, number_of_records),
    "dissolved_oxygen": 6.8 + 0.4 * np.sin(time / 120) + np.random.normal(0, 0.3, number_of_records),
    "conductivity": 420 + 30 * np.sin(time / 100) + np.random.normal(0, 15, number_of_records),
    "tds": 250 + 20 * np.sin(time / 90) + np.random.normal(0, 10, number_of_records),
    "orp": 300 + 25 * np.sin(time / 110) + np.random.normal(0, 15, number_of_records)
})

# Keep values within demo ranges
limits = {
    "ph": (4, 10),
    "temperature": (10, 45),
    "turbidity": (0, 20),
    "dissolved_oxygen": (0, 14),
    "conductivity": (50, 1500),
    "tds": (10, 1000),
    "orp": (-500, 1000)
}

for column, (low, high) in limits.items():
    data[column] = data[column].clip(low, high)

# Water quality classification
conditions = [
    (
        data["ph"].between(6.5, 8.5) &
        (data["turbidity"] <= 5) &
        (data["dissolved_oxygen"] >= 5) &
        (data["tds"] <= 500)
    ),
    (
        data["ph"].between(6.0, 9.0) &
        (data["turbidity"] <= 10) &
        (data["dissolved_oxygen"] >= 3) &
        (data["tds"] <= 800)
    )
]

data["quality_status"] = np.select(
    conditions,
    ["Normal", "Warning"],
    default="Poor"
)

# Save dataset
output_path = Path(__file__).resolve().parent / "water_quality_dataset.csv"
data.to_csv(output_path, index=False)

print("Time-series dataset generated successfully!")
print("Total records:", len(data))
print("\nClass distribution:")
print(data["quality_status"].value_counts())
print("\nFirst five records:")
print(data.head())
print("\nSaved to:", output_path)
