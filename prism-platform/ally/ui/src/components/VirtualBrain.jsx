import React, { useState, useEffect, useRef, useMemo } from 'react';
import { COLORS_DARK as C, FONT_SANS } from '../data';

// ── helpers ──────────────────────────────────────────────────────────
function lighten(hex, t) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
}
function darken(hex, t) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`;
}
function nodeColor(kind) {
  switch (kind) {
    case 'self': return C.teal;
    case 'person': return C.tealSoft;
    case 'belief': return C.gold;
    case 'event': return C.inkSoft;
    case 'clinical': return C.tealSoft;
    case 'medication': return C.tealSoft;
    case 'undisclosed': return C.locked;
    case 'locked': return C.locked;
    case 'faith': return C.gold;
    case 'symptom': return C.brick;
    case 'significance': return C.gold;
    case 'inferred': return C.goldSoft;
    case 'referral': return C.teal;
    case 'agreed': return C.teal;
    case 'avoidance': return C.brick;
    case 'life': return C.inkSoft;
    case 'clinician': return C.rust;
    case 'clinician_safety': return C.brick;
    case 'therapist_locked': return C.locked;
    default: return C.inkSoft;
  }
}
function isLockedKind(kind) {
  return kind === 'locked' || kind === 'undisclosed' || kind === 'therapist_locked';
}

// ── zoom button style ────────────────────────────────────────────────
const zoomBtnStyle = {
  width: 26, height: 26, fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500,
  background: 'transparent', color: C.ink, border: `1px solid ${C.rule}`,
  borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// ── gradient palette for radial fills ────────────────────────────────
const GRAD_COLORS = [C.teal, C.tealSoft, C.gold, C.goldSoft, C.rust, C.brick, C.inkSoft, C.locked];

// ── main graph component ─────────────────────────────────────────────
export default function InteractiveGraph({
  nodes, edges, positions,
  highlight = [], pulseIds = [], significancePulse = false,
  interactive = true, viewBox = '0 0 1100 620',
  onNodeClick, onEdgeClick, onBackgroundClick,
}) {
  const svgRef = useRef(null);
  const [cam, setCam] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // reset view when patient changes
  const rootId = nodes[0]?.id || 'none';
  useEffect(() => { setCam({ x: 0, y: 0, scale: 1 }); setSelectedNode(null); }, [rootId]);

  const nodeSet = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);

  // Compute neighbor set and connected edges for the selected node
  const { neighborSet, connectedEdgeKeys } = useMemo(() => {
    if (!selectedNode) return { neighborSet: new Set(), connectedEdgeKeys: new Set() };
    const neighbors = new Set([selectedNode]);
    const edgeKeys = new Set();
    edges.forEach(e => {
      if (e.source === selectedNode || e.target === selectedNode) {
        neighbors.add(e.source);
        neighbors.add(e.target);
        edgeKeys.add(`${e.source}__${e.target}`);
      }
    });
    return { neighborSet: neighbors, connectedEdgeKeys: edgeKeys };
  }, [selectedNode, edges]);

  // ── mouse handlers ──────────────────────────────────────────────
  const onWheel = (e) => {
    if (!interactive) return;
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vb = viewBox.split(' ').map(Number);
    const vbW = vb[2], vbH = vb[3];
    const mx = ((e.clientX - rect.left) / rect.width) * vbW;
    const my = ((e.clientY - rect.top) / rect.height) * vbH;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(0.5, Math.min(4, cam.scale * factor));
    const nx = mx - (mx - cam.x) * (newScale / cam.scale);
    const ny = my - (my - cam.y) * (newScale / cam.scale);
    setCam({ x: nx, y: ny, scale: newScale });
  };
  const onMouseDown = (e) => {
    if (!interactive) return;
    const tgt = e.target;
    if (tgt.classList?.contains('graph-bg') || tgt === svgRef.current) {
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, tx: cam.x, ty: cam.y };
    }
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vb = viewBox.split(' ').map(Number);
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * vb[2];
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * vb[3];
    setCam({ ...cam, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
  };
  const onMouseUp = () => setDragging(false);
  const resetView = () => setCam({ x: 0, y: 0, scale: 1 });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        style={{ width: '100%', height: '100%', display: 'block', cursor: dragging ? 'grabbing' : interactive ? 'grab' : 'default', userSelect: 'none' }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        <defs>
          {/* Radial gradient fills for each color */}
          {GRAD_COLORS.map((col, i) => (
            <radialGradient key={i} id={`grad-${i}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor={lighten(col, 0.55)} />
              <stop offset="50%" stopColor={col} />
              <stop offset="100%" stopColor={darken(col, 0.25)} />
            </radialGradient>
          ))}
          {/* Drop shadow */}
          <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" />
            <feOffset dx="0" dy="2.5" result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Glow */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Emission */}
          <filter id="emission" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b2" />
            <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Bloom */}
          <filter id="bloom" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="14" result="big" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="med" />
            <feMerge><feMergeNode in="big" /><feMergeNode in="med" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Aura gradients */}
          <radialGradient id="auraGold" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.goldGlow} stopOpacity="0.55" />
            <stop offset="40%" stopColor={C.gold} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="auraTeal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.teal} stopOpacity="0.45" />
            <stop offset="50%" stopColor={C.teal} stopOpacity="0.18" />
            <stop offset="100%" stopColor={C.teal} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="auraRust" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.rust} stopOpacity="0.5" />
            <stop offset="50%" stopColor={C.rust} stopOpacity="0.2" />
            <stop offset="100%" stopColor={C.rust} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="auraBrick" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.brick} stopOpacity="0.55" />
            <stop offset="50%" stopColor={C.brick} stopOpacity="0.2" />
            <stop offset="100%" stopColor={C.brick} stopOpacity="0" />
          </radialGradient>
          {/* Soft blur */}
          <filter id="softblur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          {/* Lock pattern */}
          <pattern id="lockpattern" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={C.lockedDeep} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={C.locked} strokeWidth="1.8" opacity="0.9" />
          </pattern>
          {/* Surface gradient */}
          <radialGradient id="surfaceGrad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1A1F26" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#10131A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0A0B0E" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Huge transparent hit-area for pan */}
        <rect className="graph-bg" x="-2000" y="-2000" width="4200" height="4200" fill="transparent" onClick={() => { setSelectedNode(null); onBackgroundClick?.(); }} />

        <g transform={`translate(${cam.x},${cam.y}) scale(${cam.scale})`}>
          {/* Background surface */}
          <ellipse cx="555" cy="320" rx="600" ry="340" fill="url(#surfaceGrad)" />

          {/* ── Edges ── */}
          <g>
            {edges.map(edge => {
              const src = positions[edge.source];
              const tgt = positions[edge.target];
              if (!src || !tgt) return null;
              const key = `${edge.source}__${edge.target}`;
              const isHL = highlight.includes(edge.source) || highlight.includes(edge.target);
              const isHovered = hoveredEdge === key;
              const isConnected = selectedNode ? connectedEdgeKeys.has(key) : true;
              const w = edge.weight || 1;
              const baseWidth = 1.5 + Math.pow(w, 1.4) * 1.2;
              const strokeW = isHovered ? baseWidth + 2 : isConnected && selectedNode ? baseWidth + 1.5 : baseWidth;
              const color = edge.is_new ? C.gold : edge.clinician ? C.rust : edge.dashed ? C.goldSoft : C.tealSoft;
              const baseOpacity = isHovered ? 0.98 : edge.dashed || edge.is_new ? 0.6 : 0.78;
              const opacity = selectedNode ? (isConnected ? 1 : 0.08) : baseOpacity;
              const glowOp = isHovered ? 0.4 : isConnected && selectedNode ? 0.45 : edge.is_new ? 0.4 : 0.22;

              return (
                <g key={key} style={{ transition: 'opacity 350ms ease' }}>
                  {/* Invisible fat hit-area */}
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke="transparent" strokeWidth="14"
                    style={{ cursor: interactive ? 'pointer' : 'default', pointerEvents: interactive ? 'stroke' : 'none' }}
                    onMouseEnter={() => setHoveredEdge(key)} onMouseLeave={() => setHoveredEdge(null)}
                    onClick={(e) => { e.stopPropagation(); onEdgeClick?.(edge); }}
                  />
                  {/* Glow line */}
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={color} strokeWidth={strokeW + 6} strokeLinecap="round"
                    opacity={selectedNode && !isConnected ? 0 : glowOp} filter="url(#softblur)"
                    style={{ transition: 'opacity 350ms, stroke-width 350ms', pointerEvents: 'none' }}
                  />
                  {/* Visible line */}
                  <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={color} strokeWidth={strokeW}
                    strokeDasharray={edge.dashed || edge.is_new ? '6 5' : 'none'} strokeLinecap="round"
                    opacity={opacity}
                    style={{ transition: 'stroke-width 350ms, opacity 350ms', pointerEvents: 'none' }}
                  />
                  {/* Highlight dashes over new edges to make them pop */}
                  {edge.is_new && (
                    <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                      stroke={C.gold} strokeWidth={strokeW}
                      strokeDasharray="1 10" strokeLinecap="round"
                      opacity={opacity + 0.3}
                      style={{ transition: 'stroke-width 350ms, opacity 350ms', pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* ── Nodes ── */}
          <g>
            {nodes.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              const isHL = highlight.includes(node.id);
              const isPulse = pulseIds.includes(node.id);
              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode === node.id;
              const isNeighbor = selectedNode ? neighborSet.has(node.id) : true;
              const color = nodeColor(node.kind);
              const r = node.size * 0.55;
              const locked = isLockedKind(node.kind);
              const isSig = (isPulse && significancePulse) || node.kind === 'significance';
              const isClin = node.kind === 'clinician' || node.kind === 'clinician_safety';
              const gradIdx = Math.max(0, GRAD_COLORS.indexOf(color));
              const fadeOut = selectedNode && !isNeighbor;
              const nodeOpacity = fadeOut ? 0.12 : 1;

              // Aura type
              let auraId = 'auraTeal';
              if (color === C.gold || color === C.goldSoft || node.kind === 'significance' || node.kind === 'belief' || node.kind === 'faith') auraId = 'auraGold';
              else if (color === C.rust) auraId = 'auraRust';
              else if (color === C.brick) auraId = 'auraBrick';

              const auraR = isPulse || node.kind === 'significance' ? r * 3.2 : isSelected ? r * 2.8 : isHovered ? r * 2.4 : r * 1.9;
              const auraOp = isPulse || node.kind === 'significance' ? 1 : isSelected ? 1 : isHovered ? 0.85 : 0.55;

              return (
                <g key={`n-${node.id}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: interactive ? 'pointer' : 'default', opacity: nodeOpacity, transition: 'opacity 350ms ease' }}
                  onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)}
                  onClick={(e) => { e.stopPropagation(); setSelectedNode(selectedNode === node.id ? null : node.id); onNodeClick?.(node); }}
                >
                  {/* Aura (not for locked nodes) */}
                  {!locked && (
                    <circle r={auraR} fill={`url(#${auraId})`} opacity={auraOp}
                      style={{ pointerEvents: 'none', transition: 'r 400ms, opacity 400ms' }}
                    >
                      {(isPulse || node.kind === 'significance') && <>
                        <animate attributeName="r" values={`${auraR*0.8};${auraR*1.15};${auraR*0.8}`} dur="3.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;1;0.7" dur="3.2s" repeatCount="indefinite" />
                      </>}
                    </circle>
                  )}

                  {/* Ground shadow */}
                  <ellipse cx="0" cy={r * 0.55} rx={r * 0.95} ry={r * 0.22} fill={color} opacity="0.35" filter="url(#softblur)" />

                  {/* Significance ring */}
                  {isSig && (
                    <circle r={r + 12} fill="none" stroke={C.goldGlow} strokeWidth="2.5" opacity="0.7">
                      <animate attributeName="r" values={`${r+8};${r+22};${r+8}`} dur="2.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.85;0.1;0.85" dur="2.6s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Persistent "unconsolidated" ring for new nodes */}
                  {node.is_new && !isSig && !isSelected && (
                    <circle r={r + 4} fill="none" stroke={C.gold} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" style={{ pointerEvents: 'none' }}>
                      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="15s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Hover/highlight/selected ring */}
                  {(isHovered || isHL || isSelected) && (
                    <circle r={r + 7} fill="none" stroke={isSelected ? C.gold : color} strokeWidth={isSelected ? 3 : 2} opacity={isSelected ? 0.9 : 0.7} />
                  )}

                  {/* Main sphere */}
                  <circle r={r}
                    fill={locked ? 'url(#lockpattern)' : `url(#grad-${gradIdx})`}
                    stroke={locked ? C.locked : isClin ? C.rust : 'none'}
                    strokeWidth={isClin ? 2 : 0}
                    opacity={locked ? 0.92 : 0.97}
                    filter={isPulse || node.kind === 'significance' ? 'url(#bloom)' : 'url(#dropshadow)'}
                    style={{ transition: 'r 700ms cubic-bezier(.34,1.56,.64,1)' }}
                  />

                  {/* Specular highlight (not for locked) */}
                  {!locked && (
                    <circle cx={-r * 0.25} cy={-r * 0.3} r={r * 0.18} fill="white" opacity="0.55" style={{ pointerEvents: 'none' }} />
                  )}

                  {/* Lock icon for locked nodes */}
                  {locked && (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={-4} y={-4} width="8" height="9" rx="1" fill={C.ink} opacity="0.95" />
                      <path d="M -2.5 -4 v -3 a 2.5 2.5 0 0 1 5 0 v 3" stroke={C.ink} strokeWidth="1.5" fill="none" opacity="0.95" />
                    </g>
                  )}

                  {/* Label */}
                  <text x="0" y={r + 16} textAnchor="middle"
                    fontSize={Math.max(10, Math.min(14, node.size * 0.32))}
                    fontFamily={FONT_SANS} fill={node.is_new ? C.goldSoft : C.ink}
                    fontWeight={node.kind === 'self' || node.kind === 'significance' || node.is_new ? 600 : 400}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label.split('\n').map((line, j) => (
                      <tspan key={j} x="0" dy={j === 0 ? 0 : Math.max(11, node.size * 0.34)}>
                        {line}{j === 0 && node.is_new ? ' ✦' : ''}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Zoom controls */}
      {interactive && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, background: C.bgCard, border: `1px solid ${C.rule}`, borderRadius: 3, padding: 3 }}>
          <button onClick={() => setCam(c => ({ ...c, scale: Math.min(4, c.scale * 1.25) }))} style={zoomBtnStyle} title="Zoom in">+</button>
          <button onClick={() => setCam(c => ({ ...c, scale: Math.max(0.5, c.scale / 1.25) }))} style={zoomBtnStyle} title="Zoom out">{'\u2212'}</button>
          <button onClick={resetView} style={{ ...zoomBtnStyle, fontSize: 10 }} title="Reset view">reset</button>
        </div>
      )}

      {/* Hint text */}
      {interactive && (
        <div style={{ position: 'absolute', bottom: 10, left: 14, fontFamily: FONT_SANS, fontSize: 10, color: C.inkFaint, letterSpacing: '0.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          click any node or edge for details &middot; scroll to zoom &middot; drag empty space to pan
        </div>
      )}
    </div>
  );
}
