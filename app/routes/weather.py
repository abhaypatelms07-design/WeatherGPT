from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import WeatherResponse, ForecastResponse
from app.services import weather_service
import httpx

router = APIRouter()


@router.get("/weather", response_model=WeatherResponse)
async def get_weather(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude of the location"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude of the location"),
):
    """
    Get current weather for a location.
    Example: GET /api/weather?latitude=28.61&longitude=77.23
    """
    try:
        return await weather_service.get_current_weather(latitude, longitude)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Weather service timed out. Please try again.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Weather provider error: {e.response.status_code}")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Weather service unavailable. All providers failed.")
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected error fetching weather data.")


@router.get("/forecast", response_model=ForecastResponse)
async def get_forecast(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude of the location"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude of the location"),
    days: int = Query(7, ge=1, le=16, description="Number of forecast days (1-16)"),
):
    """
    Get multi-day weather forecast for a location.
    Example: GET /api/forecast?latitude=28.61&longitude=77.23&days=7
    """
    try:
        return await weather_service.get_forecast(latitude, longitude, days)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Forecast service timed out. Please try again.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Weather provider error: {e.response.status_code}")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Weather service unavailable. All providers failed.")
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected error fetching forecast data.")
