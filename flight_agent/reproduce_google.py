from playwright.sync_api import sync_playwright
import queue
import time
from datetime import datetime, timedelta

def test_google():
    q = queue.Queue()
    date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
    origin = "JFK"
    destination = "LHR"
    
    print(f"Testing Google Flights for {origin}->{destination} on {date}")
    
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
        base_url = f"https://www.google.com/travel/flights?q=Flights+from+{origin}+to+{destination}+on+{date}"
        variations = [
            ("Baseline", base_url),
            ("NB=1", base_url + "&nb=1"),
            ("Bags=1", base_url + "&bags=1"),
            ("SC=e", base_url + "&sc=e"), # Service Class Economy
            ("PX=1", base_url + "&px=1"), # Passengers
        ]

        for name, url in variations:
            print(f"\nTesting {name}...")
            page.goto(url, wait_until="networkidle", timeout=60000)
            
            # Click accept if needed
            try: page.click('button:has-text("Accept all")', timeout=1000)
            except: pass
            
            # Count results
            count = page.locator('[role="listitem"]').count()
            print(f"  Results: {count}")
            
            # Check price of first result
            try:
                first = page.locator('[role="listitem"]').first().inner_text()
                price = "Unknown"
                if "$" in first:
                    import re
                    m = re.search(r'\$(\d+)', first)
                    if m: price = m.group(0)
                print(f"  First Price: {price}")
            except: pass
            
        browser.close()

if __name__ == "__main__":
    test_google()
