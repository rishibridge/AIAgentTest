import React, { useMemo, useState } from 'react';
import { COLORS_DARK as C, FONT_DISPLAY, FONT_SERIF, FONT_SANS } from '../data';
import { buildNodeDetail, buildEdgeDetail } from '../data/nodeDetailData';

// Node-kind → accent color
function accentColor(kind, target) {
  if (kind === 'node') {
    const k = target?.kind;
    if (k === 'clinician' || k === 'clinician_safety') return C.rust;
    if (k === 'significance' || k === 'belief' || k === 'faith') return C.gold;
    if (k === 'locked' || k === 'undisclosed' || k === 'therapist_locked') return C.locked;
    if (k === 'symptom' || k === 'avoidance') return C.brick;
    return C.teal;
  }
  // edge
  if (target?.clinician) return C.rust;
  if (target?.dashed) return C.goldSoft;
  return C.teal;
}

export default function NodeDetailPanel({ kind, target, nodes, onClose, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nodeMap = useMemo(() => {
    const m = {};
    (nodes || []).forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  const detail = useMemo(() => {
    if (!target) return null;
    return kind === 'node' ? buildNodeDetail(target) : buildEdgeDetail(target, nodeMap);
  }, [kind, target, nodeMap]);

  if (!target || !detail) return null;

  const accent = accentColor(kind, target);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    if (onDelete) {
      await onDelete(kind, target);
    }
    setDeleting(false);
    setConfirming(false);
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: '100%', height: '100%',
      background: C.bgCard, borderLeft: `1px solid ${C.rule}`,
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 280ms cubic-bezier(.25,1,.5,1)',
      zIndex: 10, overflow: 'hidden',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 26px 16px', borderBottom: `1px solid ${C.rule}`,
        borderTop: `4px solid ${accent}`, position: 'relative',
      }}>
        <div style={{
          fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: C.inkFaint, marginBottom: 6,
        }}>
          {kind === 'node' ? 'Node detail' : 'Edge detail'} · bot model
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 500,
          lineHeight: 1.15, color: C.ink, letterSpacing: '-0.01em', paddingRight: 32,
        }}>
          {detail.title}
        </div>
        {detail.subtitle && (
          <div style={{
            fontFamily: FONT_SERIF, fontSize: 13.5, fontStyle: 'italic',
            color: C.inkSoft, marginTop: 4,
          }}>
            {detail.subtitle}
          </div>
        )}
        {detail.status && (
          <div style={{
            marginTop: 10, display: 'inline-block', padding: '4px 10px',
            background: `${accent}1A`, color: accent,
            fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: 600, borderRadius: 2,
          }}>
            {detail.status}
          </div>
        )}
        <button onClick={onClose} style={{
          position: 'absolute', top: 18, right: 18,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: C.inkFaint, fontSize: 22, lineHeight: 1, padding: 4,
        }} aria-label="Close">×</button>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>
        {detail.sections.map((sec, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div style={{
              fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: C.inkFaint, fontWeight: 600, marginBottom: 6,
            }}>
              {sec.label}
            </div>
            <div style={{
              fontFamily: FONT_SERIF, fontSize: 14, lineHeight: 1.6, color: C.ink,
            }}>
              {sec.body}
            </div>
          </div>
        ))}
      </div>

      {/* Footer with delete */}
      <div style={{
        padding: '12px 26px', borderTop: `1px solid ${C.rule}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{
          fontFamily: FONT_SANS, fontSize: 10, letterSpacing: '0.06em',
          color: C.inkFaint, fontStyle: 'italic',
        }}>
          Click any node/edge to inspect
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: confirming ? '#C84848' : 'rgba(200,72,72,0.12)',
              border: `1px solid ${confirming ? '#C84848' : 'rgba(200,72,72,0.3)'}`,
              color: confirming ? '#fff' : '#C84848',
              padding: '6px 14px', borderRadius: '4px', cursor: deleting ? 'not-allowed' : 'pointer',
              fontFamily: FONT_SANS, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.04em', transition: 'all 0.2s',
            }}
            onMouseLeave={() => !deleting && setConfirming(false)}
          >
            {deleting ? 'Deleting...' : confirming
              ? `Confirm Delete ${kind === 'node' ? 'Node' : 'Edge'}`
              : `Delete ${kind === 'node' ? 'Node' : 'Edge'}`}
          </button>
        )}
      </div>
    </div>
  );
}
