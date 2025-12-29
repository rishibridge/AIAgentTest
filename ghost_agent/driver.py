import time
import random
from playwright.sync_api import Page, Locator

class GhostDriver:
    """
    A wrapper around Playwright Page to simulate a "Ghost" user.
    Adds visual highlighting, slow typing, and dramatic pauses.
    """
    def __init__(self, page: Page):
        self.page = page
        
        # Script to inject styles and HUD
        init_js = """
            const style = document.createElement('style');
            style.innerHTML = `
                .ghost-highlight {
                    box-shadow: 0 0 15px #00ffcc, 0 0 30px #00ffcc inset !important;
                    border: 2px solid #00ffcc !important;
                    transition: all 0.2s ease !important;
                    border-radius: 4px !important;
                    background: rgba(0, 255, 204, 0.1) !important;
                }
                #ghost-hud {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.85);
                    color: #00ffcc;
                    border: 2px solid #00ffcc;
                    padding: 15px 25px;
                    font-family: 'Courier New', monospace;
                    font-size: 16px;
                    border-radius: 8px;
                    z-index: 2147483647; /* Max Z-index */
                    box-shadow: 0 0 20px rgba(0, 255, 204, 0.4);
                    backdrop-filter: blur(5px);
                    transition: all 0.3s ease;
                    max-width: 300px;
                    pointer-events: none;
                }
                #ghost-hud strong {
                    display: block;
                    font-size: 12px;
                    color: #fff;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            `;
            document.head.appendChild(style);

            const div = document.createElement('div');
            div.id = 'ghost-hud';
            div.innerHTML = '<strong>System Status</strong>Standing By...';
            document.body.appendChild(div);
        """
        
        # Add this script to run on every new document (navigation)
        self.page.add_init_script(init_js)
        
        # Run it immediately for the current blank page
        try: self.page.evaluate(init_js)
        except: pass

    def say(self, text):
        """Updates the on-screen HUD."""
        self.speak(text) # Log it
        safe_text = text.replace("'", "\\'")
        # We need to make sure HUD exists, in case simple evaluate failed (race condition)
        # But add_init_script handles most. We'll wrap in try/catch or check.
        js = f"""
            var hud = document.getElementById('ghost-hud');
            if (hud) {{
                hud.innerHTML = '<strong>Ghost Agent</strong>{safe_text}';
            }}
        """
        try:
            self.page.evaluate(js)
        except:
            pass # Page might be transitioning
        time.sleep(0.5)

    def highlight(self, selector):
        """Draws a neon box around the element to show 'focus'."""
        try:
            loc = self.page.locator(selector).first
            loc.scroll_into_view_if_needed()
            loc.evaluate("el => el.classList.add('ghost-highlight')")
            time.sleep(0.4) # Let the user see it
            loc.evaluate("el => el.classList.remove('ghost-highlight')")
        except:
            pass

    def type(self, selector, text):
        """Types text like a human, with variable speed."""
        self.highlight(selector)
        loc = self.page.locator(selector).first
        loc.click()
        
        # Clear existing?
        # loc.fill("") # Optional, sometimes we want to append
        
        for char in text:
            loc.press(char)
            time.sleep(random.uniform(0.05, 0.15)) # Human typing speed
        
        time.sleep(0.5)

    def click(self, selector):
        """Clicks an element after highlighting it."""
        self.highlight(selector)
        self.page.locator(selector).first.click()
        time.sleep(1.0) # Pause after action

    def navigate(self, url):
        self.page.goto(url)
        self.page.wait_for_load_state('domcontentloaded')
        time.sleep(1)

    def speak(self, text):
        """
        Optional: Start a TTS or just print to console/UI?
         For now, we'll just log it heavily.
        """
        print(f"[GHOST] {text}")
