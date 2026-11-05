
import joblib
import pandas as pd

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# --------------------------------------------------
# 1. LOAD TRAINED MODEL
# --------------------------------------------------

MODEL_PATH = BASE_DIR / "water_quality_model.pkl"

model = joblib.load(MODEL_PATH)

SENSOR_COLUMNS = [
    "ph",
    "temperature",
    "turbidity",
    "dissolved_oxygen",
    "conductivity",
    "tds",
    "orp"
]

# --------------------------------------------------
# 2. PREPARE TIME-SERIES FEATURES
# --------------------------------------------------

def prepare_features(current, history=None):

    if history is None:
        history = []

    # Previous readings followed by current reading
    records = history + [current]

    data = pd.DataFrame(
        records,
        columns=SENSOR_COLUMNS
    )

    features = {}

    for column in SENSOR_COLUMNS:

        values = pd.to_numeric(
            data[column],
            errors="coerce"
        )

        # Current sensor value
        features[column] = values.iloc[-1]

        # Lag features
        features[f"{column}_lag_1"] = (
            values.iloc[-2]
            if len(values) >= 2
            else float("nan")
        )

        features[f"{column}_lag_3"] = (
            values.iloc[-4]
            if len(values) >= 4
            else float("nan")
        )

        # Rate of change
        features[f"{column}_rate_change"] = (
            values.iloc[-1] - values.iloc[-2]
            if len(values) >= 2
            else float("nan")
        )

        # Previous three readings
        previous = values.iloc[:-1].tail(3)

        features[f"{column}_rolling_mean"] = (
            previous.mean()
        )

        features[f"{column}_rolling_std"] = (
            previous.std()
        )

        features[f"{column}_rolling_min"] = (
            previous.min()
        )

        features[f"{column}_rolling_max"] = (
            previous.max()
        )

    # IMPORTANT: Match exact training feature order
    feature_names = SENSOR_COLUMNS.copy()

    for column in SENSOR_COLUMNS:
        feature_names.extend([
            f"{column}_lag_1",
            f"{column}_lag_3",
            f"{column}_rate_change",
            f"{column}_rolling_mean",
            f"{column}_rolling_std",
            f"{column}_rolling_min",
            f"{column}_rolling_max"
        ])

    model_input = pd.DataFrame(
        [features],
        columns=feature_names
    )

    return model_input


# --------------------------------------------------
# 3. CURRENT SENSOR READINGS
# --------------------------------------------------

sample = {
    "ph": 7.2,
    "temperature": 28.5,
    "turbidity": 3.1,
    "dissolved_oxygen": 6.8,
    "conductivity": 420,
    "tds": 250,
    "orp": 300
}

# --------------------------------------------------
# 4. SAMPLE HISTORICAL READINGS
# --------------------------------------------------

# Demonstration history only.
# Later we will fetch actual readings from PostgreSQL.

history = [
    {
        "ph": 7.1,
        "temperature": 28.2,
        "turbidity": 3.0,
        "dissolved_oxygen": 6.9,
        "conductivity": 418,
        "tds": 248,
        "orp": 298
    },
    {
        "ph": 7.2,
        "temperature": 28.3,
        "turbidity": 3.2,
        "dissolved_oxygen": 6.8,
        "conductivity": 419,
        "tds": 249,
        "orp": 299
    },
    {
        "ph": 7.2,
        "temperature": 28.4,
        "turbidity": 3.1,
        "dissolved_oxygen": 6.8,
        "conductivity": 420,
        "tds": 250,
        "orp": 300
    }
]

# --------------------------------------------------
# 5. GENERATE MODEL INPUT
# --------------------------------------------------

model_input = prepare_features(
    current=sample,
    history=history
)

print("Prepared model features:", len(model_input.columns))

# Verify feature names and order
expected_features = list(model.feature_names_in_)

if list(model_input.columns) != expected_features:
    raise ValueError(
        "Feature names or ordering do not match the trained model."
    )

# --------------------------------------------------
# 6. PREDICT WATER QUALITY
# --------------------------------------------------

prediction = model.predict(model_input)[0]

probabilities = model.predict_proba(model_input)[0]

# --------------------------------------------------
# 7. DISPLAY RESULTS
# --------------------------------------------------

print("\nAQUASENSE AI - WATER QUALITY PREDICTION")
print("---------------------------------------")

print("Predicted Status:", prediction)

print("\nClass Probabilities:")

for label, probability in zip(
    model.classes_,
    probabilities
):
    print(f"{label}: {probability * 100:.2f}%")

print("\nPrediction completed successfully!")
print("Total features used:", len(model_input.columns))
