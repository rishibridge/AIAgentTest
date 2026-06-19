import React, { useState } from 'react';
import './index.css';
import { Play, Upload, MessageSquare, BrainCircuit, Activity, Database, Settings } from 'lucide-react';

function App() {
  const [activeView, setActiveView] = useState('playground');

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <div className="sidebar">
        <div className="brand">
          <BrainCircuit /> Prism Console
        </div>
        
        <NavButton icon={<Play />} label="Playground" active={activeView === 'playground'} onClick={() => setActiveView('playground')} />
        <NavButton icon={<Database />} label="Memory Inspector" active={activeView === 'memory'} onClick={() => setActiveView('memory')} />
        <NavButton icon={<Activity />} label="Reasoning Viewer" active={activeView === 'reasoning'} onClick={() => setActiveView('reasoning')} />
        <NavButton icon={<Settings />} label="Config Studio" active={activeView === 'config'} onClick={() => setActiveView('config')} />
      </div>

      {/* Main Content Area */}
      <div className="main-area">
        {activeView === 'playground' && <Playground />}
        {activeView === 'memory' && <MemoryInspector />}
        {activeView === 'reasoning' && <ReasoningViewer />}
        {activeView === 'config' && <div className="view-container">Config Studio coming soon...</div>}
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`nav-btn ${active ? 'active' : ''}`}
    >
      {React.cloneElement(icon, { size: 18 })}
      <span>{label}</span>
    </button>
  );
}

function Playground() {
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = React.useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus("Extracting concepts...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", "demo-session-123");

    try {
      const response = await fetch("http://localhost:8000/api/v1/sessions/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      setUploadStatus(`Extracted ${data.nodes_added} memory nodes.`);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadStatus("Upload failed.");
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/v1/reasoning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: "demo-session-123",
          question: question,
          persona_pack: "legal",
          rounds: 1,
          adjudication_mode: "force_winner"
        })
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Analysis failed:", error);
      setResults({
        judge: {
          verdict: "Error: Could not connect to Prism API. Make sure the backend is running.",
          confidence: 0,
          bias_flags: []
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h1 className="view-title">Playground</h1>
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleUpload} 
            accept=".txt,.pdf,.docx,.png,.jpeg,.jpg"
          />
          <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
             <Upload size={16} /> Upload Document
          </button>
          {uploadStatus && <span style={{marginLeft: '10px', fontSize: '12px', color: '#8b949e'}}>{uploadStatus}</span>}
        </div>
      </div>

      <div className="playground-card">
        <div className="results-area">
          {results ? (
            <div className="adjudication-result">
              <h3 className="result-title">
                <BrainCircuit size={20} /> Adjudication Result
              </h3>
              <p className="result-verdict">{results.judge.verdict}</p>
              <div className="bias-flags">
                {results.judge.bias_flags?.map((flag, i) => (
                  <span key={i} className="badge-warning">
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          ) : (
             <div className="empty-state">
                <MessageSquare size={48} />
                <p>Upload a document and ask a question to begin.</p>
             </div>
          )}
        </div>

        <div className="input-wrapper">
          <input 
            type="text" 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="E.g., Did the PCP meet the standard of care?" 
            className="chat-input"
          />
          <button 
            onClick={runAnalysis}
            disabled={loading || !question}
            className="analyze-btn"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryInspector() {
  const [memory, setMemory] = useState({ nodes: [], edges: [] });
  
  React.useEffect(() => {
    fetch("http://localhost:8000/api/v1/sessions/demo-session-123/memory")
      .then(res => res.json())
      .then(data => setMemory(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="view-container">
      <div className="view-header">
        <h1 className="view-title">Memory Inspector</h1>
        <p style={{color: '#8b949e'}}>Visualizing the TemporalGraph Substrate</p>
      </div>
      <div className="playground-card" style={{padding: '20px'}}>
        <h3>Extracted Nodes ({memory.nodes.length})</h3>
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px'}}>
          {memory.nodes.length === 0 ? <p>No memory nodes found. Upload a document in the Playground.</p> : null}
          {memory.nodes.map(node => (
            <div key={node.id} style={{padding: '12px', border: '1px solid #30363d', borderRadius: '6px', background: '#0d1117'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                <span className="badge-warning">{node.type}</span>
                <span style={{fontSize: '12px', color: '#8b949e'}}>{node.id.substring(0, 8)}...</span>
              </div>
              <p style={{margin: '0', fontSize: '14px', fontWeight: '500'}}>{node.properties.text}</p>
              <p style={{margin: '5px 0 0 0', fontSize: '12px', color: '#8b949e'}}>Source: {node.properties.source_doc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReasoningViewer() {
  const [transcript, setTranscript] = useState(null);
  
  React.useEffect(() => {
    fetch("http://localhost:8000/api/v1/sessions/demo-session-123/transcript")
      .then(res => res.json())
      .then(data => {
        if (data && Object.keys(data).length > 0) setTranscript(data);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="view-container">
      <div className="view-header">
        <h1 className="view-title">Reasoning Viewer</h1>
        <p style={{color: '#8b949e'}}>Internal multi-agent debate transcript</p>
      </div>
      
      {!transcript ? (
        <div className="empty-state">
          <Activity size={48} />
          <p>No reasoning transcript available. Run an analysis in the Playground first.</p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          <div style={{padding: '20px', border: '1px solid #30363d', borderRadius: '8px', borderLeft: '4px solid #58a6ff'}}>
            <h3 style={{color: '#58a6ff', marginTop: 0}}>Advocate</h3>
            <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '14px'}}>{JSON.stringify(transcript.advocate, null, 2)}</pre>
          </div>
          
          <div style={{padding: '20px', border: '1px solid #30363d', borderRadius: '8px', borderRight: '4px solid #f85149', textAlign: 'right'}}>
            <h3 style={{color: '#f85149', marginTop: 0}}>Skeptic</h3>
            <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '14px', textAlign: 'left'}}>{JSON.stringify(transcript.skeptic, null, 2)}</pre>
          </div>
          
          <div style={{padding: '20px', border: '1px solid #30363d', borderRadius: '8px', borderTop: '4px solid #3fb950', background: '#0d1117'}}>
            <h3 style={{color: '#3fb950', marginTop: 0}}>Judge (Final Output)</h3>
            <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '14px'}}>{JSON.stringify(transcript.judge, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
