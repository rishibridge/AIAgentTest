import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Scale, Shield, Gavel } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
 * DEBATE PANEL — Advocate / Skeptic / Judge three-column layout
 * Shows reasoning from each role during consolidation & handoff
 * ═══════════════════════════════════════════════════════════════════ */

const ROLES = [
  {
    key: 'advocate',
    label: 'Advocate',
    accent: '#5FAEB0',
    accentBg: 'rgba(95, 174, 176, 0.08)',
    accentBorder: 'rgba(95, 174, 176, 0.25)',
    icon: Shield,
    description: 'Argues in favor of the patient\'s perspective and emotional truth.',
  },
  {
    key: 'skeptic',
    label: 'Skeptic',
    accent: '#C84848',
    accentBg: 'rgba(200, 72, 72, 0.08)',
    accentBorder: 'rgba(200, 72, 72, 0.25)',
    icon: Scale,
    description: 'Challenges assumptions and flags clinical inconsistencies.',
  },
  {
    key: 'judge',
    label: 'Judge',
    accent: '#D9B873',
    accentBg: 'rgba(217, 184, 115, 0.08)',
    accentBorder: 'rgba(217, 184, 115, 0.25)',
    icon: Gavel,
    description: 'Synthesizes both perspectives into a balanced clinical conclusion.',
  },
];

function RoleColumn({ role, content, isExpanded, onToggle }) {
  const Icon = role.icon;

  return (
    <div
      className="fade-enter-active"
      style={{
        flex: 1,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${isExpanded ? role.accentBorder : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          background: role.accentBg,
          border: 'none',
          borderBottom: `1px solid ${role.accentBorder}`,
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'background 0.2s ease',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: `${role.accent}22`,
            border: `1.5px solid ${role.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={role.accent} />
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1.15rem',
              fontWeight: 600,
              color: role.accent,
              letterSpacing: '0.02em',
            }}
          >
            {role.label}
          </div>
          <div
            style={{
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '2px',
            }}
          >
            {role.description}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} color="rgba(255,255,255,0.4)" />
        ) : (
          <ChevronDown size={16} color="rgba(255,255,255,0.4)" />
        )}
      </button>

      {/* Content */}
      <div
        style={{
          maxHeight: isExpanded ? '600px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.4s ease',
        }}
      >
        <div style={{ padding: '20px' }}>
          {content ? (
            <div
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: '0.88rem',
                lineHeight: 1.7,
                color: '#EDEAE3',
              }}
            >
              {typeof content === 'string'
                ? content.split('\n').map((line, i) => (
                    <p key={i} style={{ marginBottom: '10px' }}>
                      {line}
                    </p>
                  ))
                : content}
            </div>
          ) : (
            <div
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.25)',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '24px 0',
              }}
            >
              Awaiting analysis…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DebatePanel({
  advocateText = '',
  skepticText = '',
  judgeText = '',
  title = 'Deliberation',
  subtitle = '',
}) {
  const [expanded, setExpanded] = useState({
    advocate: true,
    skeptic: true,
    judge: true,
  });

  const toggle = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const contentMap = {
    advocate: advocateText,
    skeptic: skepticText,
    judge: judgeText,
  };

  return (
    <div className="fade-enter-active" style={{ width: '100%' }}>
      {/* Section header */}
      <div style={{ marginBottom: '20px' }}>
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '1.6rem',
            fontWeight: 600,
            color: '#D9B873',
            marginBottom: '4px',
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <div
            style={{
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Three columns */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          width: '100%',
        }}
      >
        {ROLES.map((role) => (
          <RoleColumn
            key={role.key}
            role={role}
            content={contentMap[role.key]}
            isExpanded={expanded[role.key]}
            onToggle={() => toggle(role.key)}
          />
        ))}
      </div>
    </div>
  );
}
