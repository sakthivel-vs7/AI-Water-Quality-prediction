
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class StationCreate(BaseModel):
    station_name: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class StationResponse(BaseModel):
    id: int
    station_name: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class SensorReadingCreate(BaseModel):
    station_id: int
    recorded_at: datetime
    ph: Optional[float] = None
    temperature: Optional[float] = None
    turbidity: Optional[float] = None
    dissolved_oxygen: Optional[float] = None
    conductivity: Optional[float] = None
    tds: Optional[float] = None
    orp: Optional[float] = None


class SensorReadingResponse(BaseModel):
    id: int
    station_id: int
    recorded_at: datetime
    ph: Optional[float] = None
    temperature: Optional[float] = None
    turbidity: Optional[float] = None
    dissolved_oxygen: Optional[float] = None
    conductivity: Optional[float] = None
    tds: Optional[float] = None
    orp: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class PredictionRequest(BaseModel):
    ph: float
    temperature: float
    turbidity: float
    dissolved_oxygen: float
    conductivity: float
    tds: float
    orp: float


class PredictionResponse(BaseModel):
    predicted_status: str
    ml_predicted_status: str
    probabilities: dict[str, float]
    parameter_status: dict[str, str]
    violations: list[dict]
    model_note: str


class WaterQualityAlertResponse(BaseModel):
    id: int
    station_id: int
    sensor_name: str
    observed_value: Optional[float] = None
    threshold_value: Optional[float] = None
    message: str
    severity: str
    status: str
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
