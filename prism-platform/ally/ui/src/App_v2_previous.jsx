import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Brain, MessageCircle, FileText, Shield, ChevronRight, Users, Activity, Zap, RotateCcw, X } from 'lucide-react';
import VirtualBrain from './components/VirtualBrain';
import NodeDetailPanel from './components/NodeDetailPanel';
import * as api from './api';
import { COLORS_DARK, FONT_DISPLAY, FONT_SERIF, FONT_SANS } from './data';

/* ═══════════════════════════════════════════════════════════════════
 * REAL THERAPY COMPANION APP
 * - Patient selection
 * - Live LLM conversation with graph-aware context
 * - Real-time graph visualization
 * - Consolidation trigger
 * - Handoff generation
 * ═══════════════════════════════════════════════════════════════════ */

const C = COLORS_DARK;

function App() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [positions, setPositions] = useState({});
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const [detailKind, setDetailKind] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [highlight, setHighlight] = useState([]);
  const [sidePanel, setSidePanel] = useState(null); // 'consolidation' | 'handoff' | null
  const [consolidationResult, setConsolidationResult] = useState(null);
  const [handoffResult, setHandoffResult] = useState(null);
  const [handoffForm, setHandoffForm] = useState({ name: '', role: '' });
  const [runningConsolidation, setRunningConsolidation] = useState(false);
  const [runningHandoff, setRunningHandoff] = useState(false);
  const chatRef = useRef(null);

  // Load patients on mount
  useEffect(() => {
    api.getPatients().then(setPatients).catch(console.error);
  }, []);

  // Load graph when patient selected
  const loadGraph = useCallback(async (patientId) => {
    try {
      const [graphData, posData] = await Promise.all([
        api.getGraph(patientId),
        api.getGraphPositions(patientId),
      ]);
      setGraph(graphData);
      setPositions(posData);
    } catch (e) { console.error('Graph load error:', e); }
  }, []);

  // Select patient
  const selectPatient = async (patient) => {
    setSelectedPatient(patient);
    setMessages([]);
    setConvId(null);
    setDetailKind(null);
    setDetailTarget(null);
    setHighlight([]);
    setSidePanel(null);
    setConsolidationResult(null);
    setHandoffResult(null);
    await loadGraph(patient.id);
    // Start a new conversation
    try {
      const res = await api.startConversation(patient.id, 'Live session');
      setConvId(res.conversation_id);
    } catch (e) { console.error('Conversation start error:', e); }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || !convId || loading) return;
    const text = input.trim();
    setInput('');
    const patientFirst = selectedPatient.name.split(' ')[0];
    setMessages(m => [...m, { sender: patientFirst.toLowerCase(), text, ts: Date.now() }]);
    setLoading(true);
    try {
      const res = await api.sendMessage(selectedPatient.id, convId, text);
      const botMsg = res.bot_response;
      setMessages(m => [...m, {
        sender: 'ally',
        text: botMsg.text,
        significance: botMsg.significance,
        highlight: botMsg.highlight || [],
        ts: Date.now(),
      }]);
      // Update highlight
      if (botMsg.highlight && botMsg.highlight.length > 0) {
        setHighlight(botMsg.highlight);
        setTimeout(() => setHighlight([]), 5000);
      }
      // Refresh graph (bot may have added nodes/edges)
      if (res.graph_updates && (res.graph_updates.node_updates?.length > 0 || res.graph_updates.edge_updates?.length > 0)) {
        await loadGraph(selectedPatient.id);
      }
    } catch (e) {
      console.error('Send error:', e);
      setMessages(m => [...m, { sender: 'ally', text: "I'm here with you. Tell me more about what's on your mind.", ts: Date.now() }]);
    }
    setLoading(false);
  };

  // Run consolidation
  const runConsolidation = async () => {
    if (runningConsolidation) return;
    setRunningConsolidation(true);
    setConsolidationResult(null);
    setSidePanel('consolidation');
    try {
      const res = await api.triggerConsolidation(selectedPatient.id, convId);
      setConsolidationResult(res);
      await loadGraph(selectedPatient.id);
    } catch (e) {
      setConsolidationResult({ error: e.message });
    }
    setRunningConsolidation(false);
  };

  // Generate handoff
  const runHandoff = async () => {
    if (runningHandoff || !handoffForm.name || !handoffForm.role) return;
    setRunningHandoff(true);
    setHandoffResult(null);
    try {
      const res = await api.generateHandoff(selectedPatient.id, handoffForm.name, handoffForm.role);
      setHandoffResult(res);
    } catch (e) {
      setHandoffResult({ error: e.message });
    }
    setRunningHandoff(false);
  };

  // ── Patient Selection Screen ─────────────────────────────────────
  if (!selectedPatient) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }} className="fade-in">
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 48, fontWeight: 500, color: '#D9B873', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Ally
          </div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 16, color: '#9B9285', fontStyle: 'italic' }}>
            Castle Behavioral Health Companion
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {patients.map((p, i) => (
            <button
              key={p.id}
              onClick={() => selectPatient(p)}
              className="fade-in"
              style={{
                animationDelay: `${i * 0.1}s`,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '32px 40px',
                color: C.ink,
                width: 280,
                textAlign: 'left',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(217,184,115,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 500, color: '#D9B873', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: '#9B9285', marginBottom: 16 }}>Age {p.age} {p.anonymous ? '• Anonymous' : ''}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B665F' }}>
                <span><Brain size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{p.node_count} nodes</span>
                <span><Activity size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{p.edge_count} edges</span>
              </div>
            </button>
          ))}
        </div>
        {patients.length === 0 && (
          <div style={{ color: '#6B665F', fontSize: 14, marginTop: 24 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: 8 }} />
            Loading patients...
          </div>
        )}
      </div>
    );
  }

  // ── Main App Layout ──────────────────────────────────────────────
  const patientFirst = selectedPatient.name.split(' ')[0];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        height: 52, padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', color: '#9B9285', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} /> Patients
          </button>
          <ChevronRight size={12} style={{ color: '#4A4540' }} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: '#D9B873' }}>{selectedPatient.name}</span>
          <span style={{ fontSize: 11, color: '#6B665F', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 10 }}>
            {graph.node_count || 0} nodes • {graph.edge_count || 0} edges
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={runConsolidation}
            disabled={runningConsolidation}
            style={{
              background: sidePanel === 'consolidation' ? 'rgba(95,174,176,0.15)' : 'rgba(255,255,255,0.04)',
              border: '1px solid ' + (sidePanel === 'consolidation' ? 'rgba(95,174,176,0.3)' : 'rgba(255,255,255,0.06)'),
              color: '#5FAEB0', fontSize: 12, padding: '6px 14px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Zap size={13} /> {runningConsolidation ? 'Running...' : 'Consolidate'}
          </button>
          <button
            onClick={() => setSidePanel(sidePanel === 'handoff' ? null : 'handoff')}
            style={{
              background: sidePanel === 'handoff' ? 'rgba(217,184,115,0.15)' : 'rgba(255,255,255,0.04)',
              border: '1px solid ' + (sidePanel === 'handoff' ? 'rgba(217,184,115,0.3)' : 'rgba(255,255,255,0.06)'),
              color: '#D9B873', fontSize: 12, padding: '6px 14px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <FileText size={13} /> Handoff
          </button>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Graph Panel ───────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <VirtualBrain
            nodes={graph.nodes || []}
            edges={graph.edges || []}
            positions={positions}
            highlight={highlight}
            viewBox="0 0 1100 620"
            showFirewall={false}
            opacity={1}
            onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
            onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
            onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
          />
          {detailTarget && (
            <NodeDetailPanel
              kind={detailKind}
              target={detailTarget}
              nodes={graph.nodes || []}
              onClose={() => { setDetailKind(null); setDetailTarget(null); }}
            />
          )}
          {/* Graph status badge */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
            padding: '6px 12px', fontSize: 11, color: '#6B665F',
          }}>
            <span style={{ color: '#5FAEB0' }}>●</span> Live Graph • {graph.node_count || 0} nodes • {graph.edge_count || 0} edges
          </div>
        </div>

        {/* ── Chat Panel ────────────────────────────────────────────── */}
        <div style={{
          width: 380, borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', background: '#080A0E',
        }}>
          {/* Chat header */}
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: '#D9B873' }}>
                <MessageCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Talk to Ally
              </div>
              <div style={{ fontSize: 10, color: '#6B665F', marginTop: 2 }}>
                LLM-powered • Graph-aware • {convId ? 'Connected' : 'Starting...'}
              </div>
            </div>
            <button
              onClick={async () => {
                setMessages([]);
                try {
                  const res = await api.startConversation(selectedPatient.id, 'New session');
                  setConvId(res.conversation_id);
                } catch(e) { console.error(e); }
              }}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.06)', color: '#6B665F', fontSize: 11, padding: '4px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RotateCcw size={11} /> New
            </button>
          </div>

          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
            {messages.length === 0 && !loading && (
              <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px', color: '#4A4540' }}>
                <MessageCircle size={28} style={{ marginBottom: 12, opacity: 0.3 }} />
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Start a conversation as {patientFirst}.<br/>
                  Ally remembers everything.
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className="fade-in"
                style={{
                  marginBottom: 12,
                  display: 'flex', flexDirection: 'column',
                  alignItems: msg.sender === 'ally' ? 'flex-start' : 'flex-end',
                }}
              >
                <div style={{ fontSize: 10, color: '#6B665F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, paddingLeft: 2, paddingRight: 2 }}>
                  {msg.sender === 'ally' ? 'Ally' : patientFirst}
                </div>
                <div style={{
                  background: msg.sender === 'ally' ? 'rgba(95,174,176,0.1)' : 'rgba(255,255,255,0.06)',
                  border: msg.sender === 'ally' ? '1px solid rgba(95,174,176,0.15)' : '1px solid rgba(255,255,255,0.04)',
                  padding: '10px 14px', borderRadius: 12, maxWidth: '88%',
                  fontSize: 13.5, lineHeight: 1.6, color: '#EDEAE3',
                }}>
                  {msg.text}
                  {msg.significance && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#D4A645', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={10} /> significance moment
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="fade-in" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#6B665F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Ally</div>
                <div style={{ background: 'rgba(95,174,176,0.1)', border: '1px solid rgba(95,174,176,0.15)', borderRadius: 12, display: 'inline-block' }}>
                  <div className="typing-dots"><span/><span/><span/></div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={`Talk as ${patientFirst}...`}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#EDEAE3', padding: '10px 14px', borderRadius: 10,
                  fontSize: 13.5,
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  background: loading || !input.trim() ? 'rgba(95,174,176,0.15)' : '#5FAEB0',
                  border: 'none', color: '#050608', padding: '10px 14px', borderRadius: 10,
                  display: 'flex', alignItems: 'center',
                  opacity: loading || !input.trim() ? 0.4 : 1,
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Side Panel (Consolidation / Handoff) ──────────────────── */}
        {sidePanel && (
          <div className="slide-in" style={{
            width: 340, borderLeft: '1px solid rgba(255,255,255,0.06)',
            background: '#0A0C10', overflowY: 'auto',
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: sidePanel === 'consolidation' ? '#5FAEB0' : '#D9B873' }}>
                {sidePanel === 'consolidation' ? 'Memory Consolidation' : 'Clinician Handoff'}
              </span>
              <button onClick={() => setSidePanel(null)} style={{ background: 'none', border: 'none', color: '#6B665F', padding: 4 }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: 16 }}>
              {sidePanel === 'consolidation' && (
                <>
                  {runningConsolidation && (
                    <div style={{ textAlign: 'center', padding: 32, color: '#5FAEB0' }}>
                      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                      <div style={{ fontSize: 13 }}>Running 5-step consolidation...</div>
                      <div style={{ fontSize: 11, color: '#6B665F', marginTop: 4 }}>Advocate / Skeptic / Judge</div>
                    </div>
                  )}
                  {consolidationResult && !consolidationResult.error && (
                    <div className="fade-in">
                      <div style={{ fontSize: 11, color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                        {consolidationResult.status === 'complete' ? 'Complete' : 'In Progress'}
                      </div>
                      {(consolidationResult.steps || []).map((step, i) => (
                        <div key={i} style={{
                          marginBottom: 10, padding: '10px 12px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          borderLeft: `2px solid ${step.accent === 'teal' ? '#5FAEB0' : step.accent === 'gold' ? '#D4A645' : step.accent === 'brick' ? '#C84848' : '#9E7E3A'}`,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{step.title}</div>
                          <div style={{ fontSize: 11, color: '#9B9285', lineHeight: 1.5 }}>{step.changes || step.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {consolidationResult?.error && (
                    <div style={{ color: '#C84848', fontSize: 12 }}>Error: {consolidationResult.error}</div>
                  )}
                </>
              )}

              {sidePanel === 'handoff' && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: '#9B9285', display: 'block', marginBottom: 4 }}>Clinician Name</label>
                    <input
                      value={handoffForm.name}
                      onChange={e => setHandoffForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Dr. A. Patel"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#EDEAE3', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: '#9B9285', display: 'block', marginBottom: 4 }}>Role</label>
                    <input
                      value={handoffForm.role}
                      onChange={e => setHandoffForm(f => ({ ...f, role: e.target.value }))}
                      placeholder="Behavioral Health"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#EDEAE3', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
                    />
                  </div>
                  <button
                    onClick={runHandoff}
                    disabled={runningHandoff || !handoffForm.name || !handoffForm.role}
                    style={{
                      width: '100%', background: '#D9B873', border: 'none', color: '#050608',
                      padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      opacity: runningHandoff || !handoffForm.name || !handoffForm.role ? 0.4 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {runningHandoff ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><FileText size={14} /> Generate Handoff</>}
                  </button>

                  {handoffResult && !handoffResult.error && (
                    <div className="fade-in" style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                        Handoff Package
                      </div>
                      <div style={{ fontSize: 12, color: '#9B9285', marginBottom: 8 }}>
                        <strong>To:</strong> {handoffResult.recipient}
                      </div>
                      {handoffResult.context && (
                        <div style={{ fontSize: 12, color: '#A8A39A', marginBottom: 8, lineHeight: 1.5 }}>
                          <strong style={{ color: '#9B9285' }}>Context:</strong> {handoffResult.context}
                        </div>
                      )}
                      {handoffResult.summary && (
                        <div style={{ fontSize: 12, color: '#A8A39A', marginBottom: 8, lineHeight: 1.5 }}>
                          <strong style={{ color: '#9B9285' }}>Summary:</strong> {handoffResult.summary}
                        </div>
                      )}
                      {handoffResult.authorized?.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: '#5FAEB0', marginBottom: 4 }}>Authorized Content:</div>
                          {handoffResult.authorized.map((item, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#A8A39A', paddingLeft: 8, marginBottom: 2 }}>• {item}</div>
                          ))}
                        </div>
                      )}
                      {handoffResult.excluded?.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: '#C84848', marginBottom: 4 }}>
                            <Shield size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />Firewall Excluded:
                          </div>
                          {handoffResult.excluded.map((item, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#C84848', paddingLeft: 8, marginBottom: 2, opacity: 0.8 }}>• {item}</div>
                          ))}
                        </div>
                      )}
                      {handoffResult.hypotheses?.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: '#D4A645', marginBottom: 4 }}>Bot Hypotheses:</div>
                          {handoffResult.hypotheses.map((item, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#D4A645', paddingLeft: 8, marginBottom: 2, fontStyle: 'italic', opacity: 0.8 }}>• {item}</div>
                          ))}
                        </div>
                      )}
                      {handoffResult.consent && (
                        <div style={{ marginTop: 8, padding: '8px 10px', border: '1px solid rgba(95,174,176,0.15)', borderRadius: 6, fontSize: 11, color: '#5FAEB0' }}>
                          <strong>Consent:</strong> {handoffResult.consent}
                        </div>
                      )}
                    </div>
                  )}
                  {handoffResult?.error && (
                    <div style={{ marginTop: 12, color: '#C84848', fontSize: 12 }}>Error: {handoffResult.error}</div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
