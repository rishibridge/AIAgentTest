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
function credibilityBadge(kind) {
  switch (kind) {
    case 'clinical': case 'medication':
      return { color: '#4CAF50', label: 'Clinical: High Credibility' };
    case 'locked': case 'therapist_locked':
      return { color: '#5FAEB0', label: 'Clinician-Sourced' };
    case 'undisclosed':
      return { color: '#D9B873', label: 'Patient-Stated: Unverified' };
    case 'inferred':
      return { color: '#C17A5A', label: 'Inferred: Low Credibility' };
    default:
      return null; // identity nodes — no badge
  }
}

// ── zoom button style ────────────────────────────────────────────────
const zoomBtnStyle = {
  width: 26, height: 26, fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500,
  background: 'transparent', color: C.ink, border: `1px solid ${C.rule}`,
  borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// ── gradient palette for radial fills ────────────────────────────────
const GRAD_COLORS = [C.teal, C.tealSoft, C.gold, C.goldSoft, C.rust, C.brick, C.inkSoft, C.locked];

const RITUAL_STAGE_LABELS = [
  'Stage 1/5 • Capturing Short-Term Working Memory Buffer',
  'Stage 2/5 • Advocate vs. Skeptic: Significance Filtering',
  'Stage 3/5 • Auditing Credibility & Narrative Divergences',
  'Stage 4/5 • Merging Nodes & Thickening Synaptic Edges',
  'Stage 5/5 • Drawing Dashed Inferred Hypotheses into Long-Term Graph',
];

// Wrap long single-line labels at word boundaries without truncating any characters
function wrapSvgLabelLines(rawLabel, maxLineChars = 36) {
  const explicitLines = String(rawLabel || '').split('\n');
  const wrapped = [];
  for (const rawLine of explicitLines) {
    const trimmed = rawLine.trim();
    if (trimmed.length <= maxLineChars || !trimmed.includes(' ')) {
      wrapped.push(trimmed);
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const w of words) {
      if (!current) {
        current = w;
      } else if (current.length + 1 + w.length <= maxLineChars) {
        current += ` ${w}`;
      } else {
        wrapped.push(current);
        current = w;
      }
    }
    if (current) wrapped.push(current);
  }
  return wrapped.length ? wrapped : [''];
}

// ── main graph component ─────────────────────────────────────────────
export default function InteractiveGraph({
  nodes, edges, positions,
  highlight = [], pulseIds = [], significancePulse = false,
  interactive = true, viewBox = '0 0 1100 620',
  onNodeClick, onEdgeClick, onBackgroundClick,
  ritualMode = 'idle', // 'idle' | 'scanning' | 'integrating'
  ritualStage = 0,
  integrationDelta = null,
  onReplayRitual,
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

  // Locate central self node for hippocampal scan waves & synaptic streams
  const selfNode = useMemo(() => nodes.find(n => n.kind === 'self') || nodes[0], [nodes]);
  const selfPos = useMemo(() => {
    if (selfNode && positions[selfNode.id]) return positions[selfNode.id];
    return { x: 550, y: 310 };
  }, [selfNode, positions]);

  // Fast lookup sets for Short-Term -> Long-Term integration delta
  const encodedShortTermSet = useMemo(
    () => new Set(integrationDelta?.encoded_short_term_ids || []),
    [integrationDelta]
  );
  const newConsolNodeSet = useMemo(
    () => new Set([
      ...(integrationDelta?.new_consolidation_node_ids || []),
      ...(integrationDelta?.inferred_node_ids || []),
      ...(integrationDelta?.significant_node_ids || []),
    ]),
    [integrationDelta]
  );
  const newConsolEdgeSet = useMemo(
    () => new Set([
      ...(integrationDelta?.new_consolidation_edge_keys || []),
      ...(integrationDelta?.inferred_edge_keys || []),
    ]),
    [integrationDelta]
  );

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

  // Identify edges carrying active synaptic particle streams during ritualMode ('scanning' or 'integrating')
  const synapticEdges = useMemo(() => {
    if (ritualMode === 'idle') return [];
    const newNodeIds = new Set(nodes.filter(n => n.is_new || encodedShortTermSet.has(n.id) || newConsolNodeSet.has(n.id)).map(n => n.id));
    const candidates = edges.filter(
      e => e.is_new || e.consolidated_new || newConsolEdgeSet.has(`${e.source}__${e.target}`) || newNodeIds.has(e.source) || newNodeIds.has(e.target)
    );
    return (candidates.length > 0 ? candidates : edges.slice(0, 8)).slice(0, 12);
  }, [ritualMode, nodes, edges, encodedShortTermSet, newConsolNodeSet, newConsolEdgeSet]);

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

          {/* ── Hippocampal Scan & Cortical Integration Waves (Active during ritualMode) ── */}
          {ritualMode !== 'idle' && (
            <g style={{ pointerEvents: 'none' }}>
              {[0, 1, 2].map((waveIdx) => {
                const isIntegrating = ritualMode === 'integrating';
                const waveColor = isIntegrating
                  ? (waveIdx % 2 === 0 ? C.teal : C.gold)
                  : (waveIdx % 2 === 0 ? C.gold : C.teal);
                return (
                  <circle
                    key={`ritual-wave-${waveIdx}`}
                    cx={selfPos.x}
                    cy={selfPos.y}
                    r="28"
                    fill="none"
                    stroke={waveColor}
                    strokeWidth={isIntegrating ? '2.2' : '1.6'}
                    strokeDasharray={isIntegrating ? 'none' : '8 6'}
                    opacity="0"
                  >
                    <animate
                      attributeName="r"
                      values="24;330"
                      dur="2.7s"
                      begin={`${waveIdx * 0.9}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.65;0.25;0"
                      dur="2.7s"
                      begin={`${waveIdx * 0.9}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                );
              })}
            </g>
          )}

          {/* ── Edges ── */}
          <g>
            {edges.map(edge => {
              const src = positions[edge.source];
              const tgt = positions[edge.target];
              if (!src || !tgt) return null;
              const key = `${edge.source}__${edge.target}`;
              const isHL = highlight.includes(edge.source) || highlight.includes(edge.target) || newConsolEdgeSet.has(key);
              const isHovered = hoveredEdge === key;
              const isConnected = selectedNode ? connectedEdgeKeys.has(key) : true;
              const isNewlyConsolidatedEdge = Boolean(edge.consolidated_new || newConsolEdgeSet.has(key));
              const w = edge.weight || 1;
              const baseWidth = 1.5 + Math.pow(w, 1.4) * 1.2;
              const strokeW = isHovered ? baseWidth + 2 : isConnected && selectedNode ? baseWidth + 1.5 : isHL && ritualMode === 'integrating' ? baseWidth + 1.2 : baseWidth;
              const color = edge.is_new || isNewlyConsolidatedEdge ? C.gold : edge.clinician ? C.rust : edge.dashed ? C.goldSoft : C.tealSoft;
              const baseOpacity = isHovered ? 0.98 : isNewlyConsolidatedEdge ? 0.92 : edge.dashed || edge.is_new ? 0.65 : 0.78;
              const opacity = selectedNode ? (isConnected ? 1 : 0.08) : baseOpacity;
              const glowOp = isHovered ? 0.4 : isConnected && selectedNode ? 0.45 : (edge.is_new || isNewlyConsolidatedEdge) ? 0.45 : 0.22;

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
                    style={{
                      transition: 'stroke-width 450ms, opacity 350ms',
                      pointerEvents: 'none',
                      animation: isNewlyConsolidatedEdge && ritualMode === 'integrating' ? 'edgeDrawIn 1.2s ease-out both' : 'none',
                    }}
                  />
                  {/* Highlight dashes over new or newly consolidated edges to make them pop */}
                  {(edge.is_new || isNewlyConsolidatedEdge) && (
                    <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                      stroke={C.gold} strokeWidth={strokeW}
                      strokeDasharray="1 10" strokeLinecap="round"
                      opacity={Math.min(1, opacity + 0.3)}
                      style={{ transition: 'stroke-width 350ms, opacity 350ms', pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* ── Synaptic Particle Photons Streaming Along Active Memory Edges ── */}
          {ritualMode !== 'idle' && (
            <g style={{ pointerEvents: 'none' }}>
              {synapticEdges.map((edge, idx) => {
                const src = positions[edge.source];
                const tgt = positions[edge.target];
                if (!src || !tgt) return null;
                // During 'scanning', flow from peripheral short-term nodes toward self; during 'integrating', flow outward to encode
                const fromPos = ritualMode === 'scanning' && edge.source === selfNode?.id ? tgt : src;
                const toPos = ritualMode === 'scanning' && edge.source === selfNode?.id ? src : tgt;
                const particleColor = ritualMode === 'scanning' ? C.gold : C.teal;
                return (
                  <g key={`synaptic-stream-${edge.source}-${edge.target}-${idx}`}>
                    <circle r="4" fill={particleColor} filter="url(#glow)" opacity="0.9">
                      <animate attributeName="cx" values={`${fromPos.x};${toPos.x}`} dur="1.5s" begin={`${(idx % 4) * 0.3}s`} repeatCount="indefinite" />
                      <animate attributeName="cy" values={`${fromPos.y};${toPos.y}`} dur="1.5s" begin={`${(idx % 4) * 0.3}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" begin={`${(idx % 4) * 0.3}s`} repeatCount="indefinite" />
                    </circle>
                    <circle r="2.8" fill="#FFF" opacity="0.85">
                      <animate attributeName="cx" values={`${fromPos.x};${toPos.x}`} dur="1.5s" begin={`${(idx % 4) * 0.3 + 0.75}s`} repeatCount="indefinite" />
                      <animate attributeName="cy" values={`${fromPos.y};${toPos.y}`} dur="1.5s" begin={`${(idx % 4) * 0.3 + 0.75}s`} repeatCount="indefinite" />
                    </circle>
                  </g>
                );
              })}
            </g>
          )}

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
              const isEncodedFromShortTerm = encodedShortTermSet.has(node.id);
              const isNewlyMintedByConsol = Boolean(node.consolidated_new || newConsolNodeSet.has(node.id));
              const color = nodeColor(node.kind);
              const r = node.size * 0.55;
              const locked = isLockedKind(node.kind);
              const isSig = (isPulse && significancePulse) || node.kind === 'significance' || (ritualMode === 'integrating' && isNewlyMintedByConsol);
              const isClin = node.kind === 'clinician' || node.kind === 'clinician_safety';
              const gradIdx = Math.max(0, GRAD_COLORS.indexOf(color));
              const fadeOut = selectedNode && !isNeighbor;
              const nodeOpacity = fadeOut ? 0.12 : 1;

              // Aura type
              let auraId = 'auraTeal';
              if (color === C.gold || color === C.goldSoft || node.kind === 'significance' || node.kind === 'belief' || node.kind === 'faith' || isNewlyMintedByConsol) auraId = 'auraGold';
              else if (color === C.rust) auraId = 'auraRust';
              else if (color === C.brick) auraId = 'auraBrick';

              const auraR = isPulse || node.kind === 'significance' || (ritualMode !== 'idle' && (node.is_new || isEncodedFromShortTerm || isNewlyMintedByConsol))
                ? r * 3.2
                : isSelected ? r * 2.8 : isHovered ? r * 2.4 : r * 1.9;
              const auraOp = isPulse || node.kind === 'significance' || (ritualMode !== 'idle' && (node.is_new || isEncodedFromShortTerm || isNewlyMintedByConsol))
                ? 1
                : isSelected ? 1 : isHovered ? 0.85 : 0.55;

              const cleanAriaLabel = String(node.label || node.id).replace(/\s*\n\s*/g, ' ').trim();
              return (
                <g key={`n-${node.id}`}
                  role="img"
                  aria-label={`${cleanAriaLabel} (${node.kind})`}
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
                      {(isPulse || node.kind === 'significance' || (ritualMode !== 'idle' && (node.is_new || isEncodedFromShortTerm || isNewlyMintedByConsol))) && <>
                        <animate attributeName="r" values={`${auraR*0.8};${auraR*1.15};${auraR*0.8}`} dur="3.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;1;0.7" dur="3.2s" repeatCount="indefinite" />
                      </>}
                    </circle>
                  )}

                  {/* Ground shadow */}
                  <ellipse cx="0" cy={r * 0.55} rx={r * 0.95} ry={r * 0.22} fill={color} opacity="0.35" filter="url(#softblur)" />

                  {/* Significance / Newly Minted Consolidation ring */}
                  {isSig && (
                    <circle r={r + 12} fill="none" stroke={C.goldGlow} strokeWidth="2.5" opacity="0.7">
                      <animate attributeName="r" values={`${r+8};${r+22};${r+8}`} dur="2.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.85;0.1;0.85" dur="2.6s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Persistent "unconsolidated" dashed ring for short-term working memory nodes */}
                  {node.is_new && !isSig && !isSelected && (
                    <circle r={r + 5} fill="none" stroke={C.gold} strokeWidth={ritualMode === 'scanning' ? '2.2' : '1.5'} strokeDasharray="3 3" opacity="0.9" style={{ pointerEvents: 'none' }}>
                      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={ritualMode === 'scanning' ? '4s' : '15s'} repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Solid Cortical Ring for nodes just encoded from Short-Term -> Long-Term Memory */}
                  {!node.is_new && (isEncodedFromShortTerm || isNewlyMintedByConsol) && (
                    <circle
                      r={r + 5.5}
                      fill="none"
                      stroke={isNewlyMintedByConsol ? C.gold : C.teal}
                      strokeWidth="1.8"
                      opacity={ritualMode === 'integrating' ? '0.95' : '0.65'}
                      style={{ pointerEvents: 'none', transition: 'all 500ms ease' }}
                    />
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
                    filter={isPulse || node.kind === 'significance' || isNewlyMintedByConsol ? 'url(#bloom)' : 'url(#dropshadow)'}
                    style={{ transition: 'r 700ms cubic-bezier(.34,1.56,.64,1)' }}
                  />

                  {/* Credibility badge */}
                  {(() => {
                    const badge = credibilityBadge(node.kind);
                    if (!badge) return null;
                    return (
                      <circle
                        cx={r * 0.7} cy={-r * 0.7} r={4}
                        fill={badge.color} stroke="#fff" strokeWidth={1}
                        style={{ pointerEvents: 'none' }}
                      >
                        <title>{badge.label}</title>
                      </circle>
                    );
                  })()}

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

                  {/* Label (L2: space separator between tspan lines for screen readers & text copy) */}
                  <text x="0" y={r + 16} textAnchor="middle"
                    fontSize={Math.max(10, Math.min(14, node.size * 0.32))}
                    fontFamily={FONT_SANS} fill={node.is_new || isNewlyMintedByConsol ? C.goldSoft : C.ink}
                    fontWeight={node.kind === 'self' || node.kind === 'significance' || node.is_new || isNewlyMintedByConsol ? 600 : 400}
                    style={{ pointerEvents: 'none' }}
                  >
                    {wrapSvgLabelLines(node.label || node.id).map((line, j) => (
                      <tspan key={j} x="0" dy={j === 0 ? 0 : Math.max(11, node.size * 0.34)}>
                        {j > 0 ? ` ${line}` : line}{j === 0 && (node.is_new || isNewlyMintedByConsol) ? ' ✦' : ''}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* ── Top-Left Hippocampal Consolidation Ritual HUD / Long-Term Summary Overlay ── */}
      {ritualMode === 'scanning' && (
        <div
          data-testid="ritual-scanning-hud"
          className="fade-enter-active"
          style={{
            position: 'absolute', top: 14, left: 14, zIndex: 15,
            background: 'rgba(10, 12, 16, 0.9)',
            border: '1px solid rgba(217, 184, 115, 0.45)',
            borderRadius: 10, padding: '12px 16px',
            backdropFilter: 'blur(12px)',
            maxWidth: 'min(460px, calc(100% - 120px))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D9B873', boxShadow: '0 0 10px #D9B873', animation: 'pulse 1.2s infinite' }} />
            <span style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D9B873' }}>
              Short-Term → Long-Term Memory Integration
            </span>
          </div>
          <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: '#EDEAE3', fontWeight: 500, marginBottom: 8 }}>
            {RITUAL_STAGE_LABELS[Math.min(4, Math.max(0, ritualStage))]}
          </div>
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, (ritualStage + 1) * 20)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #5FAEB0, #D9B873)',
                transition: 'width 500ms ease',
              }}
            />
          </div>
        </div>
      )}

      {ritualMode !== 'scanning' && integrationDelta && (
        <div
          data-testid="integration-summary-pill"
          className="fade-enter-active"
          style={{
            position: 'absolute', top: 14, left: 14, zIndex: 15,
            background: 'rgba(10, 12, 16, 0.88)',
            border: `1px solid ${ritualMode === 'integrating' ? 'rgba(217,184,115,0.6)' : 'rgba(95,174,176,0.38)'}`,
            borderRadius: 10, padding: '10px 14px',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            maxWidth: 'min(580px, calc(100% - 120px))',
            boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
          }}
        >
          <div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ritualMode === 'integrating' ? '#D9B873' : '#5FAEB0', marginBottom: 3 }}>
              {ritualMode === 'integrating' ? '✦ Cortical Crystallization Active — Encoding Long-Term Graph' : '✦ Short-Term → Long-Term Memory Encoded'}
            </div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: '#B5AEA3', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>Working → Long-Term: <strong style={{ color: '#EDEAE3' }}>{(integrationDelta.encoded_short_term_ids || []).length}</strong></span>
              <span>•</span>
              <span>New Inferences: <strong style={{ color: '#D9B873' }}>+{(integrationDelta.new_consolidation_node_ids || []).length} nodes / +{(integrationDelta.new_consolidation_edge_keys || []).length} links</strong></span>
              {integrationDelta.graph_version && (
                <>
                  <span>•</span>
                  <span>Graph <strong style={{ color: '#5FAEB0' }}>v{integrationDelta.graph_version}</strong></span>
                </>
              )}
            </div>
          </div>
          {onReplayRitual && (
            <button
              data-testid="replay-ritual-btn"
              onClick={onReplayRitual}
              style={{
                background: 'rgba(217,184,115,0.12)',
                border: '1px solid rgba(217,184,115,0.4)',
                color: '#D9B873',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 10,
                fontFamily: FONT_SANS,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              ↻ Replay Ritual
            </button>
          )}
        </div>
      )}

      {/* Zoom controls */}
      {interactive && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, background: C.bgCard, border: `1px solid ${C.rule}`, borderRadius: 3, padding: 3 }}>
          <button onClick={() => setCam(c => ({ ...c, scale: Math.min(4, c.scale * 1.25) }))} style={zoomBtnStyle} title="Zoom in">+</button>
          <button onClick={() => setCam(c => ({ ...c, scale: Math.max(0.5, c.scale / 1.25) }))} style={zoomBtnStyle} title="Zoom out">{'\u2212'}</button>
          <button onClick={resetView} style={{ ...zoomBtnStyle, fontSize: 10 }} title="Reset view">reset</button>
        </div>
      )}

      {/* Hint text (H7: hidden on narrow mobile viewports via .ally-graph-hint) */}
      {interactive && (
        <div className="ally-graph-hint" style={{ position: 'absolute', bottom: 10, left: 14, fontFamily: FONT_SANS, fontSize: 10, color: C.inkFaint, letterSpacing: '0.06em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          click any node or edge for details &middot; scroll to zoom &middot; drag empty space to pan
        </div>
      )}
    </div>
  );
}
