import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Square, Minus, Plus, Send } from 'lucide-react';
import * as api from '../api';

const COLORS = {
  for: '#5FAEB0',
  against: '#D67959',
  judge: '#D9B873',
  system: '#6B6560',
};

const ROLE_LABELS = {
  for: 'The Case For',
  against: 'The Case Against',
  judge: 'Clinical Synthesis',
  system: 'System',
};

const WPM_LEVELS = [50, 100, 150, 200, 250, 300, 400, 600, 999];

export default function DdxDebate({ patientId, patientName, topic: initialTopic, onClose }) {
  // Setup state
  const [phase, setPhase] = useState('setup'); // setup | debating | verdict
  const [topic, setTopic] = useState(initialTopic || '');
  const [roles, setRoles] = useState({ for: 'ai', against: 'ai', judge: 'human' });

  // Debate state
  const [messages, setMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]); // Messages with typewriter progress
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Human turn state
  const [humanTurnActive, setHumanTurnActive] = useState(false);
  const [humanTurnRole, setHumanTurnRole] = useState(null);
  const [humanTurnPrompt, setHumanTurnPrompt] = useState('');
  const [humanInput, setHumanInput] = useState('');
  const [humanTurnType, setHumanTurnType] = useState(null); // null | 'judge_evaluation' | 'final_verdict'

  // Judge evaluation state
  const [judgeScore, setJudgeScore] = useState(0);
  const [judgeComment, setJudgeComment] = useState('');
  const [showVerdictButtons, setShowVerdictButtons] = useState(false);

  // Verdict state
  const [winner, setWinner] = useState(null);
  const [totalScore, setTotalScore] = useState(0);

  // WPM
  const [wpmIndex, setWpmIndex] = useState(4); // 250 WPM default
  const wpm = WPM_LEVELS[wpmIndex];

  // Refs
  const streamRef = useRef(null);
  const scrollRef = useRef(null);
  const readerRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [displayedMessages, humanTurnActive]);

  // Typewriter effect for the latest message
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.state === 'thinking' || latest.state === 'loading' || latest.state === 'human_turn') {
      setDisplayedMessages([...messages]);
      return;
    }
    if (latest.state === 'speaking' && latest.text) {
      const words = latest.text.split(' ');
      const msPerWord = wpm >= 999 ? 0 : (60 / wpm) * 1000;
      let i = 0;
      const prev = messages.slice(0, -1);
      const timer = setInterval(() => {
        i++;
        if (i >= words.length) {
          clearInterval(timer);
          setDisplayedMessages([...prev, { ...latest, displayText: latest.text }]);
        } else {
          setDisplayedMessages([...prev, { ...latest, displayText: words.slice(0, i).join(' ') + ' ▌' }]);
        }
      }, msPerWord);
      return () => clearInterval(timer);
    }
    setDisplayedMessages([...messages]);
  }, [messages, wpm]);

  const startDebate = useCallback(async () => {
    if (!topic.trim()) return;
    setPhase('debating');
    setMessages([]);
    setDisplayedMessages([]);
    setScore(0);
    setCurrentRound(0);
    setIsStreaming(true);

    const url = api.getDebateStreamUrl(patientId, topic, roles.for, roles.against, roles.judge);

    try {
      const response = await fetch(url);
      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.session_id) {
              setSessionId(event.session_id);
            }
            if (event.round !== undefined) {
              setCurrentRound(event.round);
            }
            if (event.total_score !== undefined) {
              setScore(event.total_score);
            }
            if (event.score_delta !== undefined) {
              setTotalScore(prev => prev + event.score_delta);
            }

            if (event.state === 'human_turn') {
              setHumanTurnActive(true);
              setHumanTurnRole(event.role);
              setHumanTurnPrompt(event.prompt || 'Your turn.');
              setHumanTurnType(event.type || null);
              setHumanInput('');
              setJudgeScore(0);
              setJudgeComment('');
              setShowVerdictButtons(event.type === 'final_verdict');
              // Don't add to messages — show the input UI instead
              continue;
            }

            if (event.state === 'verdict') {
              setWinner(event.winner);
              setTotalScore(event.total_score || 0);
              setPhase('verdict');
            }

            setMessages(prev => [...prev, event]);
          } catch (e) {
            // Skip unparseable lines
          }
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'system', text: `Connection error: ${e.message}`, state: 'error', round: 0 }]);
    }
    setIsStreaming(false);
  }, [patientId, topic, roles]);

  const handleHumanSubmit = async () => {
    if (!sessionId) return;
    const text = humanTurnType ? (judgeComment || `Score: ${judgeScore}`) : humanInput;
    if (!text.trim() && !humanTurnType) return;

    await api.submitHumanTurn(
      patientId, sessionId, humanTurnRole, text,
      humanTurnType ? judgeScore : null,
      showVerdictButtons ? true : false,
      null
    );

    // Add the human's message to display
    setMessages(prev => [...prev, {
      role: humanTurnRole,
      text: text,
      state: 'speaking',
      round: currentRound,
      label: humanTurnType === 'judge_evaluation' ? 'Your Score' : humanTurnType === 'final_verdict' ? 'Your Verdict' : `Round ${currentRound}`,
      isHuman: true,
    }]);

    setHumanTurnActive(false);
    setHumanTurnRole(null);
    setHumanInput('');
  };

  const handleVerdictSubmit = async (side) => {
    if (!sessionId) return;
    await api.submitHumanTurn(patientId, sessionId, 'judge', `Winner: ${side}`, judgeScore, true, side);
    setHumanTurnActive(false);
  };

  const handleEndAndDeclare = () => {
    setShowVerdictButtons(true);
  };

  const handleStop = async () => {
    if (sessionId) {
      await api.stopDebate(patientId, sessionId);
    }
    if (readerRef.current) {
      try { readerRef.current.cancel(); } catch (e) {}
    }
    setIsStreaming(false);
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  // ── SETUP SCREEN ──
  if (phase === 'setup') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#050608' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B6560', cursor: 'pointer', padding: '4px' }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#D9B873' }}>DDx Clinical Debate</span>
          <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#6B6560' }}>· {patientName}</span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ maxWidth: '500px', width: '100%' }}>
            {/* Topic */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '0.65rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
                Clinical Statement to Debate
              </div>
              <input
                data-testid="debate-topic-input"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && topic.trim()) startDebate(); }}
                placeholder="e.g. This is MDD · MDD vs PTSD · Should we start an SSRI?"
                style={{
                  width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', padding: '14px 16px', borderRadius: '10px', fontSize: '1rem',
                  fontFamily: "'Cormorant Garamond', serif", outline: 'none', boxSizing: 'border-box',
                }}
              />
              {/* Quick topic chips */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                {['This is MDD', 'MDD vs PTSD', 'Should we start an SSRI?', 'Is this trauma or depression?'].map(t => (
                  <button key={t} onClick={() => setTopic(t)} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#9B9285', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem',
                    fontFamily: "'Work Sans', sans-serif", cursor: 'pointer',
                  }}>{t}</button>
                ))}
              </div>
            </div>

            {/* Role Picker */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '0.65rem', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
                Who Plays Each Role?
              </div>
              {[
                { key: 'for', label: 'The Case For', color: COLORS.for },
                { key: 'against', label: 'The Case Against', color: COLORS.against },
                { key: 'judge', label: 'The Judge', color: COLORS.judge },
              ].map(({ key, label, color }) => (
                <div key={key} data-testid={`role-picker-${key}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', marginBottom: '6px',
                  background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem', color }}>{label}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[{ id: 'ai', label: '🤖 AI' }, { id: 'human', label: '👨‍⚕️ You' }].map(opt => (
                      <button key={opt.id}
                        data-testid={`role-${key}-${opt.id}`}
                        onClick={() => setRoles(r => ({ ...r, [key]: opt.id }))}
                        style={{
                          background: roles[key] === opt.id ? `${color}22` : 'none',
                          border: roles[key] === opt.id ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.08)',
                          color: roles[key] === opt.id ? color : '#6B6560',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem',
                          fontFamily: "'Work Sans', sans-serif", cursor: 'pointer',
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Start */}
            <button
              data-testid="start-debate-btn"
              onClick={startDebate}
              disabled={!topic.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: topic.trim() ? 'linear-gradient(135deg, #5FAEB0 0%, #D9B873 100%)' : 'rgba(255,255,255,0.05)',
                color: topic.trim() ? '#050608' : '#6B6560',
                fontSize: '0.9rem', fontWeight: 700, fontFamily: "'Work Sans', sans-serif",
                cursor: topic.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <Play size={16} /> Start Debate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── VERDICT SCREEN ──
  if (phase === 'verdict') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#050608' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: '#D9B873' }}>Debate Concluded</span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div data-testid="verdict-display" style={{ textAlign: 'center', maxWidth: '500px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{winner === 'for' ? '🟢' : winner === 'against' ? '🔴' : '⚖️'}</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: COLORS[winner] || '#D9B873', marginBottom: '8px' }}>
              {winner === 'for' ? 'The Case For Wins' : winner === 'against' ? 'The Case Against Wins' : 'Draw — No Clear Winner'}
            </div>
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.85rem', color: '#9B9285', marginBottom: '24px' }}>
              Topic: {topic} · Final Score: {totalScore > 0 ? '+' : ''}{totalScore}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={onClose} style={{
                background: 'rgba(217,184,115,0.1)', border: '1px solid rgba(217,184,115,0.3)',
                color: '#D9B873', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem',
              }}>Back to DDx Arena</button>
              <button onClick={() => { setPhase('setup'); setMessages([]); setDisplayedMessages([]); }} style={{
                background: 'rgba(95,174,176,0.1)', border: '1px solid rgba(95,174,176,0.3)',
                color: '#5FAEB0', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                fontFamily: "'Work Sans', sans-serif", fontSize: '0.8rem',
              }}>New Debate</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIVE DEBATE ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#050608' }}>
      {/* Header with score bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B6560', cursor: 'pointer', padding: '4px' }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: '#EDEAE3', flex: 1 }}>{topic}</span>
        <span style={{ fontSize: '0.65rem', color: '#6B6560', fontFamily: "'Work Sans', sans-serif" }}>Round {currentRound}</span>
      </div>

      {/* Score Bar */}
      <div data-testid="score-bar" style={{
        display: 'flex', alignItems: 'center', padding: '6px 24px', gap: '8px',
        background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span data-testid="score-against-label" style={{ fontSize: '0.65rem', color: COLORS.against, fontWeight: 600, fontFamily: "'Work Sans', sans-serif", width: '100px', textAlign: 'right' }}>
          AGAINST {score < 0 ? Math.abs(score) : 0}
        </span>
        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, height: '100%', borderRadius: '3px',
            background: score > 0 ? COLORS.for : score < 0 ? COLORS.against : '#6B6560',
            width: `${Math.min(100, Math.abs(score) * 10)}%`,
            left: score >= 0 ? '50%' : undefined,
            right: score < 0 ? '50%' : undefined,
            transition: 'all 0.5s ease',
          }} />
          <div style={{ position: 'absolute', left: '50%', top: '-2px', width: '2px', height: '10px', background: '#6B6560' }} />
        </div>
        <span data-testid="score-for-label" style={{ fontSize: '0.65rem', color: COLORS.for, fontWeight: 600, fontFamily: "'Work Sans', sans-serif", width: '100px' }}>
          {score > 0 ? score : 0} FOR
        </span>
      </div>

      {/* Message Stream */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {displayedMessages.map((msg, i) => {
          if (msg.state === 'thinking' || msg.state === 'loading') {
            return (
              <div key={i} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[msg.role] || '#6B6560', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '0.75rem', color: '#6B6560', fontStyle: 'italic', fontFamily: "'Work Sans', sans-serif" }}>
                  {ROLE_LABELS[msg.role] || msg.role} is thinking...
                </span>
              </div>
            );
          }
          if (msg.state === 'start' || msg.state === 'info') {
            return (
              <div key={i} style={{ marginBottom: '6px', fontSize: '0.7rem', color: '#6B6560', fontFamily: "'Work Sans', sans-serif" }}>
                {msg.text}
              </div>
            );
          }
          const color = COLORS[msg.role] || '#6B6560';
          const text = msg.displayText || msg.text;
          return (
            <div key={i} data-testid={`debate-message-${msg.role}`} style={{
              marginBottom: '16px', padding: '14px 18px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.02)',
              borderLeft: `3px solid ${color}`,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.65rem', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Work Sans', sans-serif" }}>
                  {ROLE_LABELS[msg.role] || msg.role}
                </span>
                {(msg.label || msg.extra?.label) && (
                  <span style={{ fontSize: '0.6rem', color: '#6B6560', fontFamily: "'Work Sans', sans-serif" }}>
                    · {msg.label || msg.extra?.label}
                  </span>
                )}
                {msg.isHuman && (
                  <span style={{ fontSize: '0.55rem', color: '#D9B873', fontFamily: "'Work Sans', sans-serif", background: 'rgba(217,184,115,0.1)', padding: '1px 6px', borderRadius: '8px' }}>YOU</span>
                )}
                {msg.score_delta !== undefined && (
                  <span style={{ fontSize: '0.65rem', color: msg.score_delta > 0 ? COLORS.for : msg.score_delta < 0 ? COLORS.against : '#6B6560', fontWeight: 600, fontFamily: "'Work Sans', sans-serif", marginLeft: 'auto' }}>
                    {msg.score_delta > 0 ? '+' : ''}{msg.score_delta}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', color: '#EDEAE3', lineHeight: 1.65 }}>
                {text}
              </div>
            </div>
          );
        })}

        {/* Human Turn Input */}
        {humanTurnActive && !showVerdictButtons && (
          <div data-testid="human-turn-panel" style={{
            marginTop: '12px', padding: '16px 18px', borderRadius: '10px',
            background: 'rgba(217,184,115,0.04)', border: '1px solid rgba(217,184,115,0.15)',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
              {humanTurnType === 'judge_evaluation' ? '⚖️ Your Judgment' : humanTurnType === 'final_verdict' ? '⚖️ Final Verdict' : `Your Turn · ${ROLE_LABELS[humanTurnRole]}`}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9B9285', marginBottom: '10px', fontFamily: "'Work Sans', sans-serif" }}>
              {humanTurnPrompt}
            </div>

            {/* Judge score slider */}
            {humanTurnType && (
              <div data-testid="judge-score-slider" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.65rem', color: COLORS.against, fontFamily: "'Work Sans', sans-serif" }}>Against</span>
                  <input type="range" min="-5" max="5" value={judgeScore}
                    onChange={(e) => setJudgeScore(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: '#D9B873' }}
                  />
                  <span style={{ fontSize: '0.65rem', color: COLORS.for, fontFamily: "'Work Sans', sans-serif" }}>For</span>
                  <span style={{ fontSize: '0.8rem', color: '#D9B873', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", width: '30px', textAlign: 'center' }}>
                    {judgeScore > 0 ? '+' : ''}{judgeScore}
                  </span>
                </div>
                <textarea
                  value={judgeComment}
                  onChange={(e) => setJudgeComment(e.target.value)}
                  placeholder="Why? (optional)"
                  rows={2}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#EDEAE3', padding: '8px 10px', borderRadius: '6px', fontSize: '0.8rem',
                    fontFamily: "'Work Sans', sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button data-testid="judge-continue-btn" onClick={handleHumanSubmit} style={{
                    flex: 1, padding: '8px', borderRadius: '6px',
                    background: 'rgba(95,174,176,0.1)', border: '1px solid rgba(95,174,176,0.3)',
                    color: '#5FAEB0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Work Sans', sans-serif",
                  }}>Continue Debate</button>
                  <button data-testid="judge-end-btn" onClick={handleEndAndDeclare} style={{
                    flex: 1, padding: '8px', borderRadius: '6px',
                    background: 'rgba(214,121,89,0.1)', border: '1px solid rgba(214,121,89,0.3)',
                    color: '#D67959', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Work Sans', sans-serif",
                  }}>End & Declare Winner</button>
                </div>
              </div>
            )}

            {/* Regular human argument input */}
            {!humanTurnType && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <textarea
                  data-testid="human-argument-input"
                  value={humanInput}
                  onChange={(e) => setHumanInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleHumanSubmit(); } }}
                  placeholder="Type your argument..."
                  rows={2}
                  style={{
                    flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#EDEAE3', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem',
                    fontFamily: "'Work Sans', sans-serif", outline: 'none', resize: 'none',
                  }}
                />
                <button onClick={handleHumanSubmit} style={{
                  background: '#D9B873', border: 'none', color: '#050608', padding: '0 16px',
                  borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}>
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Verdict Buttons */}
        {showVerdictButtons && (
          <div data-testid="verdict-buttons" style={{
            marginTop: '12px', padding: '16px 18px', borderRadius: '10px',
            background: 'rgba(217,184,115,0.04)', border: '1px solid rgba(217,184,115,0.15)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#D9B873', marginBottom: '12px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
              DECLARE THE WINNER
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button data-testid="verdict-against-btn" onClick={() => handleVerdictSubmit('against')} style={{
                padding: '12px 24px', borderRadius: '8px',
                background: 'rgba(214,121,89,0.12)', border: '2px solid rgba(214,121,89,0.4)',
                color: COLORS.against, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Work Sans', sans-serif",
              }}>🔴 Case Against Wins</button>
              <button data-testid="verdict-for-btn" onClick={() => handleVerdictSubmit('for')} style={{
                padding: '12px 24px', borderRadius: '8px',
                background: 'rgba(95,174,176,0.12)', border: '2px solid rgba(95,174,176,0.4)',
                color: COLORS.for, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Work Sans', sans-serif",
              }}>🟢 Case For Wins</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls: WPM + Stop */}
      <div style={{
        padding: '8px 24px', borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <div data-testid="wpm-control" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.65rem', color: '#6B6560', fontFamily: "'Work Sans', sans-serif" }}>⚡</span>
          <button data-testid="wpm-decrease" onClick={() => setWpmIndex(i => Math.max(0, i - 1))} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#9B9285', width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
          }}><Minus size={12} /></button>
          <span style={{ fontSize: '0.7rem', color: '#9B9285', fontFamily: "'Work Sans', sans-serif", minWidth: '40px', textAlign: 'center' }}>
            {wpm >= 999 ? '⚡' : wpm}
          </span>
          <button data-testid="wpm-increase" onClick={() => setWpmIndex(i => Math.min(WPM_LEVELS.length - 1, i + 1))} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#9B9285', width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
          }}><Plus size={12} /></button>
          <span style={{ fontSize: '0.6rem', color: '#6B6560', fontFamily: "'Work Sans', sans-serif" }}>WPM</span>
        </div>

        {isStreaming && (
          <button data-testid="stop-debate-btn" onClick={handleStop} style={{
            background: 'rgba(214,121,89,0.1)', border: '1px solid rgba(214,121,89,0.3)',
            color: '#D67959', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem',
            fontFamily: "'Work Sans', sans-serif",
          }}>
            <Square size={12} /> Stop
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
