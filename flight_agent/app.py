from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import os
import json
import threading
import queue
from dotenv import load_dotenv
load_dotenv()
from agent import run_search_thread

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search', methods=['POST'])
def search():
    data = request.json
    
    # New date range parameters
    origins = data.get('origins', [])  # Array of airport codes
    destinations = data.get('destinations', [])  # Array of airport codes
    dep_start = data.get('dep_start')  # Earliest departure date
    dep_end = data.get('dep_end')  # Latest departure date
    mode = data.get('mode', 'duration')  # 'duration' or 'return'
    dur_min = int(data.get('dur_min', 7))
    dur_max = int(data.get('dur_max', 10))
    ret_start = data.get('ret_start')  # Return window start (if mode='return')
    ret_end = data.get('ret_end')  # Return window end (if mode='return')
    
    source = data.get('source', 'google')
    email = data.get('email', '')
    filters = {"stops": data.get("stops", "1")}
    
    if not origins or not destinations or not dep_start or not dep_end:
        return jsonify({"error": "Missing fields"}), 400

    @stream_with_context
    def generate():
        q = queue.Queue()
        t = threading.Thread(target=run_search_thread, args=(
            origins, destinations, dep_start, dep_end,
            mode, dur_min, dur_max, ret_start, ret_end,
            filters, source, email, q
        ))
        t.start()
        
        while True:
            event = q.get()
            if event is None:
                break
            
            if event['type'] == 'result_found':
                yield json.dumps({"type": "result", **event['data']}) + "\n"
            else:
                yield json.dumps(event) + "\n"
        
        t.join()
    
    return Response(generate(), mimetype='application/x-ndjson')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
