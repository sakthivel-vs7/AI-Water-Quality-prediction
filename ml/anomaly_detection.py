import pandas as pd
import joblib

from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline


# Project paths
BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = BASE_DIR / "water_quality_dataset.csv"
MODEL_PATH = BASE_DIR / "anomaly_detection_model.pkl"
RESULT_PATH = BASE_DIR / "anomaly_results.csv"

# Water quality parameters
FEATURES = [
    "ph",
    "temperature",
    "turbidity",
    "dissolved_oxygen",
    "conductivity",
    "tds",
    "orp"
]


# Load dataset
print("Loading water quality dataset...")

data = pd.read_csv(DATA_PATH)

X = data[FEATURES].apply(pd.to_numeric, errors="coerce")

print("Dataset records:", len(X))


# Build Isolation Forest pipeline
model = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
    ("isolation_forest", IsolationForest(
        n_estimators=200,
        contamination=0.03,
        random_state=42
    ))
])


# Train anomaly detection model
print("\nTraining Isolation Forest model...")

model.fit(X)

# Predict anomalies
predictions = model.predict(X)

# Calculate anomaly scores
scores = -model.decision_function(X)

# Create results
results = data.copy()

results["anomaly_status"] = [
    "Anomaly" if prediction == -1 else "Normal"
    for prediction in predictions
]

results["anomaly_score"] = scores

# Save model and results
joblib.dump(model, MODEL_PATH)
results.to_csv(RESULT_PATH, index=False)


# Display summary
anomaly_count = (predictions == -1).sum()
normal_count = (predictions == 1).sum()

print("\n========== ANOMALY DETECTION RESULTS ==========")
print("Total records:", len(data))
print("Normal records:", normal_count)
print("Anomalies detected:", anomaly_count)
print("Anomaly percentage:", round(anomaly_count / len(data) * 100, 2), "%")

print("\nSample detected anomalies:")
print(
    results[results["anomaly_status"] == "Anomaly"][
        FEATURES + ["anomaly_score"]
    ].head(5)
)

print("\nModel saved:", MODEL_PATH)
print("Results saved:", RESULT_PATH)

print("\nIsolation Forest training completed!")