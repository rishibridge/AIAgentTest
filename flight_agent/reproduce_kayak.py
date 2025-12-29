from agent import search_kayak
from playwright.sync_api import sync_playwright
import queue
import time
from datetime import datetime, timedelta
import sys

# Set execution encoding to utf-8 to handle emojis
sys.stdout.reconfigure(encoding='utf-8')

def test_kayak():
    q = queue.Queue()
    # Test a realistic date (2 months out)
    date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
    origin = "JFK" # Use major hub
    destination = "LHR"
    
    print(f"Testing Kayak for {origin}->{destination} on {date}")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox", 
                "--disable-blink-features=AutomationControlled"
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        
        # Call the search function
        results = search_kayak(page, origin, destination, date, {}, q)
        
        print("\n--- QUEUE LOGS ---")
        while not q.empty():
            msg = q.get()
            print(msg)
            
        print(f"\nFound {len(results)} results")
        
        browser.close()

if __name__ == "__main__":
    test_kayak()
