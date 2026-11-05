
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    station_name = Column(String(150), unique=True, nullable=False)
    location = Column(String(250), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    readings = relationship(
        "SensorReading",
        back_populates="station",
        cascade="all, delete-orphan"
    )

    alerts = relationship(
        "WaterQualityAlert",
        back_populates="station",
        cascade="all, delete-orphan"
    )


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), nullable=False)

    ph = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    turbidity = Column(Float, nullable=True)
    dissolved_oxygen = Column(Float, nullable=True)
    conductivity = Column(Float, nullable=True)
    tds = Column(Float, nullable=True)
    orp = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    station = relationship("Station", back_populates="readings")


class WaterQualityAlert(Base):
    __tablename__ = "water_quality_alerts"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(
        Integer,
        ForeignKey("stations.id"),
        nullable=False,
        index=True
    )

    sensor_name = Column(String(100), nullable=False)
    observed_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    message = Column(String(500), nullable=False)

    severity = Column(String(20), nullable=False)
    status = Column(String(20), default="Open", nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    station = relationship("Station", back_populates="alerts")
