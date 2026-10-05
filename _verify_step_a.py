from app.config import settings
k = settings.weatherapi_key
g = settings.gemini_api_key
print('WEATHERAPI_KEY present:', bool(k), 'length:', len(k))
print('GEMINI_API_KEY present:', bool(g), 'length:', len(g))
