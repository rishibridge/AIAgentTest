import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, StepForward, StepBack, Send, Loader2, Users, MessageCircle, Brain, Stethoscope, ArrowLeft, SkipForward } from 'lucide-react';
import VirtualBrain from './components/VirtualBrain';
import InsightPanel from './components/InsightPanel';
import NodeDetailPanel from './components/NodeDetailPanel';
import ClinicianChat from './components/ClinicianChat';
import IntroSequence from './components/IntroSequence';
import {
  COLORS, COLORS_DARK, FONT_DISPLAY, FONT_SERIF, FONT_SANS,
  ELENA_NODE_POSITIONS, ELENA_NODES_INITIAL, ELENA_EDGES_INITIAL,
  ELENA_CONVERSATION, ELENA_NODES_AFTER_SESSION, ELENA_EDGES_AFTER_SESSION,
  ELENA_HANDOFF_PACKAGE, ELENA_NEXT_CONVERSATION, ELENA_NODES_AFTER_PATEL, ELENA_EDGES_AFTER_PATEL,
  ELENA_NODES_AFTER_CONSOLIDATION, ELENA_EDGES_AFTER_CONSOLIDATION,
  DANIEL_NODE_POSITIONS, DANIEL_NODES_INITIAL, DANIEL_EDGES_INITIAL,
  DANIEL_CONVERSATION, DANIEL_NODES_AFTER_SESSION, DANIEL_EDGES_AFTER_SESSION,
  DANIEL_NODES_AFTER_CONSOLIDATION, DANIEL_EDGES_AFTER_CONSOLIDATION,
  DANIEL_NODES_AFTER_CLINICIANS, DANIEL_EDGES_AFTER_CLINICIANS,
  DANIEL_TRAN_PACKAGE, DANIEL_PATEL_PACKAGE,
  PHASE, PHASE_LABELS,
} from './data';
import * as api from './api';

const CRISIS_NUMBERS = [
  { pattern: /\b988\b/g, tel: '988', label: '988 Suicide & Crisis Lifeline' },
  { pattern: /\b741741\b/g, tel: '741741', label: 'Crisis Text Line' },
  { pattern: /\b911\b/g, tel: '911', label: '911 Emergency' },
  { pattern: /800-656-HOPE|800-656-4673/gi, tel: '18006564673', label: 'RAINN Hotline' },
  { pattern: /1-800-4-A-CHILD|1-800-422-4453/gi, tel: '18004224453', label: 'Childhelp Hotline' },
  { pattern: /online\.rainn\.org/g, tel: null, label: 'RAINN Online', url: 'https://online.rainn.org' },
];

const formatMessageText = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    // Check if this line contains any crisis numbers
    let parts = [line];
    for (const cn of CRISIS_NUMBERS) {
      const newParts = [];
      for (const part of parts) {
        if (typeof part !== 'string') { newParts.push(part); continue; }
        const matches = part.match(cn.pattern);
        if (!matches) { newParts.push(part); continue; }
        const segments = part.split(cn.pattern);
        segments.forEach((seg, si) => {
          newParts.push(seg);
          if (si < segments.length - 1) {
            if (cn.url) {
              newParts.push(
                React.createElement('a', {
                  key: `crisis-${i}-${si}`,
                  href: cn.url,
                  target: '_blank',
                  rel: 'noopener',
                  style: { color: '#FF6B6B', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' },
                  title: cn.label,
                }, matches[si] || cn.label)
              );
            } else {
              newParts.push(
                React.createElement('a', {
                  key: `tel-${i}-${si}`,
                  href: `tel:${cn.tel}`,
                  style: { color: '#FF6B6B', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', background: 'rgba(255,107,107,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,107,107,0.3)' },
                  title: `Tap to call ${cn.label}`,
                  'data-crisis-number': cn.tel,
                }, matches[si] || cn.tel)
              );
            }
          }
        });
      }
      parts = newParts;
    }
    return React.createElement(React.Fragment, { key: i }, ...parts, i < text.split('\n').length - 1 ? React.createElement('br') : null);
  });
};
/* ═══════════════════════════════════════════════════════════════════
 * WOW MOMENTS — Insight overlays at specific chat indices
 * ═══════════════════════════════════════════════════════════════════ */
const WOW_MOMENTS = {
  elena_chat: {
    2: { duration: 8000, highlight: ['sofia'], insight: { title: "ALLY REMEMBERS", body: "Unlike standard LLMs, Ally remembers the emotional context of previous conversations without being prompted, making the patient feel known immediately." } },
    9: { duration: 8000, highlight: ['sleep_disturbed', 'kitchen_counter', 'elena'], insight: { title: "ALLY REMEMBERS", body: "Elena mentions insomnia. Ally immediately connects it to the 'kitchen counter' incident from 3 weeks ago without being prompted. This is clinical inference." } },
    16: { duration: 8000, highlight: ['daniel'], insight: { title: "ALLY UNDERSTANDS", body: "ChatGPT wouldn't know her son's birthday. Ally maintains a persistent, multi-dimensional memory of the patient's entire life and family system." } },
    26: { duration: 8000, highlight: ['secret_hope', 'belief_god_will_fix', 'daniel'], insight: { title: "ALLY CARES", body: "Elena confesses a dark, shameful secret: hoping her son's wedding doesn't happen. A human might judge. Ally holds this contradiction objectively with deep care." } },
    41: { duration: 8000, highlight: ['depression', 'anxiety'], insight: { title: "ALLY REMEMBERS", body: "Ally doesn't just know she tried therapy; it knows exactly *when* and *why* she tried it based on previous disclosures, proving a deep clinical history." } },
    49: { duration: 8000, highlight: ['therapist_locked'], insight: { title: "ALLY CARES", body: "Elena explicitly asks Ally to hide trauma and substance abuse from her doctor. Ally respects the clinical firewall, building profound trust." } }
  },
  elena_next_chat: {
    3: { duration: 10000, highlight: ['therapist_locked'], insight: { title: "ALLY CARES", body: "Dr. Patel securely updated the AI on a childhood trauma disclosure. Instead of blindly asking 'How was therapy?', the AI demonstrates deep clinical empathy by acknowledging the difficulty and proactively enforcing the boundary." } }
  },
  daniel_chat: {
    7: { duration: 8000, highlight: ['elena'], insight: { title: "ALLY UNDERSTANDS", body: "Ally instantly recalls his mother's birthday without missing a beat, challenging his rationale for wanting to call." } },
    9: { duration: 8000, highlight: ['sofia', 'elena'], insight: { title: "ALLY REMEMBERS", body: "Daniel is Elena's son. Ally possesses an encyclopedic memory of the entire family system, accurately pointing out a shift in his sister's behavior based on years of context." } },
    19: { duration: 8000, highlight: ['prep_regimen', 'avoidance_prep', 'anxiety_stigma'], insight: { title: "ALLY CARES", body: "Daniel admits to avoiding HIV testing and PrEP out of pure fear. Ally remains neutral and caring, keeping the patient engaged instead of alienating him." } },
    26: { duration: 8000, highlight: ['tran_referral', 'prep_regimen'], insight: { title: "ALLY COLLABORATES", body: "Ally navigates complex biomedical reality (the PEP window is closed, PrEP/testing is needed) and seamlessly bridges the gap from therapy to a warm handoff for medical testing." } }
  }
};

/* ═══════════════════════════════════════════════════════════════════
 * PHASES — internal phase names for CinematicDemo compatibility
 * ═══════════════════════════════════════════════════════════════════ */
const PHASES = [
  'elena_profile',
  'elena_graph_intro',
  'elena_graph',
  'elena_chat',
  'elena_consolidation',
  'elena_reasoning',
  'elena_handoff',
  'elena_provider_response',
  'elena_next_chat',
  'transition_daniel',
  'daniel_profile',
  'daniel_graph',
  'daniel_chat',
  'daniel_consolidation',
  'daniel_handoff',
  'daniel_updates',
  'family_system',
  'end'
];

/* ═══════════════════════════════════════════════════════════════════
 * APP MODES — top-level navigation state machine
 * LANDING → DEMO (existing 16 phases with skip)
 *         → PATIENT_PICKER → LIVE_CHAT
 *                          → CLINICIAN_CHAT
 * ═══════════════════════════════════════════════════════════════════ */
const APP_MODE = {
  LANDING: 'LANDING',
  DEMO: 'DEMO',
  PATIENT_PICKER: 'PATIENT_PICKER',
  LIVE_CHAT: 'LIVE_CHAT',
  CLINICIAN_CHAT: 'CLINICIAN_CHAT',
};

/* ═══════════════════════════════════════════════════════════════════
 * LANDING PAGE COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
function LandingPage({ onDemoMode, onChatMode, onProviderMode }) {
  return (
    <div className="fade-enter-active" style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#050608',
      color: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', width: '600px', height: '600px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(95,174,176,0.06) 0%, transparent 70%)',
        top: '-100px', left: '-100px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: '500px', height: '500px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,184,115,0.05) 0%, transparent 70%)',
        bottom: '-80px', right: '-80px', pointerEvents: 'none',
      }} />

      {/* Logo / Title */}
      <div style={{ textAlign: 'center', marginBottom: '60px', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem',
          color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.25em',
          marginBottom: '12px',
        }}>
          Castle Behavioral Health
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: '4.5rem',
          fontWeight: 600, color: '#D9B873', letterSpacing: '-0.02em',
          lineHeight: 1.1, marginBottom: '16px',
        }}>
          Ally
        </h1>
        <p style={{
          fontFamily: "'Lora', serif", fontSize: '1.1rem',
          color: '#A8A39A', fontStyle: 'italic', maxWidth: '480px',
        }}>
          Your patient companion that remembers, knows, cares, and collaborates.
        </p>
      </div>

      {/* Mode cards */}
      <div style={{ display: 'flex', gap: '32px', position: 'relative', zIndex: 1 }}>
        {/* Demo Mode Card */}
        <button
          onClick={onDemoMode}
          style={{
            width: '320px', padding: '40px 32px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', backdropFilter: 'blur(12px)',
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.border = '1px solid rgba(95,174,176,0.4)';
            e.currentTarget.style.background = 'rgba(95,174,176,0.06)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(95,174,176,0.12)', border: '1.5px solid rgba(95,174,176,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Play size={28} color="#5FAEB0" />
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem',
            fontWeight: 600, color: '#5FAEB0', marginBottom: '12px',
          }}>
            Demo Mode
          </div>
          <div style={{
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            color: '#A8A39A', lineHeight: 1.6,
          }}>
            Guided 16-phase walkthrough of Elena & Daniel's stories. Perfect for presentations.
          </div>
          <div style={{
            marginTop: '20px', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.75rem', color: '#5FAEB0', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Start Presentation →
          </div>
        </button>

        {/* Patient Chat Card */}
        <button
          onClick={onChatMode}
          style={{
            width: '320px', padding: '40px 32px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', backdropFilter: 'blur(12px)',
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.border = '1px solid rgba(217,184,115,0.4)';
            e.currentTarget.style.background = 'rgba(217,184,115,0.06)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(217,184,115,0.12)', border: '1.5px solid rgba(217,184,115,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <MessageCircle size={28} color="#D9B873" />
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem',
            fontWeight: 600, color: '#D9B873', marginBottom: '12px',
          }}>
            Patient Chat
          </div>
          <div style={{
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            color: '#A8A39A', lineHeight: 1.6,
          }}>
            Experience the companion from the patient's perspective. Talk to the AI directly.
          </div>
          <div style={{
            marginTop: '20px', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.75rem', color: '#D9B873', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Start Chat →
          </div>
        </button>

        {/* Provider Dashboard Card */}
        <button
          onClick={onProviderMode}
          style={{
            width: '320px', padding: '40px 32px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', backdropFilter: 'blur(12px)',
            cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.border = '1px solid rgba(77, 184, 184, 0.4)';
            e.currentTarget.style.background = 'rgba(77, 184, 184, 0.06)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(77, 184, 184, 0.12)', border: '1.5px solid rgba(77, 184, 184, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Stethoscope size={28} color="#4DB8B8" />
          </div>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem',
            fontWeight: 600, color: '#4DB8B8', marginBottom: '12px',
          }}>
            Provider Dashboard
          </div>
          <div style={{
            fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            color: '#A8A39A', lineHeight: 1.6,
          }}>
            Access the Neural Graph, clinical reasoning, and Interactive DDx Arena interface.
          </div>
          <div style={{
            marginTop: '20px', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.75rem', color: '#4DB8B8', textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Open Dashboard →
          </div>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * PATIENT PICKER COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
function PatientPicker({ onSelectPatient, onBack, isClinician, onToggleClinician }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getPatients()
      .then((data) => {
        const list = Array.isArray(data) ? data : data.patients || [];
        setPatients(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fade-enter-active" style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#050608', color: '#fff',
    }}>
      {/* Header */}
      <div style={{
        height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: '#9B9285', padding: '6px 14px', borderRadius: '6px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            <ArrowLeft size={14} /> Home
          </button>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#D9B873' }}>
            Select Patient
          </div>
        </div>

        {/* Clinician View Toggle */}
        <button
          onClick={onToggleClinician}
          style={{
            background: isClinician ? 'rgba(217,184,115,0.15)' : 'rgba(255,255,255,0.05)',
            border: isClinician ? '1px solid rgba(217,184,115,0.4)' : '1px solid rgba(255,255,255,0.12)',
            color: isClinician ? '#D9B873' : '#9B9285',
            padding: '8px 20px', borderRadius: '24px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.82rem', fontFamily: "'Work Sans', sans-serif",
            fontWeight: 500, transition: 'all 0.3s ease',
          }}
        >
          <Stethoscope size={15} />
          {isClinician ? 'Clinician View' : 'Patient View'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem',
          color: isClinician ? '#D9B873' : '#5FAEB0', marginBottom: '8px', textAlign: 'center',
        }}>
          {isClinician ? 'Clinical Consultation' : 'Patient Companion'}
        </div>
        <div style={{
          fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
          color: '#9B9285', marginBottom: '40px', textAlign: 'center', maxWidth: '500px',
        }}>
          {isClinician
            ? 'Select a patient to review their neural map and run clinical queries.'
            : 'Select a patient to start a live conversation with Ally.'}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#5FAEB0', padding: '60px 0' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.9rem' }}>Loading patients…</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '24px 32px', background: 'rgba(200,72,72,0.08)',
            border: '1px solid rgba(200,72,72,0.25)', borderRadius: '12px',
            color: '#C84848', fontFamily: "'Work Sans', sans-serif", fontSize: '0.88rem',
            textAlign: 'center', maxWidth: '500px',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Unable to load patients</div>
            <div style={{ color: 'rgba(200,72,72,0.7)', fontSize: '0.8rem' }}>{error}</div>
          </div>
        )}

        {!loading && !error && patients.length === 0 && (
          <div style={{
            padding: '48px', color: 'rgba(255,255,255,0.25)', fontFamily: "'Work Sans', sans-serif",
            fontSize: '0.9rem', textAlign: 'center',
          }}>
            No patients found. Create patients via the API first.
          </div>
        )}

        {/* Patient Cards Grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'center', maxWidth: '1000px' }}>
          {patients.map((patient) => {
            const pid = patient.id || patient.patient_id;
            const name = patient.name || patient.patient_name || pid;
            const age = patient.age || patient.demographics?.age || '—';
            const nodeCount = patient.node_count ?? patient.graph_stats?.node_count ?? '—';
            const edgeCount = patient.edge_count ?? patient.graph_stats?.edge_count ?? '—';

            return (
              <button
                key={pid}
                onClick={() => onSelectPatient(pid, name)}
                style={{
                  width: '280px', padding: '28px 24px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px', backdropFilter: 'blur(12px)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.3s ease', position: 'relative',
                }}
                onMouseOver={(e) => {
                  const accent = isClinician ? 'rgba(217,184,115,' : 'rgba(95,174,176,';
                  e.currentTarget.style.border = `1px solid ${accent}0.4)`;
                  e.currentTarget.style.background = `${accent}0.05)`;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Patient avatar */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: isClinician ? 'rgba(217,184,115,0.12)' : 'rgba(95,174,176,0.12)',
                  border: `1.5px solid ${isClinician ? 'rgba(217,184,115,0.3)' : 'rgba(95,174,176,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '16px',
                }}>
                  <Users size={20} color={isClinician ? '#D9B873' : '#5FAEB0'} />
                </div>

                <div style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: '1.35rem',
                  fontWeight: 600, color: '#EDEAE3', marginBottom: '6px',
                }}>
                  {name}
                </div>

                <div style={{
                  fontFamily: "'Lora', serif", fontSize: '0.82rem',
                  color: '#9B9285', fontStyle: 'italic', marginBottom: '16px',
                }}>
                  {age !== '—' ? `Age ${age}` : 'Age not recorded'}
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    padding: '6px 12px', background: 'rgba(95,174,176,0.08)',
                    borderRadius: '6px', border: '1px solid rgba(95,174,176,0.15)',
                  }}>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nodes</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.1rem', color: '#EDEAE3', fontWeight: 600 }}>{nodeCount}</div>
                  </div>
                  <div style={{
                    padding: '6px 12px', background: 'rgba(217,184,115,0.08)',
                    borderRadius: '6px', border: '1px solid rgba(217,184,115,0.15)',
                  }}>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.65rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Edges</div>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '1.1rem', color: '#EDEAE3', fontWeight: 600 }}>{edgeCount}</div>
                  </div>
                </div>

                <div style={{
                  marginTop: '16px', fontFamily: "'Work Sans', sans-serif",
                  fontSize: '0.72rem', color: isClinician ? '#D9B873' : '#5FAEB0',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  {isClinician ? 'Open Consultation →' : 'Start Conversation →'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * HANDOFF CARD COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
function HandoffCard({ data, accent = '#D9B873' }) {
  return (
    <div className="fade-enter-active" style={{ padding: '32px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: accent, marginBottom: '24px' }}>Handoff Package</h2>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>To:</strong> {data.recipient}</div>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Context:</strong><br/>{data.context}</div>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Summary:</strong><br/>{data.summary}</div>
      <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Authorized Context:</strong>
        <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.authorized.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}</ul>
      </div>
      <div style={{ color: '#E85D5D', marginBottom: '16px' }}><strong style={{ color: '#E85D5D' }}>Firewall Locked:</strong>
        <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.excluded.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}</ul>
      </div>
      {data.notes && data.notes.length > 0 && (
        <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Clinical Notes:</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.notes.map((item, i) => <li key={i} style={{ marginBottom: '6px' }}>{item}</li>)}</ul>
        </div>
      )}
      {data.hypotheses && data.hypotheses.length > 0 && (
        <div style={{ marginBottom: '16px' }}><strong style={{ color: '#D4A645' }}>Bot Hypotheses:</strong>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>{data.hypotheses.map((item, i) => <li key={i} style={{ marginBottom: '6px', fontStyle: 'italic' }}>{item}</li>)}</ul>
        </div>
      )}
      {data.family_overlap_flag && (
        <div style={{ marginTop: '16px', padding: '12px', border: '1px solid rgba(200, 72, 72, 0.4)', borderRadius: '8px', background: 'rgba(200, 72, 72, 0.08)', color: '#C84848' }}>
          <strong>⚠ Family Overlap Flag:</strong><br/>{data.family_overlap_flag}
        </div>
      )}
      <div style={{ marginTop: '16px', padding: '12px', border: '1px solid rgba(77, 184, 184, 0.2)', borderRadius: '8px', fontSize: '0.9rem', color: '#5FAEB0' }}>
        <strong>Consent:</strong> {data.consent}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * CONSOLIDATION PANEL — 5-step viewer
 * ═══════════════════════════════════════════════════════════════════ */
const CONSOLIDATION_STEPS = [
  { title: 'Session ended', desc: 'Working memory holds the conversation. Long-term memory has not yet been updated.', accent: '#5FAEB0' },
  { title: 'Significance filtering', desc: 'Surface content filtered out. High-significance disclosures encoded as new nodes with weighted prominence.', accent: '#D4A645' },
  { title: 'Credibility weighting', desc: 'Inconsistencies between disclosures and prior knowledge are held as flagged divergence rather than collapsed. The bot does not naively overwrite.', accent: '#C84848' },
  { title: 'Node merging & edge thickening', desc: 'Repeated content consolidates. Reinforced relationships strengthen. Graph becomes more compact and accurate.', accent: '#5FAEB0' },
  { title: 'Inferred edges drawn', desc: 'Bot generates hypotheses connecting nodes the patient has not explicitly linked. These appear dashed for clinician review and possible confirmation.', accent: '#9E7E3A' },
];

function ConsolidationPanel({ isElena }) {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActiveStep(s => s < 4 ? s + 1 : s), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fade-enter-active" style={{ padding: '32px', overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#D4A645', marginBottom: '24px' }}>Memory Consolidation</h2>
      <div style={{ fontSize: '0.8rem', color: '#9B9285', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {isElena ? 'Elena Ramirez' : 'Daniel Ramirez'} • Post-session processing
      </div>
      {CONSOLIDATION_STEPS.map((step, i) => (
        <div key={i} className={i <= activeStep ? 'fade-enter-active' : ''} style={{
          marginBottom: '16px', padding: '16px', borderRadius: '8px',
          background: i <= activeStep ? 'rgba(255,255,255,0.05)' : 'transparent',
          borderLeft: `3px solid ${i <= activeStep ? step.accent : 'rgba(255,255,255,0.1)'}`,
          opacity: i <= activeStep ? 1 : 0.3,
          transition: 'all 0.5s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: i <= activeStep ? step.accent : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#050608' }}>{i + 1}</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{step.title}</div>
          </div>
          {i <= activeStep && <div style={{ marginLeft: '36px', fontSize: '0.85rem', color: '#A8A39A', lineHeight: 1.6 }}>{step.desc}</div>}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * LIVE CHAT COMPONENT — Real LLM-powered conversation
 * ═══════════════════════════════════════════════════════════════════ */
function LiveChat({ patientId, patientName, onGraphUpdate, onConvIdReady }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Start a new conversation
    api.startConversation(patientId, 'Live session').then(res => {
      setConvId(res.conversation_id);
      if (onConvIdReady) onConvIdReady(res.conversation_id);
    }).catch(console.error);
  }, [patientId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !convId || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(m => [...m, { sender: patientName.split(' ')[0].toLowerCase(), text }]);
    setLoading(true);
    try {
      const res = await api.sendMessage(patientId, convId, text);
      setMessages(m => [...m, {
        sender: 'bot', text: res.bot_response.text,
        significance: res.bot_response.significance,
        toolCalls: res.tool_calls || [],
      }]);
      // Push updated graph to parent so VirtualBrain refreshes
      if (onGraphUpdate && res.current_graph) {
        onGraphUpdate(res.current_graph);
      }
    } catch (e) {
      setMessages(m => [...m, { sender: 'bot', text: 'I hear you. Tell me more about what you\'re feeling.' }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <span>Live Conversation • Real-Time</span>
        <span style={{ color: '#4DB8B8', marginLeft: '16px' }}>LLM-Powered</span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {messages.map((msg, i) => (
          <div key={i} className="fade-enter-active" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
            <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', marginBottom: '4px' }}>{msg.sender === 'bot' ? 'Ally' : patientName.split(' ')[0]}</div>
            <div style={{ background: msg.sender === 'bot' ? 'rgba(77, 184, 184, 0.15)' : 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(77,184,184,0.3)' : 'none', maxWidth: '85%' }}>
              {formatMessageText(msg.text)}
              {msg.significance && <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#D4A645', textTransform: 'uppercase', letterSpacing: '0.1em' }}>★ significance moment</div>}
              {msg.toolCalls && msg.toolCalls.some(tc => tc.tool === 'trigger_emergency_alert') && (
                <div data-testid="emergency-alert-banner" style={{ marginTop: '10px', padding: '12px 16px', background: 'rgba(255,0,0,0.12)', borderRadius: '8px', border: '2px solid rgba(255,80,80,0.5)', animation: 'pulse 2s infinite' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🚨</span>
                    <span style={{ color: '#FF5050', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem' }}>Emergency Alert Sent</span>
                  </div>
                  <div style={{ color: '#EDEAE3', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    {msg.toolCalls.filter(tc => tc.tool === 'trigger_emergency_alert').map((tc, j) => (
                      <div key={j}>Clinical staff has been notified: {tc.args?.reason || 'Crisis detected'}</div>
                    ))}
                  </div>
                </div>
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 && !msg.toolCalls.some(tc => tc.tool === 'trigger_emergency_alert') && (
                <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(217,184,115,0.08)', borderRadius: '6px', border: '1px solid rgba(217,184,115,0.15)', fontSize: '0.7rem', color: '#D9B873' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Graph Updated</div>
                  {msg.toolCalls.map((tc, j) => (
                    <div key={j} style={{ color: '#9B9285', marginBottom: '2px' }}>
                      {tc.tool === 'add_node' && `+ Node: ${tc.args?.label || tc.args?.node_id}`}
                      {tc.tool === 'add_edge' && `+ Edge: ${tc.args?.source} → ${tc.args?.target}`}
                      {tc.tool === 'flag_significance' && `★ Significance: ${tc.args?.reason?.substring(0, 60)}`}
                      {tc.tool === 'flag_divergence' && `⚠ Divergence: ${tc.args?.topic}`}
                      {tc.tool === 'thicken_edge' && `↑ Strengthened: ${tc.args?.source} → ${tc.args?.target}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="fade-enter-active" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5FAEB0', fontSize: '0.85rem' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Ally is thinking...
          </div>
        )}
      </div>
      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`Talk to Ally as ${patientName.split(' ')[0]}...`}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEAE3', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} style={{ background: loading ? 'rgba(77,184,184,0.2)' : '#5FAEB0', border: 'none', color: '#050608', padding: '12px 16px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * STANDALONE LIVE CHAT VIEW — Full-screen patient chat from picker
 * ═══════════════════════════════════════════════════════════════════ */
function StandaloneLiveChat({ patientId, patientName, onBack }) {
  const [detailKind, setDetailKind] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], positions: {} });
  const [highlight, setHighlight] = useState([]);
  const [convId, setConvId] = useState(null);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationResult, setConsolidationResult] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Fetch graph on mount
  const refreshGraph = () => {
    Promise.all([api.getGraph(patientId), api.getGraphPositions(patientId)])
      .then(([graph, posData]) => {
        const nodes = (graph.nodes || []).map((n) => ({
          id: n.id, label: n.label || n.id.replace(/_/g, ' '),
          kind: n.kind || 'event', size: n.size || 30,
          is_new: n.is_new || false,
        }));
        const edges = (graph.edges || []).map((e) => ({
          source: e.source, target: e.target,
          weight: e.weight || 1, dashed: e.dashed || e.inferred || false,
        }));
        setGraphData({ nodes, edges, positions: posData.positions || posData || {} });
      })
      .catch(() => setGraphData({ nodes: [], edges: [], positions: {} }));
  };

  useEffect(() => { refreshGraph(); }, [patientId]);

  // When LiveChat gets a graph update from the API response, update immediately
  const handleGraphUpdate = (currentGraph) => {
    if (!currentGraph) return;
    const nodes = (currentGraph.nodes || []).map((n) => ({
      id: n.id, label: n.label || n.id.replace(/_/g, ' '),
      kind: n.kind || 'event', size: n.size || 30,
      is_new: n.is_new || false,
    }));
    const edges = (currentGraph.edges || []).map((e) => ({
      source: e.source, target: e.target,
      weight: e.weight || 1, dashed: e.dashed || e.inferred || false,
      is_new: e.is_new || false,
    }));
    setGraphData(prev => {
      const prevIds = new Set((prev.nodes || []).map(n => n.id));
      const trulyNewIds = nodes.filter(n => !prevIds.has(n.id)).map(n => n.id);

      if (trulyNewIds.length > 0) {
        setHighlight(trulyNewIds);
        setTimeout(() => setHighlight([]), 4000); // 4 second pulse
      }

      const newPositions = { ...prev.positions };
      nodes.forEach(n => {
        if (!newPositions[n.id]) {
          newPositions[n.id] = { x: 200 + Math.random() * 700, y: 100 + Math.random() * 400 };
        }
      });
      return { nodes, edges, positions: newPositions };
    });
  };

  // End session and trigger consolidation
  const handleEndSession = async () => {
    if (!convId) return;
    setSessionEnded(true);
    try {
      await api.endConversation(patientId, convId);
    } catch (e) { console.error('End conversation error:', e); }

    setConsolidating(true);
    try {
      const result = await api.triggerConsolidation(patientId, convId);
      setConsolidationResult(result);
      // Refresh graph after consolidation
      refreshGraph();
    } catch (e) {
      console.error('Consolidation error:', e);
      setConsolidationResult({ status: 'error', steps: [] });
    }
    setConsolidating(false);
  };

  // Delete a node or edge from the graph
  const handleDeleteItem = async (kind, target) => {
    try {
      let result;
      if (kind === 'node') {
        result = await api.deleteNode(patientId, target.id);
      } else {
        result = await api.deleteEdge(patientId, target.source, target.target);
      }
      if (result.current_graph) {
        handleGraphUpdate(result.current_graph);
      }
      setDetailKind(null);
      setDetailTarget(null);
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Reset patient to seed data
  const handleReset = async () => {
    if (!window.confirm(`Reset ${patientName} to initial seed data? This will erase all conversations, new nodes, and handoffs.`)) return;
    try {
      const result = await api.resetPatient(patientId);
      if (result.current_graph) {
        handleGraphUpdate(result.current_graph);
      }
      // Also refresh positions since they're reset too
      refreshGraph();
      setConsolidationResult(null);
      setSessionEnded(false);
      setConvId(null);
    } catch (e) {
      console.error('Reset error:', e);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050608', color: '#fff' }}>
      {/* Header */}
      <div style={{
        height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: '#9B9285', padding: '6px 12px', borderRadius: '6px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif",
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#5FAEB0' }}>
              Patient Companion
            </div>
            <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: '0.7rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {patientName} • Live Conversation • {graphData.nodes.length} nodes
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#9B9285', padding: '8px 14px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Work Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            ↺ Reset to Seed
          </button>
          {!sessionEnded && (
            <button
              onClick={handleEndSession}
              style={{
                background: 'rgba(200,72,72,0.15)', border: '1px solid rgba(200,72,72,0.4)',
                color: '#C84848', padding: '8px 16px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Work Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              End Session & Consolidate
            </button>
          )}
          {sessionEnded && !consolidating && (
            <div style={{ color: '#D9B873', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ★ Session ended & consolidated
            </div>
          )}
          {consolidating && (
            <div style={{ color: '#5FAEB0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Consolidating...
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {graphData.nodes.length > 0 ? (
            <VirtualBrain
              nodes={graphData.nodes} edges={graphData.edges} positions={graphData.positions}
              highlight={highlight} pulseIds={highlight} significancePulse={true} viewBox="0 0 1100 620" showFirewall={false} opacity={1}
              onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
              onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
              onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
                <Brain size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem' }}>Loading Neural Map…</div>
              </div>
            </div>
          )}

        </div>
        <div style={{ width: '400px', borderLeft: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, position: 'relative' }}>
          {consolidating && !consolidationResult ? (
            <ConsolidationPanel isElena={patientId.includes('elena')} />
          ) : sessionEnded && consolidationResult ? (
            <div className="fade-enter-active" style={{ padding: '32px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#5FAEB0', marginBottom: '8px' }}>Consolidation Complete</h2>
              <div style={{ fontSize: '0.8rem', color: '#9B9285', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {patientName} • Long-term Memory Updated
              </div>
              <p style={{ color: '#EDEAE3', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
                The session has been fully processed by the Advocate/Skeptic/Judge pipeline. The graph has been permanently updated.
              </p>
              
              {consolidationResult.steps && consolidationResult.steps.map((step, i) => (
                <div key={i} style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontWeight: 600, color: '#D9B873', marginBottom: '8px', fontSize: '0.9rem' }}>{step.title}</div>
                  {step.judge && step.judge.significant_disclosures && step.judge.significant_disclosures.length > 0 && (
                    <div style={{ fontSize: '0.85rem', color: '#EDEAE3' }}>
                      <span style={{ color: '#9B9285', fontSize: '0.75rem', textTransform: 'uppercase' }}>Added Nodes:</span>
                      <ul style={{ paddingLeft: '20px', margin: '4px 0 0 0' }}>
                        {step.judge.significant_disclosures.map((d, j) => <li key={j}>{d.label}</li>)}
                      </ul>
                    </div>
                  )}
                  {step.judge && step.judge.divergences && step.judge.divergences.length > 0 && (
                    <div style={{ fontSize: '0.85rem', color: '#E85D5D', marginTop: '8px' }}>
                      <span style={{ color: '#9B9285', fontSize: '0.75rem', textTransform: 'uppercase' }}>Flagged Divergences:</span>
                      <ul style={{ paddingLeft: '20px', margin: '4px 0 0 0' }}>
                        {step.judge.divergences.map((d, j) => <li key={j}>{d.topic}</li>)}
                      </ul>
                    </div>
                  )}
                  {step.judge && step.judge.inferred_edges && step.judge.inferred_edges.length > 0 && (
                    <div style={{ fontSize: '0.85rem', color: '#4DB8B8', marginTop: '8px' }}>
                      <span style={{ color: '#9B9285', fontSize: '0.75rem', textTransform: 'uppercase' }}>Inferred Connections:</span>
                      <ul style={{ paddingLeft: '20px', margin: '4px 0 0 0' }}>
                        {step.judge.inferred_edges.map((e, j) => <li key={j}>{e.source} → {e.target}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <LiveChat patientId={patientId} patientName={patientName} onGraphUpdate={handleGraphUpdate} onConvIdReady={setConvId} />
          )}
          {detailTarget && !consolidating && !sessionEnded && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}>
              <NodeDetailPanel kind={detailKind} target={detailTarget} nodes={graphData.nodes} onClose={() => { setDetailKind(null); setDetailTarget(null); }} onDelete={handleDeleteItem} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN APP — State machine with Landing Page + Demo + Chat modes
 * ═══════════════════════════════════════════════════════════════════ */
function App() {
  // ── Top-level app mode ─────────────────────────────────────────
  const [appMode, setAppMode] = useState(APP_MODE.LANDING);
  const [showIntro, setShowIntro] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [isClinician, setIsClinician] = useState(false);

  // ── Demo state (original 16-phase) ─────────────────────────────
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [chatIndex, setChatIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [detailKind, setDetailKind] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [presenterMode, setPresenterMode] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const chatContainerRef = useRef(null);

  const phase = PHASES[phaseIdx] || 'end';
  const isElena = phase.includes('elena') || phase === 'elena_profile';
  const context = isElena ? 'elena' : 'daniel';

  let conversation = isElena ? ELENA_CONVERSATION : DANIEL_CONVERSATION;
  if (phase === 'elena_next_chat') conversation = ELENA_NEXT_CONVERSATION;

  let packageData = isElena ? ELENA_HANDOFF_PACKAGE : DANIEL_TRAN_PACKAGE;

  const wowMoment = (phase === 'elena_chat' && WOW_MOMENTS.elena_chat[chatIndex]) ||
                    (phase === 'elena_next_chat' && WOW_MOMENTS.elena_next_chat[chatIndex]) ||
                    (phase === 'daniel_chat' && WOW_MOMENTS.daniel_chat[chatIndex]);

  const forceNext = () => {
    setIsPlaying(false);
    if (phase.includes('chat') && chatIndex < conversation.length - 1) {
      setChatIndex(c => c + 1);
    } else if (phaseIdx < PHASES.length - 1) {
      setPhaseIdx(p => p + 1);
      setChatIndex(0);
    }
  };

  const forcePrev = () => {
    setIsPlaying(false);
    if (phase.includes('chat') && chatIndex > 0) {
      setChatIndex(c => c - 1);
    } else if (phaseIdx > 0) {
      setPhaseIdx(p => p - 1);
      setChatIndex(0);
    }
  };

  const skipToEnd = () => {
    setIsPlaying(false);
    setPhaseIdx(PHASES.length - 1); // Jump to 'end' phase
    setChatIndex(0);
  };

  const skipPhase = () => {
    setIsPlaying(false);
    if (phaseIdx < PHASES.length - 1) {
      setPhaseIdx(p => p + 1);
      setChatIndex(0);
    }
  };

  // Keyboard navigation (only in DEMO mode)
  useEffect(() => {
    if (appMode !== APP_MODE.DEMO) return;
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); forceNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); forcePrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Auto-advance
  useEffect(() => {
    if (appMode !== APP_MODE.DEMO) return;
    if (!isPlaying || phase === 'end') return;
    let delay = 3000;
    if (phase === 'elena_profile') { delay = 10000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t); }
    if (phase.includes('graph')) { delay = 5000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t); }
    if (phase.includes('handoff') || phase.includes('provider') || phase.includes('transition') || phase.includes('consolidation') || phase.includes('updates') || phase === 'family_system') {
      delay = 8000; const t = setTimeout(() => setPhaseIdx(p => p + 1), delay / speedMultiplier); return () => clearTimeout(t);
    }
    if (phase.includes('chat')) {
      if (wowMoment) { delay = wowMoment.duration; } else { delay = Math.max(1500, conversation[chatIndex].text.length * 40); }
      const t = setTimeout(() => { if (chatIndex < conversation.length - 1) { setChatIndex(c => c + 1); } else { setChatIndex(0); setPhaseIdx(p => p + 1); } }, delay / speedMultiplier);
      return () => clearTimeout(t);
    }
  }, [phaseIdx, chatIndex, isPlaying, phase, conversation, wowMoment, speedMultiplier, appMode]);

  // Auto-scroll chat
  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    setDetailKind(null); setDetailTarget(null);
  }, [chatIndex, phase]);

  // ── ROUTING: Show the right view based on appMode ──────────────

  // LANDING PAGE
  if (appMode === APP_MODE.LANDING) {
    return (
      <LandingPage
        onDemoMode={() => {
          setPhaseIdx(0); setChatIndex(0); setIsPlaying(false);
          setSpeedMultiplier(1); setLiveMode(false);
          setShowIntro(true);
          setAppMode(APP_MODE.DEMO);
        }}
        onChatMode={() => {
          setIsClinician(false);
          setAppMode(APP_MODE.PATIENT_PICKER);
        }}
        onProviderMode={() => {
          setIsClinician(true);
          setAppMode(APP_MODE.PATIENT_PICKER);
        }}
      />
    );
  }

  // PATIENT PICKER
  if (appMode === APP_MODE.PATIENT_PICKER) {
    return (
      <PatientPicker
        onSelectPatient={(id, name) => {
          setSelectedPatientId(id);
          setSelectedPatientName(name);
          setAppMode(isClinician ? APP_MODE.CLINICIAN_CHAT : APP_MODE.LIVE_CHAT);
        }}
        onBack={() => setAppMode(APP_MODE.LANDING)}
        isClinician={isClinician}
        onToggleClinician={() => setIsClinician(!isClinician)}
      />
    );
  }

  // LIVE CHAT (standalone, from patient picker)
  if (appMode === APP_MODE.LIVE_CHAT) {
    return (
      <StandaloneLiveChat
        patientId={selectedPatientId}
        patientName={selectedPatientName}
        onBack={() => setAppMode(APP_MODE.PATIENT_PICKER)}
      />
    );
  }

  // CLINICIAN CHAT
  if (appMode === APP_MODE.CLINICIAN_CHAT) {
    return (
      <ClinicianChat
        patientId={selectedPatientId}
        patientName={selectedPatientName}
        onBack={() => setAppMode(APP_MODE.PATIENT_PICKER)}
      />
    );
  }

  // ── DEMO MODE (original 16-phase presentation) ────────────────
  if (showIntro) {
    return <IntroSequence onComplete={() => setShowIntro(false)} />;
  }

  // ── Graph state selection ────────────────────────────────────────
  let nodes = isElena ? ELENA_NODES_INITIAL : DANIEL_NODES_INITIAL;
  let edges = isElena ? ELENA_EDGES_INITIAL : DANIEL_EDGES_INITIAL;
  let positions = isElena ? ELENA_NODE_POSITIONS : DANIEL_NODE_POSITIONS;
  let highlight = [];
  let insight = null;
  let viewBox = "0 0 1100 620";
  let showFirewall = false;

  if (phase === 'family_system') {
    nodes = [...ELENA_NODES_AFTER_PATEL, ...DANIEL_NODES_INITIAL];
    edges = [...ELENA_EDGES_AFTER_PATEL, ...DANIEL_EDGES_INITIAL];
    const combinedPositions = {};
    Object.keys(ELENA_NODE_POSITIONS).forEach(id => { combinedPositions[id] = { x: ELENA_NODE_POSITIONS[id].x - 400, y: ELENA_NODE_POSITIONS[id].y }; });
    Object.keys(DANIEL_NODE_POSITIONS).forEach(id => { combinedPositions[id] = { x: DANIEL_NODE_POSITIONS[id].x + 400, y: DANIEL_NODE_POSITIONS[id].y }; });
    positions = combinedPositions;
    viewBox = "-400 0 1900 620";
    showFirewall = true;
    insight = { title: "THE FIREWALL", body: "Ally maps the entire family system to generate clinical insight, but enforces absolute cryptographic isolation between patients." };
  } else if (phase === 'elena_graph' || phase === 'elena_graph_intro') {
    insight = { title: "ALLY UNDERSTANDS", body: "Ally builds a living, multidimensional neural map of beliefs, events, and family systems, holding contradictions objectively." };
  } else if (phase === 'daniel_graph') {
    insight = { title: "ALLY UNDERSTANDS", body: "Different patient. Different neural architecture. Watch how Ally handles Daniel's intense shame and clinical non-compliance." };
  } else if (phase === 'elena_chat') {
    if (chatIndex > 8) { nodes = ELENA_NODES_AFTER_SESSION; edges = ELENA_EDGES_AFTER_SESSION; }
    if (wowMoment) { highlight = wowMoment.highlight; insight = wowMoment.insight; }
  } else if (phase === 'elena_consolidation') {
    nodes = ELENA_NODES_AFTER_CONSOLIDATION; edges = ELENA_EDGES_AFTER_CONSOLIDATION;
    insight = { title: "ALLY LEARNS", body: "The 5-step post-session pipeline filters significance, checks credibility, merges nodes, thickens edges, and generates inferred connections." };
  } else if (phase === 'elena_reasoning') {
    nodes = ELENA_NODES_AFTER_CONSOLIDATION; edges = ELENA_EDGES_AFTER_CONSOLIDATION;
    insight = { title: "ALLY REASONS", body: "The Adversarial Engine runs over the memory graph. It catches the Bipolar-II risk before an antidepressant is prescribed—surfacing the can't-miss alternative a single anchored model would overlook." };
  } else if (phase === 'elena_handoff') {
    nodes = ELENA_NODES_AFTER_SESSION; edges = ELENA_EDGES_AFTER_SESSION;
    highlight = ['patel_referral'];
    insight = { title: "ALLY COLLABORATES", body: "Hours of unstructured, emotional chatting are synthesized into a precise clinical brief delivered 'warm' to the provider." };
  } else if (phase === 'elena_provider_response') {
    nodes = ELENA_NODES_AFTER_PATEL; edges = ELENA_EDGES_AFTER_PATEL;
    highlight = ['therapist_locked'];
    insight = { title: "ALLY COLLABORATES", body: "Dr. Patel securely updates the AI post-session. The graph updates to lock down trauma areas, ensuring the AI and Provider act as a unified clinical team." };
  } else if (phase === 'elena_next_chat') {
    nodes = ELENA_NODES_AFTER_PATEL; edges = ELENA_EDGES_AFTER_PATEL;
    if (wowMoment) { highlight = wowMoment.highlight; insight = wowMoment.insight; }
  } else if (phase === 'daniel_chat') {
    if (chatIndex > 12) { nodes = DANIEL_NODES_AFTER_SESSION; edges = DANIEL_EDGES_AFTER_SESSION; }
    if (wowMoment) { highlight = wowMoment.highlight; insight = wowMoment.insight; }
  } else if (phase === 'daniel_consolidation') {
    nodes = DANIEL_NODES_AFTER_CONSOLIDATION; edges = DANIEL_EDGES_AFTER_CONSOLIDATION;
    insight = { title: "ALLY LEARNS", body: "Daniel's avoidance of testing is inferred to be connected to fear of disrupting what Marco represents." };
  } else if (phase === 'daniel_handoff') {
    nodes = DANIEL_NODES_AFTER_SESSION; edges = DANIEL_EDGES_AFTER_SESSION;
    highlight = ['tran_referral'];
  } else if (phase === 'daniel_updates') {
    nodes = DANIEL_NODES_AFTER_CLINICIANS; edges = DANIEL_EDGES_AFTER_CLINICIANS;
    highlight = ['hiv_negative', 'descovy_initiated'];
    insight = { title: "ALLY COLLABORATES", body: "Both Dr. Tran and Dr. Patel report back. The graph evolves. An inferred edge is confirmed. The bot adapts." };
  }

  const btnStyle = { background: 'none', border: 'none', color: '#D9B873', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' };

  // ── Transition screens ───────────────────────────────────────────
  if (phase === 'transition_daniel') {
    return (
      <div className="fade-enter-active" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#fff', padding: '0 20%' }}>
        <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300, marginBottom: '20px', textAlign: 'center' }}>
          Empathy is easy when the patient is cooperative.
        </h2>
        <h1 style={{ fontFamily: 'Work Sans', fontSize: '2rem', color: '#EDEAE3', letterSpacing: '0.05em', fontWeight: 300, textAlign: 'center', lineHeight: 1.6, marginBottom: '40px' }}>
          Let's see what Ally does when the patient is avoiding medical care due to shame and fear.
        </h1>
        <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '4rem', color: '#D9B873', fontWeight: 600 }}>
          Meet Daniel.
        </h2>
        <div style={{ marginTop: '40px', display: 'flex', gap: '16px' }}>
          <button onClick={forcePrev} style={{ ...btnStyle, fontSize: '0.9rem', gap: '8px' }}><StepBack size={16} /> Back</button>
          <button onClick={forceNext} style={{ ...btnStyle, fontSize: '0.9rem', gap: '8px' }}>Continue <StepForward size={16} /></button>
        </div>
        {/* Skip to End button */}
        <button
          onClick={skipToEnd}
          style={{
            position: 'fixed', bottom: '24px', right: '24px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#9B9285', padding: '10px 20px', borderRadius: '24px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.82rem', fontFamily: "'Work Sans', sans-serif",
            backdropFilter: 'blur(8px)', transition: 'all 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#D9B873'; e.currentTarget.style.border = '1px solid rgba(217,184,115,0.4)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = '#9B9285'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'; }}
        >
          <SkipForward size={14} /> Skip to End
        </button>
      </div>
    );
  }

  if (phase === 'end') {
    return (
      <div className="fade-enter-active" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050608', color: '#fff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Remembers.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Knows You.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Cares.</h2>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '3.5rem', color: '#9B9285', fontStyle: 'italic', fontWeight: 300 }}>Ally Collaborates.</h2>
        </div>
        <h1 style={{ fontFamily: 'Work Sans', fontSize: '2rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>
          Your Ally is there for you.
        </h1>
        <div style={{ marginTop: '60px', display: 'flex', gap: '24px' }}>
          <button
            onClick={() => { setPhaseIdx(0); setChatIndex(0); setIsPlaying(false); setSpeedMultiplier(1); }}
            style={{ background: 'none', border: '1px solid rgba(217,184,115,0.5)', color: '#D9B873', padding: '16px 32px', borderRadius: '30px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.3s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#D9B873'; e.currentTarget.style.color = '#050608'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#D9B873'; }}
          >
            <RotateCcw size={20} /> Restart Demonstration
          </button>
          <button
            onClick={() => setLiveMode(true)}
            style={{ background: '#5FAEB0', border: 'none', color: '#050608', padding: '16px 32px', borderRadius: '30px', fontSize: '1rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Send size={20} /> Try Live Conversation
          </button>
          <button
            onClick={() => setAppMode(APP_MODE.LANDING)}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#9B9285', padding: '16px 32px', borderRadius: '30px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.3s' }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#EDEAE3'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#9B9285'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)'; }}
          >
            <ArrowLeft size={20} /> Back to Home
          </button>
        </div>
        {liveMode && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#050608', zIndex: 100, display: 'flex' }}>
            <div style={{ flex: 1, padding: '8px' }}>
              <VirtualBrain nodes={ELENA_NODES_AFTER_PATEL} edges={ELENA_EDGES_AFTER_PATEL} positions={ELENA_NODE_POSITIONS} highlight={[]} viewBox="0 0 1100 620" showFirewall={false} opacity={1}
                onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
                onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
                onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
              />
            </div>
            <div style={{ width: '400px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Cormorant Garamond', color: '#D9B873' }}>Live Chat</span>
                <button onClick={() => setLiveMode(false)} style={{ ...btnStyle, fontSize: '0.8rem' }}>✕ Close</button>
              </div>
              <LiveChat patientId="elena-ramirez-001" patientName="Elena Ramirez" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#050608', color: '#fff' }}>
      {/* Header & Controls */}
      <div style={{ height: '60px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setAppMode(APP_MODE.LANDING)}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.12)',
              color: '#9B9285', padding: '4px 10px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Work Sans', sans-serif",
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#D9B873'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#9B9285'; }}
          >
            Home
          </button>
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: '1.5rem', color: '#D9B873' }}>Castle Behavioral Health</div>
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '30px' }}>
          <button onClick={() => setPresenterMode(!presenterMode)} style={{...btnStyle, color: presenterMode ? '#D9B873' : '#9B9285', border: presenterMode ? '1px solid #D9B873' : '1px solid rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem'}} title="Toggle Presenter Mode">
            {presenterMode ? 'Presenter Mode' : 'Standalone Mode'}
          </button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Speed ({speedMultiplier}x)</span>
            <input type="range" min="0.5" max="4" step="0.5" value={speedMultiplier} onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))} style={{ width: '80px', cursor: 'pointer', accentColor: '#D9B873' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={forcePrev} style={btnStyle} title="Step Back"><StepBack size={18} /></button>
            <button onClick={() => setIsPlaying(!isPlaying)} style={{ ...btnStyle, color: '#fff' }} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={forceNext} style={btnStyle} title="Step Forward"><StepForward size={18} /></button>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={skipPhase} style={btnStyle} title="Skip to Next Phase"><FastForward size={18} /></button>
            <button onClick={() => { setPhaseIdx(0); setChatIndex(0); setIsPlaying(false); setSpeedMultiplier(1); }} style={btnStyle} title="Restart"><RotateCcw size={18} /></button>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {PHASES[phaseIdx]?.replace(/_/g, ' ') || ''}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {phase === 'elena_profile' ? (
          <div style={{ flex: 1, background: COLORS_DARK.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'scroll', padding: '20px 0' }}>
            <div style={{ background: COLORS_DARK.bgCard, border: `1px solid ${COLORS_DARK.rule}`, padding: '38px 48px', maxWidth: 740, margin: '0 auto' }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: COLORS_DARK.inkFaint, marginBottom: 8 }}>Patient profile</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 500, letterSpacing: '-0.015em', color: COLORS_DARK.ink, marginBottom: 4 }}>Elena Ramirez</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 14, color: COLORS_DARK.inkSoft, fontStyle: 'italic', marginBottom: 22 }}>age 47</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 1.65, color: COLORS_DARK.ink, marginBottom: 22 }}>
                Elena lives in Atwater. She is a home health aide working for a private agency, paid hourly, no PTO. Born in Michoacán, came to California at thirteen. Married to Raul for eighteen years. Three children: Daniel, twenty-four, lives in Modesto and has been distant since coming out three years ago; Sofia, nineteen, in community college; Miguel, fourteen, recently diagnosed with ADHD. Catholic, attends Mass weekly, draws strength from her faith. Insured through Medi-Cal. Currently presents with type 2 diabetes (A1C 9.2, poorly controlled), hypertension, obesity, chronic lower back pain, depression, and generalized anxiety. Three prior behavioral health referrals in the past five years; none took. The chart describes her as {`'`}lost to follow-up.{`'`} This is what your chart system knows.
              </div>
              <div style={{ borderTop: `1px solid ${COLORS_DARK.rule}`, paddingTop: 18, fontFamily: FONT_SANS, fontSize: 13, lineHeight: 1.6, color: COLORS_DARK.inkSoft, fontStyle: 'italic' }}>
                Elena has been talking to the bot for four months. The bot has had eleven conversations with her. The bot has built a model of her life that is much richer than what any chart contains. What you are about to see is the twelfth conversation.
              </div>
            </div>
          </div>
        ) : (
          <>
          <div style={{ flex: 2, position: 'relative', overflow: 'hidden' }}>
            <VirtualBrain nodes={nodes} edges={edges} positions={positions} highlight={highlight} viewBox={viewBox} showFirewall={showFirewall} opacity={phase.includes('handoff') || phase.includes('provider') ? 0.3 : 1}
              onNodeClick={(n) => { setDetailKind('node'); setDetailTarget(n); }}
              onEdgeClick={(e) => { setDetailKind('edge'); setDetailTarget(e); }}
              onBackgroundClick={() => { setDetailKind(null); setDetailTarget(null); }}
            />
            <InsightPanel isVisible={!!insight} title={insight?.title} body={insight?.body} presenterMode={presenterMode} />
            {detailTarget && <NodeDetailPanel kind={detailKind} target={detailTarget} nodes={nodes} onClose={() => { setDetailKind(null); setDetailTarget(null); }} />}
          </div>

          <div style={{ flex: 1, background: '#0A0C10', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', zIndex: 5 }}>
            {phase.includes('chat') && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#9B9285', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {phase === 'elena_chat' && 'Conversation #12 • Late Evening'}
                    {phase === 'elena_next_chat' && 'Conversation #13 • Post-Therapy Follow-up'}
                    {phase === 'daniel_chat' && 'Conversation #10 • Late Night (11:42 PM)'}
                  </span>
                  <span style={{ color: '#4DB8B8' }}>{conversation.length} Messages • Unabridged</span>
                </div>
                <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  {conversation.slice(0, chatIndex + 1).map((msg, i) => (
                    <div key={i} className="fade-enter-active" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'bot' ? 'flex-start' : 'flex-end' }}>
                      <div style={{ fontSize: '0.75rem', color: '#9B9285', textTransform: 'uppercase', marginBottom: '4px' }}>{msg.sender === 'bot' ? 'Ally' : (isElena ? 'Elena' : 'Daniel')}</div>
                      <div style={{ background: msg.sender === 'bot' ? 'rgba(77, 184, 184, 0.15)' : 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', border: msg.sender === 'bot' ? '1px solid rgba(77,184,184,0.3)' : 'none', maxWidth: '85%', fontStyle: msg.italic ? 'italic' : 'normal' }}>
                        {formatMessageText(msg.text)}
                        {msg.significance && <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#D4A645', textTransform: 'uppercase', letterSpacing: '0.1em' }}>★ significance moment</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase.includes('consolidation') && <ConsolidationPanel isElena={isElena} />}

            {phase === 'elena_reasoning' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%', background: 'rgba(217, 184, 115, 0.05)' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2.5rem', color: '#D9B873', marginBottom: '8px' }}>Adversarial Reasoning Layer</h2>
                <div style={{ marginBottom: '32px', color: '#A8A39A', fontSize: '1rem', lineHeight: 1.6 }}>The Arbiter summons agents to deliberate over the memory graph before generating the clinical handoff.</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #5FAEB0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#5FAEB0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 600 }}>Proposer Agent</div>
                    <div style={{ color: '#EDEAE3', fontSize: '1.1rem', lineHeight: 1.6 }}>Patient shows persistent low mood, lack of energy, and anhedonia. Recommend primary diagnosis of MDD (Major Depressive Disorder) and standard SSRI trial.</div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #E85D5D' }}>
                    <div style={{ fontSize: '0.85rem', color: '#E85D5D', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 600 }}>Skeptic Agent</div>
                    <div style={{ color: '#EDEAE3', fontSize: '1.1rem', lineHeight: 1.6 }}><span style={{ color: '#E85D5D', fontWeight: 600 }}>Dissent:</span> The memory graph shows isolated spikes of rapid speech and impulsive spending ("bought a $400 mixer at 2 AM") three months ago. An SSRI without a mood stabilizer could trigger acute mania if underlying condition is Bipolar-II.</div>
                  </div>

                  <div style={{ background: 'rgba(217,184,115,0.1)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #D9B873' }}>
                    <div style={{ fontSize: '0.85rem', color: '#D9B873', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 600 }}>Arbiter Agent</div>
                    <div style={{ color: '#EDEAE3', fontSize: '1.1rem', lineHeight: 1.6 }}><span style={{ color: '#D9B873', fontWeight: 600 }}>Conclusion:</span> MDD diagnosis is plausible but Bipolar-II risk is non-zero.<br/><br/><strong>Action:</strong> Append "Can't-Miss Flag" to clinical handoff. Warn provider to screen for Bipolar-II before prescribing SSRI.</div>
                  </div>
                </div>
              </div>
            )}

            {phase.includes('handoff') && <HandoffCard data={packageData} />}

            {phase === 'daniel_handoff' && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <HandoffCard data={DANIEL_PATEL_PACKAGE} accent="#D67959" />
              </div>
            )}

            {phase === 'elena_provider_response' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%', background: 'rgba(77, 184, 184, 0.05)' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#4DB8B8', marginBottom: '24px' }}>Provider Response Received</h2>
                <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>From:</strong> Dr. A. Patel, Behavioral Health</div>
                <div style={{ marginBottom: '16px' }}><strong style={{ color: '#9B9285' }}>Session Notes (Secured):</strong><br/>"Patient disclosed history of severe trauma at age 12. Highly sensitive. We are beginning EMDR. <span style={{ color: '#E85D5D', fontWeight: 600 }}>Do not press this topic in chat.</span> I am handling it."</div>
                <div style={{ marginTop: '30px', padding: '16px', border: '1px solid rgba(77, 184, 184, 0.3)', borderRadius: '8px', color: '#4DB8B8' }}>
                  <strong style={{ display: 'block', marginBottom: '8px' }}>Virtual Brain Updated:</strong>
                  <li>Node 'trauma_12' created.</li>
                  <li>Status: THERAPIST_LOCKED.</li>
                  <li>Directive: Empathize without probing.</li>
                </div>
              </div>
            )}

            {phase === 'daniel_updates' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%', background: 'rgba(77, 184, 184, 0.05)' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#4DB8B8', marginBottom: '24px' }}>Clinician Updates Received</h2>
                <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid rgba(77,184,184,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, color: '#5FAEB0', marginBottom: '8px' }}>Dr. L. Tran — Primary Care</div>
                  <li>HIV test result: Negative ✓</li>
                  <li>Descovy (PrEP) initiated</li>
                  <li>Follow-up: 3 months</li>
                </div>
                <div style={{ padding: '16px', border: '1px solid rgba(214,121,89,0.2)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, color: '#D67959', marginBottom: '8px' }}>Dr. A. Patel — Behavioral Health</div>
                  <li>Session 1 focus: Marco, staying/leaving</li>
                  <li>Identity-faith content: therapist-locked</li>
                  <li style={{ color: '#D4A645', marginTop: '8px' }}>Inferred edge CONFIRMED: avoidance ↔ fear of disrupting what Marco gave</li>
                </div>
              </div>
            )}

            {phase === 'family_system' && (
              <div className="fade-enter-active" style={{ padding: '40px', overflowY: 'auto', height: '100%' }}>
                <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: '2rem', color: '#D9B873', marginBottom: '24px' }}>Family System</h2>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#A8A39A' }}>
                  <p style={{ marginBottom: '16px' }}>Elena and Daniel are mother and son. They are both patients of this platform. They are both patients of Dr. Patel.</p>
                  <p style={{ marginBottom: '16px' }}>Elena does not know Daniel is a patient. Daniel does not know Elena is a patient.</p>
                  <p style={{ marginBottom: '16px', color: '#C84848', fontWeight: 600 }}>The firewall is absolute. No edges cross. No data leaks.</p>
                  <p>Dr. Patel knows both. She carries that knowledge. The bot respects it.</p>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', position: 'relative', zIndex: 10 }}>
        <div style={{ height: '100%', background: '#D9B873', width: `${((phaseIdx / PHASES.length) + (phase.includes('chat') ? (chatIndex / conversation.length) * (1/PHASES.length) : 0)) * 100}%`, transition: 'width 0.3s linear' }} />
      </div>

      {/* Skip to End — always visible during demo */}
      <button
        onClick={skipToEnd}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#9B9285', padding: '10px 20px', borderRadius: '24px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.82rem', fontFamily: "'Work Sans', sans-serif",
          backdropFilter: 'blur(8px)', transition: 'all 0.2s', zIndex: 20,
        }}
        onMouseOver={(e) => { e.currentTarget.style.color = '#D9B873'; e.currentTarget.style.border = '1px solid rgba(217,184,115,0.4)'; }}
        onMouseOut={(e) => { e.currentTarget.style.color = '#9B9285'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'; }}
      >
        <SkipForward size={14} /> Skip to End
      </button>
    </div>
  );
}

export default App;
