from agent import search_flights
import time

print("Testing search_flights generator...")
start = time.time()
try:
    gen = search_flights("NYC", "LON", "2025-02-10", 0, {})
    first = next(gen)
    print(f"First yield received after {time.time() - start:.4f}s: {first}")
    
    # Try next one (should be browser launch)
    print("Waiting for second yield (browser launch)...")
    second = next(gen)
    print(f"Second yield received: {second}")
    
except Exception as e:
    print(f"Error: {e}")
