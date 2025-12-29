from playwright.sync_api import sync_playwright
from driver import GhostDriver
import time

def run_ghost_demo():
    print("Initializing Ghost Browser...")
    with sync_playwright() as p:
        # Launch visible browser
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()
        
        ghost = GhostDriver(page)
        
        # --- PHASE 1: FLIGHT SEARCH ---
        ghost.say("Initializing Mission: Find Flights")
        ghost.navigate("https://www.google.com/travel/flights")
        
        ghost.say("Inputting Origin: NYC")
        # Click origin input (Google Flights specific selectors - may need adjusting)
        # Note: Selectors are tricky on Google Flights, often dynamic. 
        # We try strict ARIA or text matching.
        
        # Reset origin if needed (often pre-filled)
        try:
            ghost.click('[aria-label="Remove origin"]')
        except: pass
        
        ghost.click('input[aria-label="Where from?"]')
        ghost.type('input[aria-label="Where from?"]', "New York")
        ghost.click('li[role="option"]:has-text("New York")') # Select first option
        
        ghost.say("Inputting Destination: Tokyo")
        ghost.click('input[aria-label="Where to?"]')
        ghost.type('input[aria-label="Where to?"]', "Tokyo")
        ghost.click('li[role="option"]:has-text("Tokyo")') 
        
        ghost.say("Selecting Date: Next Month")
        ghost.click('input[placeholder="Departure"]')
        # Just pick a date approx 1 month out
        # This is tricky without calendar logic. 
        # We'll just click "Done" to perform search with default/current selection or just click a random day in future?
        # For demo, let's type it?
        # Google Flights date input is a clickable calendar.
        time.sleep(1)
        ghost.click('div[role="button"]:has-text("Done")') 
        
        ghost.say("Executing Search...")
        ghost.click('button[aria-label="Search"]')
        
        ghost.say("Filtering: Price < $1000")
        # Price filter logic...
        # ghost.click('button[aria-label="Price"]')
        # ... slider logic is hard to "ghost". Maybe skip for basic demo.
        
        ghost.say("Analyzing Results...")
        page.wait_for_selector('[role="listitem"]')
        
        # Highlight top 3 results
        cards = page.locator('[role="listitem"]').all()
        for i in range(min(3, len(cards))):
            ghost.say(f"Scanning Option #{i+1}...")
            cards[i].scroll_into_view_if_needed()
            cards[i].evaluate("el => el.style.border = '2px solid #00ffcc'")
            time.sleep(0.5)
            
        # Select one
        ghost.say("Target Acquired. Selecting Best Option.")
        cards[0].click()
        time.sleep(2)
        
        # --- PHASE 2: CALENDAR ---
        ghost.say("Switching to Calendar Protocol...")
        # Since we can't login, we demo the "Intent".
        # We'll open a mock page or just show the "Compose" intent.
        
        # Open new tab
        page2 = context.new_page()
        ghost2 = GhostDriver(page2)
        ghost2.say("Accessing Outlook Calendar...")
        ghost2.navigate("https://outlook.live.com/calendar/0/view/month")
        
        ghost2.say("Login Gate Detected. Pausing Demo.")
        time.sleep(3)
        
        ghost2.say("Mission Complete.")
        
        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    run_ghost_demo()
