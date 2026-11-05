import pandas as pd
import joblib

from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

BASE_DIR = Path(__file__).resolve().parent

SENSOR_COLUMNS = [
    "ph", "temperature", "turbidity",
    "dissolved_oxygen", "conductivity",
    "tds", "orp"
]

# 1. Load dataset
data = pd.read_csv(BASE_DIR / "water_quality_dataset.csv")

data["timestamp"] = pd.to_datetime(
    data["timestamp"], errors="coerce"
)

data = data.dropna(subset=["timestamp"])
data = data.sort_values("timestamp").reset_index(drop=True)

for column in SENSOR_COLUMNS:
    data[column] = pd.to_numeric(
        data[column], errors="coerce"
    )

print("Dataset loaded:", len(data))

# 2. Time-series feature engineering
features = data[SENSOR_COLUMNS].copy()

for column in SENSOR_COLUMNS:
    previous = data[column].shift(1)

    features[f"{column}_lag_1"] = data[column].shift(1)
    features[f"{column}_lag_3"] = data[column].shift(3)

    features[f"{column}_rate_change"] = (
        data[column] - previous
    )

    features[f"{column}_rolling_mean"] = (
        previous.rolling(3, min_periods=1).mean()
    )

    features[f"{column}_rolling_std"] = (
        previous.rolling(3, min_periods=2).std()
    )

    features[f"{column}_rolling_min"] = (
        previous.rolling(3, min_periods=1).min()
    )

    features[f"{column}_rolling_max"] = (
        previous.rolling(3, min_periods=1).max()
    )

target = data["quality_status"]

# 3. Chronological split
split_index = int(len(data) * 0.8)

X_train = features.iloc[:split_index]
X_test = features.iloc[split_index:]

y_train = target.iloc[:split_index]
y_test = target.iloc[split_index:]

print("Training records:", len(X_train))
print("Testing records:", len(X_test))

# 4. Build model pipeline
model = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("classifier", RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        random_state=42,
        class_weight="balanced"
    ))
])

# 5. Train
print("\nTraining model...")
model.fit(X_train, y_train)

# 6. Evaluate
predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("\nMODEL TRAINING COMPLETED")
print("------------------------")
print(f"Accuracy: {accuracy * 100:.2f}%")

print("\nClassification Report:")
print(classification_report(
    y_test,
    predictions,
    labels=["Normal", "Warning", "Poor"],
    zero_division=0
))

print("\nConfusion Matrix:")
print(confusion_matrix(
    y_test,
    predictions,
    labels=["Normal", "Warning", "Poor"]
))

# 7. Feature importance
classifier = model.named_steps["classifier"]

importance = pd.DataFrame({
    "feature": features.columns,
    "importance": classifier.feature_importances_
})

importance = importance.sort_values(
    "importance", ascending=False
)

print("\nTop 10 Important Features:")
print(importance.head(10).to_string(index=False))

# 8. Save model
model_path = BASE_DIR / "water_quality_model.pkl"

joblib.dump(model, model_path)

print("\nModel saved successfully!")
print("Model path:", model_path)
print("Total features:", len(features.columns))