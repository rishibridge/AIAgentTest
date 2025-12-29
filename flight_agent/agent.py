import time
import re
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright

def get_timestamp():
    return datetime.now().strftime("[%H:%M:%S]")

def log(q, msg, type="progress-msg"):
    if q:
        q.put({"type": "log", "message": f"{get_timestamp()} {msg}", "log_type": type})


def parse_flight_card(text, filters=None):
    """
    Parses a single flight card text to extract price, airline, times, etc.
    Returns a result dict or None if invalid/filtered.
    Prioritizes Main/Standard fare prices over Basic Economy.
    """
    if len(text) < 20 or "$" not in text:
        return None

    # Split text into token blocks or lines
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    # Fare class keywords
    main_fare_labels = ["main", "main cabin", "standard", "economy plus", "comfort+", "regular", "flex"]
    basic_fare_labels = ["basic", "saver", "value", "super saver", "wanna get away", "light", "lite", "economy light", "economy basic", "restricted"]
    
    # Fee terms to ignore
    fee_terms = ["bag", "fee", "add-on", "seat", "upgrade", "priority", "checked"]
    
    main_fare_prices = []  # Prices explicitly tied to main/standard fares
    fallback_prices = []   # Prices not tied to basic fares (neutral)
    
    # Strategy 1: Look for explicit fare sections in the card
    # Google Flights often shows "Main $XXX" or "Basic Economy $XXX" patterns
    text_lower = text.lower()
    
    # Find all prices with their line context
    for i, line in enumerate(lines):
        price_match = re.search(r'\$(\d{1,3}(?:,\d{3})*)', line)
        if not price_match:
            continue
            
        price_val = float(price_match.group(1).replace(',', ''))
        line_lower = line.lower()
        
        # Skip fee-related prices
        if any(fee in line_lower for fee in fee_terms):
            continue
        
        # Build context: 3 lines before and after
        context_lines = []
        for j in range(max(0, i-3), min(len(lines), i+4)):
            context_lines.append(lines[j].lower())
        context = ' '.join(context_lines)
        
        # Check if this price is explicitly tied to a fare class
        is_main_fare = any(label in context for label in main_fare_labels)
        is_basic_fare = any(label in context for label in basic_fare_labels)
        
        if is_main_fare and not is_basic_fare:
            # Explicitly a main fare price - priority!
            main_fare_prices.append(price_val)
        elif not is_basic_fare:
            # Not explicitly basic - could be the only price shown
            fallback_prices.append(price_val)
        # If is_basic_fare, we skip this price entirely
    
    # Pick the best price
    if main_fare_prices:
        best_price_val = min(main_fare_prices)  # Cheapest main fare
    elif fallback_prices:
        best_price_val = min(fallback_prices)   # Cheapest non-basic
    else:
        return None
    
    price_str = f"${int(best_price_val):,}"
    
    # Extract Metadata
    # Times (First occurrence)
    times_match = re.search(r'(\d{1,2}:\d{2}\s*[ap]m?)\s*[-–]\s*(\d{1,2}:\d{2}\s*[ap]m?)', text, re.IGNORECASE)
    times = times_match.group(0) if times_match else "Unknown"
    
    # Airline
    airline = "Unknown"
    for line in lines[:5]:
        if len(line) > 2 and len(line) < 50 and "$" not in line and ":" not in line and "stop" not in line.lower():
            airline = line
            break

    # Stops
    stops = 0
    text_lower = text.lower()
    if "nonstop" in text_lower or "direct" in text_lower:
        stops = 0
    else:
        stops_match = re.search(r'(\d+)\s*stop', text, re.IGNORECASE)
        stops = int(stops_match.group(1)) if stops_match else 1
    
    # Flight numbers - multiple patterns
    flight_number = ""
    # Pattern 1: Standard IATA format (AA1234, UA567)
    flight_nums = re.findall(r'\b([A-Z]{2}\d{1,4})\b', text)
    if flight_nums:
        flight_number = ', '.join(flight_nums[:3])
    else:
        # Pattern 2: "Airline 123" format (American 123, United 456)
        airline_num_match = re.search(r'(?:American|United|Delta|Southwest|JetBlue|Alaska|Spirit|Frontier)\s*(\d{1,4})', text, re.IGNORECASE)
        if airline_num_match:
            flight_number = airline_num_match.group(0)
    
    # Connecting airports / layover info
    # Look for patterns like "1 stop in Chicago" or "via ORD" or airport codes after "stop"
    layover = ""
    layover_match = re.search(r'stop\s+(?:in\s+)?([A-Za-z\s]+?)(?:\s*\d|$)', text, re.IGNORECASE)
    if layover_match:
        layover = layover_match.group(1).strip()
    # Also check for "via XXX" pattern
    via_match = re.search(r'via\s+([A-Z]{3})', text)
    if via_match:
        layover = via_match.group(1)
    # Check for duration like "2h 30m" layover
    duration_match = re.search(r'(\d+h\s*\d*m?)\s*(?:layover|stop)', text, re.IGNORECASE)
    layover_duration = duration_match.group(1) if duration_match else ""
    
    # Filter
    if filters and filters.get("stops") != "any":
        if stops > int(filters.get("stops")):
            return None

    return {
        "price_val": best_price_val,
        "price_str": price_str,
        "airline": airline,
        "times": times,
        "stops": stops,
        "flight_number": flight_number,
        "layover": layover,
        "layover_duration": layover_duration,
        "date": "N/A" # Filled by caller
    }

def extract_results(page, date, filters, q):
    results = []
    # Use robust selectors
    selectors = [
        '[role="listitem"]',
        '.pIav2d',
        'div[jsaction^="click.select_flight"]',
        'div[jscontroller]',
        '.resultWrapper',
        '[data-resultid]',
        'div[class*="result"]'
    ]
    
    cards = []
    for sel in selectors:
        found = page.locator(sel).all()
        if len(found) > 2:
            cards = found
            log(q, f"Found {len(found)} elements using {sel}")
            break
    
    if not cards:
        log(q, f"Found 0 elements")
    
    for card in cards[:15]:
        try:
            text = card.inner_text()
            res = parse_flight_card(text, filters)
            if res:
                res['url'] = page.url
                res['date'] = date
                
                log(q, f"✓ {res['airline']} - {res['price_str']} ({res['stops']} stop)")
                results.append(res)
        except Exception as e:
            continue
            
    return results

def run_search_thread(origins, destinations, dep_start, dep_end, mode, dur_min, dur_max, ret_start, ret_end, filters, source, email, q):
    from itertools import product
    try:
        # Parse dates
        dep_start_dt = datetime.strptime(dep_start, "%Y-%m-%d")
        dep_end_dt = datetime.strptime(dep_end, "%Y-%m-%d")
        
        # Generate all departure dates in range
        dep_days = (dep_end_dt - dep_start_dt).days + 1
        dep_dates = [(dep_start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(dep_days)]
        
        # Generate date pairs based on mode
        date_pairs = []
        if mode == 'return' and ret_start and ret_end:
            # Return window mode: all combinations of dep dates x return dates
            ret_start_dt = datetime.strptime(ret_start, "%Y-%m-%d")
            ret_end_dt = datetime.strptime(ret_end, "%Y-%m-%d")
            ret_days = (ret_end_dt - ret_start_dt).days + 1
            ret_dates = [(ret_start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(ret_days)]
            date_pairs = list(product(dep_dates, ret_dates))
        else:
            # Duration mode: for each dep date, return = dep + dur_min to dep + dur_max
            for dep_d in dep_dates:
                dep_dt = datetime.strptime(dep_d, "%Y-%m-%d")
                for dur in range(dur_min, dur_max + 1):
                    ret_d = (dep_dt + timedelta(days=dur)).strftime("%Y-%m-%d")
                    date_pairs.append((dep_d, ret_d))
        
        # Generate all origin-destination pairs
        route_pairs = list(product(origins, destinations))
        
        # Total combinations
        total = len(route_pairs) * len(date_pairs)
        log(q, f"Checking {total} combinations ({len(route_pairs)} routes × {len(date_pairs)} date pairs)...", "system-msg")
        
        count = 0
        
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 720}
            )
            page = context.new_page()
            
            all_results = []
            
            for origin, destination in route_pairs:
                for dep_d, ret_d in date_pairs:
                    count += 1
                    # Construct URL based on Source and Trip Type
                    if source == "google":
                        query = f"Flights from {origin} to {destination} on {dep_d}"
                        if ret_d:
                            query += f" returning {ret_d}"
                        url = f"https://www.google.com/travel/flights?q={query.replace(' ', '+')}"
                        
                        try:
                            log(q, f"[{count}/{total}] {origin}→{destination} {dep_d} - {ret_d}", "progress-msg")
                            page.goto(url, wait_until="networkidle", timeout=60000)
                            
                            try:
                                page.click('button:has-text("Accept all")', timeout=2000)
                            except: pass
                            
                            res = extract_results(page, dep_d, filters, q)
                            all_results.extend(res)
                        except Exception as e:
                            log(q, f"Failed: {e}", "error-msg")

                    elif source == "kayak":
                        path = f"{origin}-{destination}/{dep_d}"
                        if ret_d:
                            path += f"/{ret_d}"
                        url = f"https://www.kayak.com/flights/{path}?sort=price_a"
                        
                        try:
                            log(q, f"[{count}/{total}] {origin}→{destination} {dep_d}", "progress-msg")
                            page.goto(url, wait_until="domcontentloaded", timeout=60000)
                            page.wait_for_timeout(5000)
                            res = extract_results(page, dep_d, filters, q)
                            all_results.extend(res)
                        except Exception as e:
                            log(q, f"Failed: {e}", "error-msg")
                    
                    elif source == "skyscanner":
                        # Skyscanner URL format: /transport/flights/ORIGIN/DEST/YYMMDD/YYMMDD/
                        dep_fmt = dep_d.replace("-", "")[2:]  # 2026-03-01 -> 260301
                        ret_fmt = ret_d.replace("-", "")[2:] if ret_d else ""
                        if ret_fmt:
                            url = f"https://www.skyscanner.com/transport/flights/{origin}/{destination}/{dep_fmt}/{ret_fmt}/?adultsv2=1&cabinclass=economy&childrenv2=&inboundaltsenabled=false&outboundaltsenabled=false&preferdirects=false&ref=home&rtn=1"
                        else:
                            url = f"https://www.skyscanner.com/transport/flights/{origin}/{destination}/{dep_fmt}/?adultsv2=1&cabinclass=economy&childrenv2=&outboundaltsenabled=false&preferdirects=false&ref=home&rtn=0"
                        
                        try:
                            log(q, f"[{count}/{total}] {origin}→{destination} {dep_d}", "progress-msg")
                            page.goto(url, wait_until="domcontentloaded", timeout=60000)
                            page.wait_for_timeout(8000)  # Skyscanner loads slower
                            res = extract_results(page, dep_d, filters, q)
                            all_results.extend(res)
                        except Exception as e:
                            log(q, f"Failed: {e}", "error-msg")
                    
                    time.sleep(2)
            
            browser.close()
        
        if all_results:
            all_results.sort(key=lambda x: x['price_val'])
            winner = all_results[0]
            log(q, f"✓ BEST: {winner['airline']} on {winner['date']} - {winner['price_str']}", "success-msg")
            
            # Send email if requested
            if email:
                send_results_email(email, winner, origin, destination, q)
            
            q.put({"type": "result_found", "data": winner})
        else:
            log(q, "No results found", "error-msg")
            if email:
                send_no_results_email(email, origin, destination, q)
            
    except Exception as e:
        log(q, f"ERROR: {str(e)}", "error-msg")
        q.put({"type": "error", "message": str(e)})
    finally:
        q.put({"type": "complete"})
        q.put(None)

def send_results_email(to_email, result, origin, destination, q):
    """Send flight results via Brevo"""
    import os
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException
    
    try:
        api_key = os.getenv("BREVO_API_KEY")
        if not api_key:
            log(q, "BREVO_API_KEY not set", "error-msg")
            return
        
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
        
        html_content = f"""
        <h2>✈️ Flight Deal Found!</h2>
        <p><strong>Route:</strong> {origin} → {destination}</p>
        <p><strong>Date:</strong> {result['date']}</p>
        <p><strong>Price:</strong> <span style="color: green; font-size: 24px;">{result['price_str']}</span></p>
        <p><strong>Airline:</strong> {result['airline']}</p>
        <p><strong>Times:</strong> {result['times']}</p>
        <br>
        <a href="{result['url']}" style="background: #38bdf8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Book Now</a>
        """
        
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": to_email}],
            sender={"name": "AeroSearch", "email": "admin@unusualinsight.com"},
            subject=f"Flight Deal: {origin} to {destination} - {result['price_str']}",
            html_content=html_content
        )
        
        api_response = api_instance.send_transac_email(send_smtp_email)
        log(q, f"✓ Email sent! Message ID: {api_response.message_id}", "success-msg")
        log(q, f"DEBUG: Brevo Response: {api_response}", "system-msg")
    except ApiException as e:
        log(q, f"Email API Error: {e.status} - {e.body}", "error-msg")
    except Exception as e:
        log(q, f"Email Error: {str(e)}", "error-msg")

def send_no_results_email(to_email, origin, destination, q):
    """Send notification that no results were found"""
    import os
    import sib_api_v3_sdk
    from sib_api_v3_sdk.rest import ApiException
    
    try:
        api_key = os.getenv("BREVO_API_KEY")
        if not api_key:
            return
        
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = api_key
        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
        
        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": to_email}],
            sender={"name": "AeroSearch", "email": "admin@unusualinsight.com"},
            subject=f"No flights found: {origin} to {destination}",
            html_content=f"<p>Sorry, no flights matching your criteria were found for {origin} → {destination}.</p>"
        )
        
        api_response = api_instance.send_transac_email(send_smtp_email)
        log(q, f"No-results email sent. ID: {api_response.message_id}", "system-msg")
    except ApiException as e:
        log(q, f"Email API Error: {e.status} - {e.body}", "error-msg")
    except Exception:
        pass
