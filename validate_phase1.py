import sys
import os

# 1.1 Check imports
try:
    import fastapi, uvicorn, httpx, pydantic, pydantic_settings
    from google import genai
    print("1.1 IMPORTS: All imports OK")
except ImportError as e:
    print(f"1.1 IMPORTS FAILED: {e}")

# 1.2 Check GEMINI_API_KEY presence (NO value)
from dotenv import load_dotenv
load_dotenv()
key = os.getenv('GEMINI_API_KEY', '')
print(f"1.2 GEMINI_API_KEY present: {bool(key)} | length: {len(key)}")

# 1.3 Check .gitignore
try:
    content = open('.gitignore').read()
    print(f"1.3 .env in gitignore: {'.env' in content}")
except Exception as e:
    print(f"1.3 .gitignore check failed: {e}")
