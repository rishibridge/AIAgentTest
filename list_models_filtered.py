import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("No API Key found")
    exit()

client = genai.Client(api_key=api_key)

print("Listing FLASH models...")
try:
    for m in client.models.list(config={"page_size": 100}):
        if "flash" in m.name.lower():
            print(f"Model: {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
