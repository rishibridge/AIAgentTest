import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("No API Key found")
    exit()

client = genai.Client(api_key=api_key)

print("Listing available models...")
try:
    # Based on the error message suggestion
    for m in client.models.list(config={"page_size": 100}):
        print(f"Model: {m.name}")
        print(f"  DisplayName: {m.display_name}")
except Exception as e:
    print(f"Error listing models: {e}")
