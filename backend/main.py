
import csv
import io
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File
)
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import Base, engine, SessionLocal
from model import Station, SensorReading, WaterQualityAlert

from schemas import (
    StationCreate,
    StationResponse,
    SensorReadingCreate,
    SensorReadingResponse,
    PredictionRequest,
    PredictionResponse,
    WaterQualityAlertResponse
)


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# LOAD MACHINE LEARNING MODELS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
ML_DIR = BASE_DIR.parent / "ml"

MODEL_PATH = ML_DIR / "water_quality_model.pkl"
ANOMALY_MODEL_PATH = ML_DIR / "anomaly_detection_model.pkl"
FORECAST_MODEL_PATH = ML_DIR / "water_quality_forecast_model.pkl"

for model_path in [
    MODEL_PATH,
    ANOMALY_MODEL_PATH,
    FORECAST_MODEL_PATH
]:
    if not model_path.exists():
        raise RuntimeError(f"ML model not found: {model_path}")

ml_model = joblib.load(MODEL_PATH)
anomaly_model = joblib.load(ANOMALY_MODEL_PATH)

forecast_package = joblib.load(FORECAST_MODEL_PATH)
forecast_model = forecast_package["model"]
FORECAST_SENSORS = forecast_package["sensors"]
FORECAST_WINDOW_SIZE = forecast_package["window_size"]
FORECAST_INTERVAL = forecast_package["interval_minutes"]
FORECAST_FEATURE_NAMES = forecast_package["feature_names"]


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="AquaSense AI",
    description=(
        "AI-Based Water Quality Prediction Using "
        "IoT Sensor Time-Series"
    ),
    version="1.2.0"
)


# =========================================================
# CORS CONFIGURATION
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# =========================================================
# SENSOR CONFIGURATION
# =========================================================

SENSOR_COLUMNS = [
    "ph",
    "temperature",
    "turbidity",
    "dissolved_oxygen",
    "conductivity",
    "tds",
    "orp"
]

# Prototype thresholds only.
# These are configurable demonstration values,
# NOT certified regulatory water-quality limits.

THRESHOLD_RULES = {
    "ph": {
        "low": (6.5, 8.5),
        "medium": (6.0, 9.0),
        "high": (5.5, 9.5),
        "critical": (5.0, 10.0)
    },
    "turbidity": {
        "low": 5,
        "medium": 10,
        "high": 20,
        "critical": 50
    },
    "dissolved_oxygen": {
        "low": 5,
        "medium": 3,
        "high": 2,
        "critical": 1
    },
    "tds": {
        "low": 500,
        "medium": 1000,
        "high": 2000,
        "critical": 3000
    },
    "conductivity": {
        "low": 1000,
        "medium": 1500,
        "high": 2500,
        "critical": 4000
    },
    "temperature": {
        "low": 35,
        "medium": 40,
        "high": 45,
        "critical": 50
    }
}

SEVERITY_ORDER = {
    "Low": 1,
    "Medium": 2,
    "High": 3,
    "Critical": 4
}


# =========================================================
# DATABASE SESSION
# =========================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =========================================================
# THRESHOLD EVALUATION
# =========================================================

def evaluate_sensor_value(sensor, value):

    if value is None:
        return None

    rules = THRESHOLD_RULES.get(sensor)

    if not rules:
        return None

    severity = None
    threshold = None
    direction = None

    if sensor == "ph":

        if value < rules["critical"][0]:
            severity = "Critical"
            threshold = rules["critical"][0]
            direction = "below"

        elif value > rules["critical"][1]:
            severity = "Critical"
            threshold = rules["critical"][1]
            direction = "above"

        elif value < rules["high"][0]:
            severity = "High"
            threshold = rules["high"][0]
            direction = "below"

        elif value > rules["high"][1]:
            severity = "High"
            threshold = rules["high"][1]
            direction = "above"

        elif value < rules["medium"][0]:
            severity = "Medium"
            threshold = rules["medium"][0]
            direction = "below"

        elif value > rules["medium"][1]:
            severity = "Medium"
            threshold = rules["medium"][1]
            direction = "above"

        elif value < rules["low"][0]:
            severity = "Low"
            threshold = rules["low"][0]
            direction = "below"

        elif value > rules["low"][1]:
            severity = "Low"
            threshold = rules["low"][1]
            direction = "above"

    elif sensor == "dissolved_oxygen":

        if value < rules["critical"]:
            severity = "Critical"
            threshold = rules["critical"]

        elif value < rules["high"]:
            severity = "High"
            threshold = rules["high"]

        elif value < rules["medium"]:
            severity = "Medium"
            threshold = rules["medium"]

        elif value < rules["low"]:
            severity = "Low"
            threshold = rules["low"]

        if severity:
            direction = "below"

    else:

        if value > rules["critical"]:
            severity = "Critical"
            threshold = rules["critical"]

        elif value > rules["high"]:
            severity = "High"
            threshold = rules["high"]

        elif value > rules["medium"]:
            severity = "Medium"
            threshold = rules["medium"]

        elif value > rules["low"]:
            severity = "Low"
            threshold = rules["low"]

        if severity:
            direction = "above"

    if severity is None:
        return None

    return {
        "sensor_name": sensor,
        "observed_value": float(value),
        "threshold_value": float(threshold),
        "severity": severity,
        "direction": direction
    }


def evaluate_reading(reading):

    violations = []

    for sensor in THRESHOLD_RULES:

        value = getattr(reading, sensor)

        violation = evaluate_sensor_value(sensor, value)

        if violation:
            violations.append(violation)

    return violations


def get_water_status(reading):

    violations = evaluate_reading(reading)

    if not violations:
        return "Normal", []

    highest_severity = max(
        violations,
        key=lambda item: SEVERITY_ORDER[item["severity"]]
    )["severity"]

    if highest_severity in ["Low", "Medium"]:
        status = "Warning"
    elif highest_severity == "High":
        status = "Poor"
    else:
        status = "Critical"

    return status, violations


# =========================================================
# ALERT CREATION AND DUPLICATE PREVENTION
# =========================================================

def create_alerts_for_reading(db, reading):

    violations = evaluate_reading(reading)

    for violation in violations:

        existing_alert = (
            db.query(WaterQualityAlert)
            .filter(
                WaterQualityAlert.station_id == reading.station_id,
                WaterQualityAlert.sensor_name == violation["sensor_name"],
                WaterQualityAlert.status.in_(
                    ["Open", "Acknowledged"]
                )
            )
            .first()
        )

        message = (
            f"{violation['sensor_name']} is "
            f"{violation['direction']} the configured threshold. "
            f"Observed: {violation['observed_value']}; "
            f"threshold: {violation['threshold_value']}."
        )

        if existing_alert:

            existing_alert.observed_value = violation["observed_value"]
            existing_alert.threshold_value = violation["threshold_value"]
            existing_alert.severity = violation["severity"]
            existing_alert.message = message

        else:

            new_alert = WaterQualityAlert(
                station_id=reading.station_id,
                sensor_name=violation["sensor_name"],
                observed_value=violation["observed_value"],
                threshold_value=violation["threshold_value"],
                message=message,
                severity=violation["severity"],
                status="Open"
            )

            db.add(new_alert)

        db.flush()


# =========================================================
# HOME AND HEALTH ENDPOINTS
# =========================================================

@app.get("/")
def home():

    return {
        "message": "AquaSense AI Backend is running!",
        "status": "success"
    }


@app.get("/api/health")
def health_check():

    return {
        "backend": "online",
        "database": "connected",
        "ml_model": "loaded",
        "anomaly_model": "loaded",
        "forecast_model": "loaded",
        "project": "AquaSense AI"
    }


# =========================================================
# STATION MANAGEMENT
# =========================================================

@app.post("/api/stations", response_model=StationResponse)
def create_station(
    station: StationCreate,
    db: Session = Depends(get_db)
):

    new_station = Station(**station.model_dump())

    db.add(new_station)

    try:

        db.commit()
        db.refresh(new_station)

        return new_station

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Station name already exists"
        )


@app.get(
    "/api/stations",
    response_model=list[StationResponse]
)
def get_stations(db: Session = Depends(get_db)):

    return (
        db.query(Station)
        .order_by(Station.id)
        .all()
    )


# =========================================================
# DYNAMIC DASHBOARD STATUS
# =========================================================

@app.get("/api/dashboard/status")
def get_dashboard_status(db: Session = Depends(get_db)):

    stations = (
        db.query(Station)
        .filter(Station.is_active == True)
        .order_by(Station.id)
        .all()
    )

    station_results = []

    counts = {
        "Normal": 0,
        "Warning": 0,
        "Poor": 0,
        "Critical": 0,
        "No Data": 0
    }

    for station in stations:

        latest_reading = (
            db.query(SensorReading)
            .filter(
                SensorReading.station_id == station.id
            )
            .order_by(
                SensorReading.recorded_at.desc(),
                SensorReading.id.desc()
            )
            .first()
        )

        if latest_reading is None:

            status = "No Data"
            violations = []
            reading_data = None

        else:

            status, violations = get_water_status(latest_reading)

            reading_data = {
                sensor: getattr(latest_reading, sensor)
                for sensor in SENSOR_COLUMNS
            }

            reading_data["recorded_at"] = latest_reading.recorded_at

        counts[status] += 1

        station_results.append({
            "station_id": station.id,
            "station_name": station.station_name,
            "location": station.location,
            "status": status,
            "latest_reading": reading_data,
            "violations": violations
        })

    return {
        "total_stations": len(stations),
        "counts": counts,
        "stations": station_results,
        "status_note": (
            "Rule-based prototype status using configurable "
            "demonstration thresholds. Not a certified "
            "water safety assessment."
        )
    }


# =========================================================
# SENSOR READINGS
# =========================================================

@app.post(
    "/api/readings",
    response_model=SensorReadingResponse
)
def create_reading(
    reading: SensorReadingCreate,
    db: Session = Depends(get_db)
):

    station = (
        db.query(Station)
        .filter(Station.id == reading.station_id)
        .first()
    )

    if not station:
        raise HTTPException(
            status_code=404,
            detail="Station not found"
        )

    new_reading = SensorReading(**reading.model_dump())

    try:

        db.add(new_reading)
        db.flush()

        create_alerts_for_reading(db, new_reading)

        db.commit()
        db.refresh(new_reading)

        return new_reading

    except Exception:

        db.rollback()
        raise


@app.get(
    "/api/readings",
    response_model=list[SensorReadingResponse]
)
def get_readings(db: Session = Depends(get_db)):

    return (
        db.query(SensorReading)
        .order_by(
            SensorReading.recorded_at.desc(),
            SensorReading.id.desc()
        )
        .all()
    )


# =========================================================
# CSV SENSOR DATA UPLOAD
# =========================================================

@app.post("/api/readings/upload-csv")
def upload_sensor_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    if not (file.filename or "").lower().endswith(".csv"):

        raise HTTPException(
            status_code=400,
            detail="Only CSV files are allowed"
        )

    try:

        content = file.file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(content))

        required_columns = {
            "station_id",
            "recorded_at",
            "ph",
            "temperature",
            "turbidity",
            "dissolved_oxygen",
            "conductivity",
            "tds",
            "orp"
        }

        if not reader.fieldnames:

            raise HTTPException(
                status_code=400,
                detail="CSV file is empty or has no header"
            )

        if not required_columns.issubset(set(reader.fieldnames)):

            raise HTTPException(
                status_code=400,
                detail="CSV is missing required columns"
            )

        inserted = 0
        generated_alerts = 0
        errors = []

        for row_number, row in enumerate(reader, start=2):

            try:

                station_id = int(row["station_id"].strip())

                station = (
                    db.query(Station)
                    .filter(Station.id == station_id)
                    .first()
                )

                if not station:
                    raise ValueError("Station ID does not exist")

                recorded_at = datetime.fromisoformat(
                    row["recorded_at"].strip()
                )

                def optional_float(column):

                    value = row[column].strip()

                    if value == "":
                        return None

                    return float(value)

                new_reading = SensorReading(
                    station_id=station_id,
                    recorded_at=recorded_at,
                    ph=optional_float("ph"),
                    temperature=optional_float("temperature"),
                    turbidity=optional_float("turbidity"),
                    dissolved_oxygen=optional_float("dissolved_oxygen"),
                    conductivity=optional_float("conductivity"),
                    tds=optional_float("tds"),
                    orp=optional_float("orp")
                )

                db.add(new_reading)
                db.flush()

                before_count = (
                    db.query(WaterQualityAlert)
                    .filter(
                        WaterQualityAlert.station_id == station_id,
                        WaterQualityAlert.status.in_(
                            ["Open", "Acknowledged"]
                        )
                    )
                    .count()
                )

                create_alerts_for_reading(db, new_reading)

                after_count = (
                    db.query(WaterQualityAlert)
                    .filter(
                        WaterQualityAlert.station_id == station_id,
                        WaterQualityAlert.status.in_(
                            ["Open", "Acknowledged"]
                        )
                    )
                    .count()
                )

                generated_alerts += max(
                    0,
                    after_count - before_count
                )

                inserted += 1

            except (ValueError, TypeError, KeyError) as error:

                errors.append({
                    "row": row_number,
                    "error": str(error)
                })

        db.commit()

        return {
            "message": "CSV processing completed",
            "inserted_records": inserted,
            "generated_alerts": generated_alerts,
            "failed_records": len(errors),
            "errors": errors
        }

    except HTTPException:

        db.rollback()
        raise

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    finally:
        file.file.close()


# =========================================================
# ALERT HISTORY
# =========================================================

@app.get(
    "/api/alerts",
    response_model=list[WaterQualityAlertResponse]
)
def get_alerts(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):

    query = db.query(WaterQualityAlert)

    if status:

        allowed_statuses = [
            "Open",
            "Acknowledged",
            "Resolved"
        ]

        if status not in allowed_statuses:

            raise HTTPException(
                status_code=400,
                detail="Invalid alert status"
            )

        query = query.filter(
            WaterQualityAlert.status == status
        )

    return (
        query
        .order_by(WaterQualityAlert.created_at.desc())
        .all()
    )


# =========================================================
# ACKNOWLEDGE ALERT
# =========================================================

@app.post(
    "/api/alerts/{alert_id}/acknowledge",
    response_model=WaterQualityAlertResponse
)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):

    alert = (
        db.query(WaterQualityAlert)
        .filter(WaterQualityAlert.id == alert_id)
        .first()
    )

    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    if alert.status == "Resolved":

        raise HTTPException(
            status_code=400,
            detail="Resolved alerts cannot be acknowledged"
        )

    alert.status = "Acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)

    return alert


# =========================================================
# RESOLVE ALERT
# =========================================================

@app.post(
    "/api/alerts/{alert_id}/resolve",
    response_model=WaterQualityAlertResponse
)
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db)
):

    alert = (
        db.query(WaterQualityAlert)
        .filter(WaterQualityAlert.id == alert_id)
        .first()
    )

    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    if alert.status == "Resolved":

        raise HTTPException(
            status_code=400,
            detail="Alert is already resolved"
        )

    alert.status = "Resolved"
    alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)

    return alert


# =========================================================
# TIME-SERIES FEATURE ENGINEERING
# =========================================================

def prepare_prediction_features(current, history):

    features = {}

    for sensor in SENSOR_COLUMNS:
        features[sensor] = current[sensor]

    for sensor in SENSOR_COLUMNS:

        previous_values = pd.Series(
            [
                reading[sensor]
                for reading in history
            ],
            dtype="float64"
        )

        lag_1 = (
            previous_values.iloc[-1]
            if len(previous_values) >= 1
            else float("nan")
        )

        lag_3 = (
            previous_values.iloc[-3]
            if len(previous_values) >= 3
            else float("nan")
        )

        rate_change = (
            current[sensor] - lag_1
            if len(previous_values) >= 1
            else float("nan")
        )

        recent_values = previous_values.tail(3)

        if len(recent_values) == 3:

            rolling_mean = recent_values.mean()
            rolling_std = recent_values.std()
            rolling_min = recent_values.min()
            rolling_max = recent_values.max()

        else:

            rolling_mean = float("nan")
            rolling_std = float("nan")
            rolling_min = float("nan")
            rolling_max = float("nan")

        features[f"{sensor}_lag_1"] = lag_1
        features[f"{sensor}_lag_3"] = lag_3
        features[f"{sensor}_rate_change"] = rate_change
        features[f"{sensor}_rolling_mean"] = rolling_mean
        features[f"{sensor}_rolling_std"] = rolling_std
        features[f"{sensor}_rolling_min"] = rolling_min
        features[f"{sensor}_rolling_max"] = rolling_max

    input_data = pd.DataFrame([features])

    if hasattr(ml_model, "feature_names_in_"):

        input_data = input_data.reindex(
            columns=ml_model.feature_names_in_
        )

    if input_data.shape[1] != 56:

        raise ValueError(
            f"Expected 56 features, got {input_data.shape[1]}"
        )

    return input_data


# =========================================================
# WATER QUALITY PREDICTION
# =========================================================

@app.post(
    "/api/predict",
    response_model=PredictionResponse
)
def predict_water_quality(
    request: PredictionRequest,
    station_id: Optional[int] = None,
    db: Session = Depends(get_db)
):

    try:

        current = {
            sensor: getattr(request, sensor)
            for sensor in SENSOR_COLUMNS
        }

        history = []

        if station_id is not None:

            station = (
                db.query(Station)
                .filter(Station.id == station_id)
                .first()
            )

            if not station:

                raise HTTPException(
                    status_code=404,
                    detail="Station not found"
                )

            previous_readings = (
                db.query(SensorReading)
                .filter(
                    SensorReading.station_id == station_id
                )
                .order_by(
                    SensorReading.recorded_at.desc(),
                    SensorReading.id.desc()
                )
                .limit(3)
                .all()
            )

            previous_readings.reverse()

            history = [
                {
                    sensor: getattr(reading, sensor)
                    for sensor in SENSOR_COLUMNS
                }
                for reading in previous_readings
            ]

        input_data = prepare_prediction_features(
            current,
            history
        )

        ml_prediction = ml_model.predict(input_data)[0]
        probabilities = ml_model.predict_proba(input_data)[0]

        probability_result = {
            str(label): round(float(probability) * 100, 2)
            for label, probability in zip(
                ml_model.classes_,
                probabilities
            )
        }

        violations = []
        parameter_status = {}

        for sensor in SENSOR_COLUMNS:

            value = current[sensor]

            violation = evaluate_sensor_value(sensor, value)

            if sensor not in THRESHOLD_RULES:

                parameter_status[sensor] = "Threshold not configured"

            elif violation:

                parameter_status[sensor] = violation["severity"]
                violations.append(violation)

            else:

                parameter_status[sensor] = "Within configured range"

        if not violations:

            final_status = "Normal"

        else:

            highest_severity = max(
                violations,
                key=lambda item: SEVERITY_ORDER[item["severity"]]
            )["severity"]

            if highest_severity in ["Low", "Medium"]:
                final_status = "Warning"
            elif highest_severity == "High":
                final_status = "Poor"
            else:
                final_status = "Critical"

        return {
            "predicted_status": final_status,
            "ml_predicted_status": str(ml_prediction),
            "probabilities": probability_result,
            "parameter_status": parameter_status,
            "violations": violations,
            "model_note": (
                "Final status combines configurable threshold "
                "validation with experimental Random Forest "
                "prediction. ML prediction is displayed separately. "
                "Thresholds are prototype demonstration values, "
                "not certified regulatory limits."
            )
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )


# =========================================================
# ANOMALY DETECTION
# =========================================================

@app.post("/api/anomaly-detect")
def detect_anomaly(request: PredictionRequest):

    try:

        input_data = pd.DataFrame([{
            "ph": request.ph,
            "temperature": request.temperature,
            "turbidity": request.turbidity,
            "dissolved_oxygen": request.dissolved_oxygen,
            "conductivity": request.conductivity,
            "tds": request.tds,
            "orp": request.orp
        }])

        prediction = anomaly_model.predict(input_data)[0]

        anomaly_score = (
            -anomaly_model.decision_function(input_data)[0]
        )

        status = (
            "Anomaly"
            if prediction == -1
            else "Normal"
        )

        return {
            "anomaly_status": status,
            "anomaly_score": round(float(anomaly_score), 4),
            "model_note": (
                "Isolation Forest identifies unusual sensor "
                "patterns. An anomaly is not proof of water "
                "contamination. Further investigation and proper "
                "testing are required."
            )
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Anomaly detection failed: {str(error)}"
        )


# =========================================================
# TIME-SERIES SENSOR FORECASTING
# =========================================================

@app.get("/api/forecast/{station_id}")
def forecast_water_quality(
    station_id: int,
    db: Session = Depends(get_db)
):

    try:

        station = (
            db.query(Station)
            .filter(Station.id == station_id)
            .first()
        )

        if not station:

            raise HTTPException(
                status_code=404,
                detail="Station not found"
            )

        recent_readings = (
            db.query(SensorReading)
            .filter(
                SensorReading.station_id == station_id
            )
            .order_by(
                SensorReading.recorded_at.desc(),
                SensorReading.id.desc()
            )
            .limit(FORECAST_WINDOW_SIZE)
            .all()
        )

        if len(recent_readings) < FORECAST_WINDOW_SIZE:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"At least {FORECAST_WINDOW_SIZE} readings "
                    "are required for forecasting."
                )
            )

        recent_readings.reverse()

        feature_values = []

        for reading in recent_readings:

            for sensor in FORECAST_SENSORS:

                value = getattr(reading, sensor)

                if value is None:

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"A reading has a missing value "
                            f"for sensor: {sensor}"
                        )
                    )

                feature_values.append(float(value))

        if len(feature_values) != len(FORECAST_FEATURE_NAMES):

            raise ValueError("Forecast feature count mismatch")

        input_data = pd.DataFrame(
            [feature_values],
            columns=FORECAST_FEATURE_NAMES
        )

        predictions = forecast_model.predict(input_data)[0]

        forecast_values = {
            sensor: round(float(value), 4)
            for sensor, value in zip(
                FORECAST_SENSORS,
                predictions
            )
        }

        last_reading_time = recent_readings[-1].recorded_at

        forecast_time = last_reading_time + timedelta(
            minutes=FORECAST_INTERVAL
        )

        return {
            "station_id": station_id,
            "station_name": station.station_name,
            "forecast_for": forecast_time.isoformat(),
            "forecast_interval_minutes": FORECAST_INTERVAL,
            "input_readings": FORECAST_WINDOW_SIZE,
            "predicted_values": forecast_values,
            "model_metrics": forecast_package["metrics"],
            "model_note": (
                "Experimental Random Forest one-step-ahead "
                "forecast trained on synthetic sensor data. "
                "Forecasts require validation against real "
                "sensor readings and are not certified "
                "water-quality measurements."
            )
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Forecasting failed: {str(error)}"
        )
