from agent import search_google
from playwright.sync_api import sync_playwright
import queue
from datetime import datetime, timedelta

def dump_google_html():
    q = queue.Queue()
    date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
    origin = "DFW"
    destination = "MIA"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Manually navigate to URL to control it
        url = f"https://www.google.com/travel/flights?q=Flights+from+{origin}+to+{destination}+on+{date}"
        print(f"Navigating to {url}")
        page.goto(url, wait_until="networkidle", timeout=30000)
        
        # Dump HTML
        import os
        output_dir = "_output"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{output_dir}/google_debug_{timestamp}.html"
        
        content = page.content()
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Dumped {len(content)} bytes to {filename}")
        
        browser.close()

if __name__ == "__main__":
    dump_google_html()
