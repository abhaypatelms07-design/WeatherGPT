print("Simple test running...")
try:
    import asyncio
    print("asyncio imported successfully")
    import app
    print("app imported successfully")
    from app.services import ai_service
    print("ai_service imported successfully")
    print("SUCCESS")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()