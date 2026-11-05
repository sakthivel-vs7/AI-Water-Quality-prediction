
import joblib
import numpy as np
import pandas as pd

from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = BASE_DIR / "water_quality_dataset.csv"
MODEL_PATH = BASE_DIR / "water_quality_forecast_model.pkl"

SENSORS = [
    "ph",
    "turbidity",
    "tds",
    "conductivity",
    "dissolved_oxygen",
    "temperature",
    "orp"
]

WINDOW_SIZE = 6


# ==========================================
# LOAD DATASET
# ==========================================

data = pd.read_csv(DATA_PATH)

data["timestamp"] = pd.to_datetime(data["timestamp"])
data = data.sort_values("timestamp").reset_index(drop=True)

if not set(SENSORS).issubset(data.columns):
    raise ValueError("Dataset is missing sensor columns.")

sensor_data = data[SENSORS].astype(float)


# ==========================================
# CREATE SEQUENTIAL FEATURES
# ==========================================

X = []
y = []

feature_names = []

for lag in range(WINDOW_SIZE, 0, -1):
    for sensor in SENSORS:
        feature_names.append(f"{sensor}_lag_{lag}")

for i in range(WINDOW_SIZE, len(sensor_data)):

    previous_readings = sensor_data.iloc[
        i - WINDOW_SIZE:i
    ]

    X.append(previous_readings.to_numpy().flatten())
    y.append(sensor_data.iloc[i].to_numpy())

X = pd.DataFrame(X, columns=feature_names)
y = pd.DataFrame(y, columns=SENSORS)

print("Dataset loaded:", len(data))
print("Training samples:", len(X))
print("Input features:", X.shape[1])
print("Output sensors:", y.shape[1])


# ==========================================
# CHRONOLOGICAL TRAIN-TEST SPLIT
# ==========================================

split_index = int(len(X) * 0.80)

X_train = X.iloc[:split_index]
X_test = X.iloc[split_index:]

y_train = y.iloc[:split_index]
y_test = y.iloc[split_index:]

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))


# ==========================================
# TRAIN RANDOM FOREST REGRESSOR
# ==========================================

model = RandomForestRegressor(
    n_estimators=150,
    max_depth=14,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)

print("\nTraining forecasting model...")

model.fit(X_train, y_train)


# ==========================================
# EVALUATION
# ==========================================

predictions = model.predict(X_test)

print("\nFORECASTING MODEL RESULTS")
print("=" * 55)

metrics = {}

for index, sensor in enumerate(SENSORS):

    actual = y_test.iloc[:, index]
    predicted = predictions[:, index]

    mae = mean_absolute_error(actual, predicted)
    rmse = np.sqrt(mean_squared_error(actual, predicted))
    r2 = r2_score(actual, predicted)

    metrics[sensor] = {
        "MAE": float(mae),
        "RMSE": float(rmse),
        "R2": float(r2)
    }

    print(f"\nSensor: {sensor}")
    print(f"MAE : {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"R2  : {r2:.4f}")


# ==========================================
# SAVE MODEL
# ==========================================

model_package = {
    "model": model,
    "sensors": SENSORS,
    "window_size": WINDOW_SIZE,
    "interval_minutes": 5,
    "feature_names": feature_names,
    "metrics": metrics
}

joblib.dump(model_package, MODEL_PATH)

print("\nForecasting model saved successfully!")
print("Model path:", MODEL_PATH)
