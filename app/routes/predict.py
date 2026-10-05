"""
predict.py - POST /api/predict endpoint

Accepts 9 weather features and returns a rainfall risk prediction
from the pre-trained Random Forest model.
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import PredictRequest, PredictResponse
from app.services import predict_service

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
async def predict(r: PredictRequest):
    """
    Predict rainfall/weather risk using a pre-trained Random Forest model.

    Supply 9 weather features. Returns risk_level, risk_label, confidence,
    message, and disclaimer.

    NOTE: Model was trained on synthetic data - for demo use only.
    """
    try:
        result = predict_service.predict_risk(
            temperature=r.temperature,
            humidity=r.humidity,
            rainfall_mm=r.rainfall_mm,
            wind_speed_kmh=r.wind_speed_kmh,
            rain_probability=r.rain_probability,
            cloud_cover=r.cloud_cover,
            visibility_km=r.visibility_km,
            precipitation_mm=r.precipitation_mm,
            uv_index=r.uv_index,
        )
        return PredictResponse(**result)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=f"ML model not available: {e}. Place weather_risk_model.pkl in the ml/ directory.",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"ML model error: {e}")
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected error during prediction.")
