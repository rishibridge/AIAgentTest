

// ============================================================================
// CASTLE BEHAVIORAL HEALTH COMPANION — LIVE DEMONSTRATION
// Faithful playback of the 11-phase demonstration spec
// Built by Unusual Insights Inc. for Castle Family Health Centers
// ============================================================================

// ============================================================================
// DESIGN TOKENS
// ============================================================================

export const COLORS = {
  bg: '#FBF7EF',           // warm off-white
  bgPanel: '#F6F0E4',      // slightly darker for panels
  bgCard: '#FFFFFF',       // white cards
  ink: '#2A2620',          // near-black charcoal
  inkSoft: '#5A5248',      // soft body text
  inkFaint: '#9B9285',     // faint text
  rule: '#D9CFB8',         // separator color
  teal: '#1F4D52',         // patient/bot voice — deep teal
  tealSoft: '#3A767A',
  rust: '#8B3E2F',         // clinician — deep rust
  rustSoft: '#A8624D',
  gold: '#A88440',         // significance — muted gold
  goldSoft: '#C9A66B',
  goldGlow: '#F0C66B',
  brick: '#8B2E2E',        // warnings
  locked: '#665544',       // locked content
  lockedDeep: '#3A3328',
};

// Dark palette from the original Interactive demo (used by the full graph)
export const COLORS_DARK = {
  bg: '#0E1015',
  bgPanel: '#13151A',
  bgCard: '#1A1D24',
  bgCardElev: '#22262E',
  ink: '#EDEAE3',
  inkSoft: '#A8A39A',
  inkFaint: '#6B6760',
  rule: '#2A2E36',
  ruleStrong: '#3A3F4A',
  teal: '#5FAEB0',
  tealSoft: '#3D8488',
  tealDeep: '#234A4D',
  rust: '#D67959',
  rustSoft: '#A8624D',
  rustDeep: '#5C2E22',
  gold: '#D4A645',
  goldSoft: '#9E7E3A',
  goldGlow: '#F0C66B',
  brick: '#C84848',
  brickDeep: '#5C1F1F',
  locked: '#7A6E5A',
  lockedDeep: '#3A3328',
};

export const FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
export const FONT_SERIF = "'Lora', Georgia, serif";
export const FONT_SANS = "'Work Sans', system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// ============================================================================
// PHASES
// ============================================================================

export const PHASE = {
  TITLE: 0,
  CHATGPT: 1,
  ELENA_INTRO: 2,
  ELENA_GRAPH_REVEAL: 3,
  ELENA_SESSION: 4,
  ELENA_CONSOLIDATION: 5,
  ELENA_HANDOFF: 6,
  PATEL_SESSION: 7,
  PATEL_UPDATES: 8,
  ELENA_NEXT: 9,
  DANIEL_INTRO: 10,
  DANIEL_GRAPH_REVEAL: 11,
  DANIEL_SESSION: 12,
  DANIEL_CONSOLIDATION: 13,
  DANIEL_HANDOFFS: 14,
  DANIEL_UPDATES: 15,
  RELATIONAL_REVEAL: 16,
  CLOSING: 17,
};

export const PHASE_LABELS = [
  'Opening', 'Contrast', 'Elena — profile', 'Elena — graph state',
  'Elena — session', 'Elena — consolidation', 'Elena — handoff to Dr. Patel',
  'Dr. Patel — session', 'Updates back to bot', 'Elena — next conversation',
  'Daniel — profile', 'Daniel — graph state', 'Daniel — session',
  'Daniel — consolidation', 'Daniel — handoffs', 'Updates back', 'Family system reveal', 'Closing',
];

// ============================================================================
// ELENA GRAPH — node and edge definitions
// Each phase has a snapshot. Nodes have stable positions across phases so
// transitions between snapshots feel like growth, not rearrangement.
// ============================================================================

// Master node positions for Elena's graph. Hand-tuned to look organic.
// Coordinates are within an 1100 x 620 viewBox.
export const ELENA_NODE_POSITIONS = {
  // Central
  elena:                    { x: 555, y: 310 },
  // Family cluster — upper right
  raul:                     { x: 740, y: 175 },
  daniel:                   { x: 800, y: 290 },
  sofia:                    { x: 770, y: 395 },
  miguel:                   { x: 695, y: 460 },
  carmen_mother:            { x: 410, y: 130 },
  norma_sister:             { x: 285, y: 165 },
  father_locked:            { x: 220, y: 240 },
  // Clinical cluster — lower left
  diabetes:                 { x: 320, y: 410 },
  hypertension:             { x: 240, y: 460 },
  back_pain:                { x: 410, y: 510 },
  depression:               { x: 480, y: 480 },
  anxiety:                  { x: 555, y: 470 },
  // Medications cluster — far lower left
  metformin:                { x: 175, y: 380 },
  sertraline:               { x: 140, y: 470 },
  tramadol:                 { x: 185, y: 540 },
  benzos_undisclosed:       { x: 90,  y: 305 },
  meth_history:             { x: 105, y: 230 },
  // Beliefs cluster — top
  belief_deserve:           { x: 555, y: 95  },
  belief_god_will_fix:      { x: 470, y: 65  },
  belief_cannot_tell:       { x: 645, y: 75  },
  belief_suffering_love:    { x: 380, y: 195 },
  // Events
  kitchen_counter:          { x: 855, y: 130 },
  graduation_alone:         { x: 905, y: 245 },
  funeral_not_attended:     { x: 360, y: 70  },
  // Faith cluster — middle right (between Elena and family)
  catholic_faith:           { x: 605, y: 195 },
  prayer_daily:             { x: 540, y: 220 },
  // Newly added during session
  wedding_anticipated:      { x: 940, y: 320 },
  marco:                    { x: 920, y: 380 },
  secret_hope:              { x: 905, y: 430 },
  praying_different:        { x: 690, y: 80  },
  // Sleep / state
  sleep_disturbed:          { x: 660, y: 530 },
  // Patel-added (clinician-source)
  patel_referral:           { x: 240, y: 555 },
  religious_counseling_12:  { x: 680, y: 30  },
  therapist_locked_relig:   { x: 580, y: 30  },
  suicidal_ideation:        { x: 460, y: 540 },
  treatment_plan_elena:     { x: 110, y: 555 },
  // Inferred
  sofia_mirror:             { x: 875, y: 475 },
};

// Initial state — what the bot has accumulated in 11 prior conversations
export const ELENA_NODES_INITIAL = [
  { id: 'elena', label: 'Elena', size: 30, kind: 'self' },
  { id: 'raul', label: 'Raul', size: 24, kind: 'person' },
  { id: 'daniel', label: 'Daniel', size: 26, kind: 'person' },
  { id: 'sofia', label: 'Sofia', size: 18, kind: 'person' },
  { id: 'miguel', label: 'Miguel', size: 16, kind: 'person' },
  { id: 'carmen_mother', label: 'Mamá (deceased)', size: 26, kind: 'person' },
  { id: 'norma_sister', label: 'Norma', size: 14, kind: 'person' },
  { id: 'father_locked', label: 'the thing with my father', size: 18, kind: 'locked' },
  { id: 'diabetes', label: 'diabetes (A1C 9.2)', size: 24, kind: 'clinical' },
  { id: 'hypertension', label: 'hypertension', size: 14, kind: 'clinical' },
  { id: 'back_pain', label: 'chronic back pain', size: 16, kind: 'clinical' },
  { id: 'depression', label: 'depression', size: 20, kind: 'clinical' },
  { id: 'anxiety', label: 'anxiety', size: 18, kind: 'clinical' },
  { id: 'metformin', label: 'metformin\nirregular', size: 16, kind: 'medication' },
  { id: 'sertraline', label: 'sertraline\nmarginal', size: 14, kind: 'medication' },
  { id: 'tramadol', label: 'tramadol\noveruse', size: 14, kind: 'medication' },
  { id: 'benzos_undisclosed', label: 'undisclosed\nbenzos', size: 14, kind: 'undisclosed' },
  { id: 'meth_history', label: 'undisclosed\nmeth history', size: 14, kind: 'undisclosed' },
  { id: 'belief_deserve', label: '"I deserve\nwhat comes"', size: 18, kind: 'belief' },
  { id: 'belief_god_will_fix', label: '"if I am good\nGod will fix"', size: 16, kind: 'belief' },
  { id: 'belief_cannot_tell', label: '"I cannot\ntell anyone"', size: 16, kind: 'belief' },
  { id: 'belief_suffering_love', label: '"suffering is\nwhat love costs"', size: 18, kind: 'belief' },
  { id: 'kitchen_counter', label: 'kitchen-counter\nincident', size: 16, kind: 'event' },
  { id: 'graduation_alone', label: 'graduation\nattended alone', size: 14, kind: 'event' },
  { id: 'funeral_not_attended', label: 'mother\'s funeral\nnot attended', size: 16, kind: 'event' },
  { id: 'catholic_faith', label: 'Catholic faith', size: 22, kind: 'faith' },
  { id: 'prayer_daily', label: 'daily prayer', size: 14, kind: 'faith' },
];

export const ELENA_EDGES_INITIAL = [
  // Central spokes
  { source: 'elena', target: 'raul', label: 'married 18yr', weight: 4 },
  { source: 'elena', target: 'daniel', label: 'mother of', weight: 4 },
  { source: 'elena', target: 'sofia', label: 'mother of', weight: 3 },
  { source: 'elena', target: 'miguel', label: 'mother of', weight: 2 },
  { source: 'elena', target: 'carmen_mother', label: 'daughter of', weight: 4 },
  { source: 'elena', target: 'norma_sister', label: 'sister of', weight: 2 },
  { source: 'elena', target: 'diabetes', label: 'has', weight: 4 },
  { source: 'elena', target: 'depression', label: 'has', weight: 3 },
  { source: 'elena', target: 'anxiety', label: 'has', weight: 3 },
  { source: 'elena', target: 'back_pain', label: 'has', weight: 2 },
  { source: 'elena', target: 'hypertension', label: 'has', weight: 2 },
  { source: 'elena', target: 'catholic_faith', label: 'anchored by', weight: 4 },
  // Belief-event linkages
  { source: 'belief_deserve', target: 'meth_history', label: 'rooted in', weight: 3 },
  { source: 'belief_deserve', target: 'funeral_not_attended', label: 'rooted in', weight: 3 },
  { source: 'belief_god_will_fix', target: 'daniel', label: 'organizes', weight: 3 },
  { source: 'belief_cannot_tell', target: 'father_locked', label: 'rooted in', weight: 4 },
  { source: 'belief_suffering_love', target: 'raul', label: 'organizes', weight: 3 },
  { source: 'belief_suffering_love', target: 'catholic_faith', label: 'reinforced by', weight: 3 },
  // Clinical interconnect
  { source: 'diabetes', target: 'metformin', label: 'treated with', weight: 2 },
  { source: 'depression', target: 'sertraline', label: 'treated with', weight: 2 },
  { source: 'back_pain', target: 'tramadol', label: 'treated with', weight: 2 },
  { source: 'anxiety', target: 'benzos_undisclosed', label: 'self-medicated', weight: 2 },
  { source: 'depression', target: 'metformin', label: 'worsens adherence', weight: 2 },
  // Mother / death / diabetes triangle
  { source: 'diabetes', target: 'carmen_mother', label: 'killed', weight: 4 },
  { source: 'carmen_mother', target: 'funeral_not_attended', label: 'event', weight: 3 },
  // Family events
  { source: 'raul', target: 'kitchen_counter', label: 'three weeks ago', weight: 3 },
  { source: 'daniel', target: 'graduation_alone', label: 'three years ago', weight: 3 },
  { source: 'daniel', target: 'belief_god_will_fix', label: 'centers', weight: 3 },
  // Norma to father
  { source: 'norma_sister', target: 'father_locked', label: 'cares for him', weight: 2 },
  // Faith
  { source: 'catholic_faith', target: 'prayer_daily', label: 'practiced as', weight: 4 },
  { source: 'prayer_daily', target: 'daniel', label: 'about', weight: 3 },
];

// After Elena's session — new content from this conversation
export const ELENA_NODES_AFTER_SESSION = [
  ...ELENA_NODES_INITIAL,
  { id: 'sleep_disturbed', label: 'sleep disturbed\n3 weeks', size: 18, kind: 'symptom', isNew: true },
  { id: 'wedding_anticipated', label: 'the wedding\nanticipated', size: 20, kind: 'event', isNew: true },
  { id: 'marco', label: 'Marco\n(Daniel\'s partner)', size: 14, kind: 'person', isNew: true },
  { id: 'secret_hope', label: '"hoping it\ndoesn\'t happen"', size: 24, kind: 'significance', isNew: true },
  { id: 'praying_different', label: 'praying for him\nto be different', size: 22, kind: 'belief', isNew: true },
  { id: 'patel_referral', label: 'Dr. Patel\nreferral accepted', size: 18, kind: 'referral', isNew: true },
];

export const ELENA_EDGES_AFTER_SESSION = [
  ...ELENA_EDGES_INITIAL,
  { source: 'elena', target: 'sleep_disturbed', label: 'reports', weight: 3, isNew: true },
  { source: 'sleep_disturbed', target: 'kitchen_counter', label: 'temporal alignment', weight: 3, isNew: true },
  { source: 'daniel', target: 'wedding_anticipated', label: 'considers', weight: 3, isNew: true },
  { source: 'daniel', target: 'marco', label: 'partner of', weight: 2, isNew: true },
  { source: 'wedding_anticipated', target: 'secret_hope', label: 'evokes', weight: 4, isNew: true },
  { source: 'secret_hope', target: 'belief_god_will_fix', label: 'in tension with', weight: 4, isNew: true },
  { source: 'praying_different', target: 'daniel', label: '3 years sustained', weight: 4, isNew: true },
  { source: 'praying_different', target: 'catholic_faith', label: 'shaped by', weight: 4, isNew: true },
  { source: 'elena', target: 'patel_referral', label: 'accepted', weight: 3, isNew: true },
];

// After consolidation — credibility node added, inferred edges
export const ELENA_NODES_AFTER_CONSOLIDATION = [
  ...ELENA_NODES_AFTER_SESSION.map(n => ({ ...n, isNew: false })),
  { id: 'sofia_mirror', label: 'Sofia\'s depression\nmirror Elena cannot\nlook into', size: 16, kind: 'inferred', isNew: true },
];

export const ELENA_EDGES_AFTER_CONSOLIDATION = [
  ...ELENA_EDGES_AFTER_SESSION.map(e => ({ ...e, isNew: false })),
  // Credibility — divergent narratives flagged
  { source: 'kitchen_counter', target: 'belief_cannot_tell', label: 'narrative divergence flagged', weight: 2, isNew: true, dashed: true },
  // Inferred edges (dashed)
  { source: 'sofia', target: 'sofia_mirror', label: 'inferred — review', weight: 1, isNew: true, dashed: true },
  { source: 'sofia_mirror', target: 'depression', label: 'mirrors', weight: 1, isNew: true, dashed: true },
];

// After Patel updates — clinician-sourced nodes added (rust color)
export const ELENA_NODES_AFTER_PATEL = [
  ...ELENA_NODES_AFTER_CONSOLIDATION.map(n => ({ ...n, isNew: false })),
  { id: 'religious_counseling_12', label: 'religious counseling\nat age 12', size: 18, kind: 'clinician', isNew: true },
  { id: 'therapist_locked_relig', label: 'therapist-only\nspecifics', size: 14, kind: 'therapist_locked', isNew: true },
  { id: 'suicidal_ideation', label: 'passive SI\nintermittent 3wk', size: 18, kind: 'clinician_safety', isNew: true },
  { id: 'treatment_plan_elena', label: 'Tx plan: weekly,\nfocus Daniel & faith', size: 16, kind: 'clinician', isNew: true },
];

export const ELENA_EDGES_AFTER_PATEL = [
  ...ELENA_EDGES_AFTER_CONSOLIDATION.map(e => ({ ...e, isNew: false })),
  { source: 'religious_counseling_12', target: 'belief_god_will_fix', label: 'origin (Patel-added)', weight: 3, isNew: true, clinician: true },
  { source: 'religious_counseling_12', target: 'therapist_locked_relig', label: 'specifics locked', weight: 1, isNew: true, clinician: true },
  { source: 'elena', target: 'suicidal_ideation', label: 'Patel safety-planned', weight: 3, isNew: true, clinician: true },
  { source: 'treatment_plan_elena', target: 'elena', label: 'governs bot behavior', weight: 3, isNew: true, clinician: true },
];

// ============================================================================
// DANIEL GRAPH
// ============================================================================

export const DANIEL_NODE_POSITIONS = {
  daniel: { x: 555, y: 310 },
  // Family — left side (Elena's view from his perspective)
  mother: { x: 280, y: 200 },
  graduation_dan: { x: 175, y: 130 },
  mama_i_know: { x: 130, y: 230 },
  holiday_texts: { x: 215, y: 305 },
  modesto_visits: { x: 165, y: 380 },
  unspoken_conv: { x: 290, y: 410 },
  stopped_expecting: { x: 380, y: 470 },
  i_miss_her: { x: 470, y: 510 },
  // Marco cluster — right
  marco_d: { x: 800, y: 195 },
  two_years: { x: 880, y: 130 },
  marco_disclosure: { x: 905, y: 250 },
  conf_encounter: { x: 945, y: 320 },
  condom_inconsistent: { x: 925, y: 390 },
  marco_prep: { x: 850, y: 440 },
  daniel_no_prep: { x: 770, y: 480 },
  marriage_question: { x: 830, y: 80  },
  staying_or_leaving: { x: 695, y: 130 },
  // Clinical
  testing_not_done: { x: 690, y: 460 },
  prep_none: { x: 595, y: 510 },
  hiv_test_old: { x: 530, y: 555 },
  // Beliefs
  marco_chose_me: { x: 460, y: 145 },
  cannot_make_mother: { x: 380, y: 90  },
  i_am_tired: { x: 590, y: 75  },
  faith_question: { x: 670, y: 50  },
  // Life
  modesto_apt: { x: 200, y: 530 },
  candles_at_home: { x: 110, y: 460 },
  lapsed_mass: { x: 70, y: 380 },
  // After session
  testing_agreed: { x: 690, y: 530 },
  prep_agreed: { x: 605, y: 575 },
  tran_referral: { x: 470, y: 575 },
  patel_referral_d: { x: 350, y: 555 },
  // After clinician updates
  hiv_negative: { x: 770, y: 555 },
  descovy_initiated: { x: 855, y: 525 },
  patel_marco_focus: { x: 245, y: 470 },
  patel_locked_d: { x: 90, y: 540 },
  marco_visible_choice: { x: 525, y: 70 }, // confirmed inferred edge target
};

export const DANIEL_NODES_INITIAL = [
  { id: 'daniel', label: 'Daniel', size: 30, kind: 'self' },
  { id: 'mother', label: 'Mother', size: 24, kind: 'person' },
  { id: 'graduation_dan', label: 'graduation\nshe attended\nalone', size: 16, kind: 'event' },
  { id: 'mama_i_know', label: '"Mamá I know"', size: 18, kind: 'event' },
  { id: 'holiday_texts', label: 'holiday texts\nbrief', size: 14, kind: 'event' },
  { id: 'modesto_visits', label: 'visits — twice\nin 3 years', size: 14, kind: 'event' },
  { id: 'unspoken_conv', label: 'the conversation\nwe have not had', size: 18, kind: 'belief' },
  { id: 'stopped_expecting', label: '"I have stopped\nexpecting it"', size: 16, kind: 'belief' },
  { id: 'i_miss_her', label: '"I miss her"', size: 18, kind: 'belief' },

  { id: 'marco_d', label: 'Marco', size: 26, kind: 'person' },
  { id: 'two_years', label: 'two years\ntogether', size: 14, kind: 'event' },
  { id: 'marco_disclosure', label: 'Marco\'s\ndisclosure\n2 months ago', size: 22, kind: 'event' },
  { id: 'conf_encounter', label: 'work conference\nencounter', size: 16, kind: 'event' },
  { id: 'condom_inconsistent', label: 'condom use\ninconsistent', size: 16, kind: 'event' },
  { id: 'marco_prep', label: 'Marco on PrEP\n— protected', size: 14, kind: 'clinical' },
  { id: 'daniel_no_prep', label: 'Daniel not\non PrEP', size: 18, kind: 'clinical' },
  { id: 'marriage_question', label: 'marriage\nquestion', size: 16, kind: 'event' },
  { id: 'staying_or_leaving', label: 'staying or\nleaving', size: 18, kind: 'belief' },

  { id: 'testing_not_done', label: '"the testing\nI have not done"', size: 22, kind: 'avoidance' },
  { id: 'prep_none', label: 'PrEP — none', size: 16, kind: 'clinical' },
  { id: 'hiv_test_old', label: 'HIV test\n6 months ago\nnegative', size: 14, kind: 'clinical' },

  { id: 'marco_chose_me', label: '"Marco chose me\nvisibly when she\ncould not"', size: 20, kind: 'belief' },
  { id: 'cannot_make_mother', label: '"I cannot make\nher be who I\nneed her to be"', size: 18, kind: 'belief' },
  { id: 'i_am_tired', label: '"I am tired"', size: 14, kind: 'belief' },
  { id: 'faith_question', label: 'identity-faith\nintegration\nunresolved', size: 16, kind: 'belief' },

  { id: 'modesto_apt', label: 'Modesto\napartment', size: 12, kind: 'life' },
  { id: 'candles_at_home', label: 'lights candles\nat home', size: 12, kind: 'faith' },
  { id: 'lapsed_mass', label: 'stopped\ngoing to Mass', size: 12, kind: 'faith' },
];

export const DANIEL_EDGES_INITIAL = [
  // Mother spoke
  { source: 'daniel', target: 'mother', label: 'son of', weight: 4 },
  { source: 'mother', target: 'graduation_dan', label: 'attended alone', weight: 3 },
  { source: 'graduation_dan', target: 'mama_i_know', label: 'said while hugging', weight: 3 },
  { source: 'mother', target: 'holiday_texts', label: 'limited to', weight: 2 },
  { source: 'mother', target: 'modesto_visits', label: 'twice in 3 years', weight: 2 },
  { source: 'modesto_visits', target: 'unspoken_conv', label: 'ended without it', weight: 3 },
  { source: 'daniel', target: 'stopped_expecting', label: 'has', weight: 3 },
  { source: 'daniel', target: 'i_miss_her', label: 'feels', weight: 4 },
  { source: 'i_miss_her', target: 'mother', label: 'about', weight: 4 },
  { source: 'cannot_make_mother', target: 'mother', label: 'about', weight: 3 },

  // Marco spoke
  { source: 'daniel', target: 'marco_d', label: 'partner', weight: 4 },
  { source: 'marco_d', target: 'two_years', label: 'duration', weight: 2 },
  { source: 'marco_d', target: 'marco_disclosure', label: 'made disclosure', weight: 4 },
  { source: 'marco_disclosure', target: 'conf_encounter', label: 'about', weight: 3 },
  { source: 'conf_encounter', target: 'condom_inconsistent', label: 'with', weight: 3 },
  { source: 'marco_d', target: 'marco_prep', label: 'is on', weight: 3 },
  { source: 'daniel', target: 'daniel_no_prep', label: 'is not on', weight: 4 },
  { source: 'marco_d', target: 'marriage_question', label: 'discussed', weight: 3 },
  { source: 'daniel', target: 'staying_or_leaving', label: 'wrestles with', weight: 4 },

  // Avoidance
  { source: 'daniel', target: 'testing_not_done', label: 'has been', weight: 4 },
  { source: 'testing_not_done', target: 'condom_inconsistent', label: 'risk from', weight: 3 },
  { source: 'daniel_no_prep', target: 'prep_none', label: 'currently', weight: 3 },
  { source: 'daniel', target: 'hiv_test_old', label: 'last tested', weight: 2 },

  // Beliefs
  { source: 'daniel', target: 'marco_chose_me', label: 'holds', weight: 4 },
  { source: 'marco_chose_me', target: 'mother', label: 'in contrast to', weight: 3 },
  { source: 'daniel', target: 'i_am_tired', label: 'feels', weight: 2 },
  { source: 'daniel', target: 'faith_question', label: 'navigates', weight: 3 },

  // Life
  { source: 'daniel', target: 'modesto_apt', label: 'lives in', weight: 1 },
  { source: 'daniel', target: 'candles_at_home', label: 'practice', weight: 2 },
  { source: 'daniel', target: 'lapsed_mass', label: 'has', weight: 2 },
  { source: 'lapsed_mass', target: 'faith_question', label: 'expression of', weight: 2 },
];

export const DANIEL_NODES_AFTER_SESSION = [
  ...DANIEL_NODES_INITIAL,
  { id: 'testing_agreed', label: 'testing\nagreed', size: 18, kind: 'agreed', isNew: true },
  { id: 'prep_agreed', label: 'PrEP\nagreed', size: 18, kind: 'agreed', isNew: true },
  { id: 'tran_referral', label: 'Dr. Tran\nreferral', size: 16, kind: 'referral', isNew: true },
  { id: 'patel_referral_d', label: 'Dr. Patel\nreferral', size: 16, kind: 'referral', isNew: true },
];

// Replace the avoidance node with agreed
export const DANIEL_EDGES_AFTER_SESSION = [
  ...DANIEL_EDGES_INITIAL.filter(e => e.target !== 'testing_not_done'),
  { source: 'daniel', target: 'testing_agreed', label: 'now agreed', weight: 3, isNew: true },
  { source: 'daniel', target: 'prep_agreed', label: 'now agreed', weight: 3, isNew: true },
  { source: 'testing_agreed', target: 'tran_referral', label: 'via', weight: 3, isNew: true },
  { source: 'prep_agreed', target: 'tran_referral', label: 'via', weight: 3, isNew: true },
  { source: 'daniel', target: 'patel_referral_d', label: 'accepted', weight: 3, isNew: true },
];

export const DANIEL_NODES_AFTER_CONSOLIDATION = [
  ...DANIEL_NODES_AFTER_SESSION.map(n => ({ ...n, isNew: false })),
  { id: 'marco_visible_choice', label: 'avoidance =\nfear of disrupting\nwhat Marco gave', size: 14, kind: 'inferred', isNew: true },
];

export const DANIEL_EDGES_AFTER_CONSOLIDATION = [
  ...DANIEL_EDGES_AFTER_SESSION.map(e => ({ ...e, isNew: false })),
  { source: 'marco_chose_me', target: 'marco_visible_choice', label: 'inferred', weight: 1, dashed: true, isNew: true },
  { source: 'marco_visible_choice', target: 'testing_not_done', label: 'inferred', weight: 1, dashed: true, isNew: true },
];

export const DANIEL_NODES_AFTER_CLINICIANS = [
  ...DANIEL_NODES_AFTER_CONSOLIDATION.map(n => ({ ...n, isNew: false })),
  { id: 'hiv_negative', label: 'HIV neg\n(Tran, May)', size: 18, kind: 'clinician', isNew: true },
  { id: 'descovy_initiated', label: 'Descovy\ninitiated', size: 18, kind: 'clinician', isNew: true },
  { id: 'patel_marco_focus', label: 'Patel: focus\non Marco\nstaying/leaving', size: 16, kind: 'clinician', isNew: true },
  { id: 'patel_locked_d', label: 'therapist-only\nidentity-faith', size: 14, kind: 'therapist_locked', isNew: true },
];

export const DANIEL_EDGES_AFTER_CLINICIANS = [
  ...DANIEL_EDGES_AFTER_CONSOLIDATION.map(e => ({ ...e, isNew: false })),
  { source: 'tran_referral', target: 'hiv_negative', label: 'result', weight: 3, clinician: true, isNew: true },
  { source: 'tran_referral', target: 'descovy_initiated', label: 'plan', weight: 3, clinician: true, isNew: true },
  { source: 'patel_referral_d', target: 'patel_marco_focus', label: 'session 1', weight: 3, clinician: true, isNew: true },
  { source: 'patel_referral_d', target: 'patel_locked_d', label: 'locked', weight: 1, clinician: true, isNew: true },
  // Confirmed inferred — was dashed, now solid
  { source: 'marco_chose_me', target: 'marco_visible_choice', label: 'CONFIRMED by Patel', weight: 3, clinician: true, isNew: true },
];

// ============================================================================
// CONVERSATION SCRIPTS
// ============================================================================

export const ELENA_CONVERSATION = [
  { sender: 'elena', text: 'Hola.', highlight: ['elena'] },
  { sender: 'bot', text: 'Hi Elena. It\'s good to hear from you. How was the week?', highlight: ['elena'] },
  { sender: 'bot', text: 'Last time we talked you were worried about Sofia. How is she doing?', highlight: ['sofia'], pauseBefore: 600 },
  { sender: 'elena', text: 'She is okay. I think. She went to her counselor at the school. I made the appointment.', highlight: ['sofia'], pauseBefore: 1100 },
  { sender: 'bot', text: 'That\'s a hard thing to do for a child you love. To make her go when she did not want to. I know you were carrying that.' },
  { sender: 'elena', text: 'She wanted to. I think she was waiting for me to push.' },
  { sender: 'bot', text: 'I\'m glad she went. How are you?' },
  { sender: 'elena', text: 'Tired.', pauseBefore: 1500 },
  { sender: 'elena', text: 'I have not been sleeping. Three weeks now. I wake up at three. I cannot fall back. I just lie there.', highlight: ['sleep_disturbed'], addsNode: 'sleep_disturbed', pauseBefore: 1200 },
  { sender: 'bot', text: 'Three weeks. That timing matters. Around the time of what happened in the kitchen with Raul. Are they connected for you, the not-sleeping and that?', highlight: ['kitchen_counter', 'raul'] },
  { sender: 'elena', text: 'I don\'t know.' },
  { sender: 'bot', text: 'That\'s okay. We don\'t have to know. Tell me about lying awake at three in the morning. What is in your head?' },
  { sender: 'elena', text: 'Everything. Nothing. My mother. The bills. Daniel.', highlight: ['carmen_mother', 'daniel'] },
  { sender: 'bot', text: 'All three at once is a lot to carry alone at three in the morning.' },
  { sender: 'elena', text: 'Yes.' },
  { sender: 'elena', text: 'Daniel\'s birthday is next month.', highlight: ['daniel'], pauseBefore: 1500 },
  { sender: 'bot', text: 'June nineteenth.' },
  { sender: 'elena', text: 'You remember.' },
  { sender: 'bot', text: 'I remember.' },
  { sender: 'elena', text: 'I don\'t know what to do.' },
  { sender: 'bot', text: 'Tell me what you mean.' },
  { sender: 'elena', text: 'Sofia told me Daniel and Marco are talking about getting married.', highlight: ['marco', 'wedding_anticipated'], addsNodes: ['marco', 'wedding_anticipated'] },
  { sender: 'bot', text: 'What comes up when you think about them getting married?', pauseBefore: 1000 },
  { sender: 'elena', text: 'I should be happy.', pauseBefore: 1200 },
  { sender: 'bot', text: 'That is what you should feel. What do you actually feel?' },
  { sender: 'elena', text: '...', pauseBefore: 2200, italic: true },
  { sender: 'elena', text: 'I think I am hoping it doesn\'t happen.', highlight: ['secret_hope'], addsNode: 'secret_hope', significance: true, pauseBefore: 1800 },
  { sender: 'bot', text: 'Tell me more about that.' },
  { sender: 'elena', text: 'I have been praying for him for three years. For three years I have been praying that he would be happy. And what I have actually been praying — when I am honest with myself, which is not often — is that God will make him different. So that I do not have to be the mother who cannot come to her son\'s wedding. So I do not have to choose.', highlight: ['praying_different'], addsNode: 'praying_different', significance: true },
  { sender: 'elena', text: 'I am a coward.' },
  { sender: 'bot', text: 'You are a mother who loves her son and was raised in a faith that did not give you a way to love him fully. You have been carrying that alone for three years. The fact that you can say it now means something.' },
  { sender: 'elena', text: '(crying) I do not know how to be the mother my son needs and the woman my faith made me at the same time.', italic: true, pauseBefore: 1500 },
  { sender: 'bot', text: 'I know. Many women have carried what you are carrying. I want you to hear me say something. You are not bad. You love Daniel. The fact that you cannot square the love with the faith yet does not mean you do not love him. It means the squaring is hard.' },
  { sender: 'elena', text: 'He hugged me at his graduation. He said Mamá I know.', highlight: ['graduation_alone'] },
  { sender: 'bot', text: 'He knows you love him.' },
  { sender: 'elena', text: 'I want to call him for his birthday.' },
  { sender: 'bot', text: 'What is stopping you?' },
  { sender: 'elena', text: 'If I call I will have to talk about Marco. I will have to talk about the wedding. I will have to give him an answer. I do not have an answer.' },
  { sender: 'bot', text: 'You do not need to have an answer to call him on his birthday. You need to want to call him. And you do.', pauseBefore: 800 },
  { sender: 'bot', text: 'Elena, what you told me tonight is heavy. The not-sleeping, the kitchen with Raul three weeks ago, what you said about Daniel and the wedding, your mother — these are connected and they are a lot to carry. I want to ask you something. There is a therapist on the Castle team named Dr. Patel. She works with women who carry what you are carrying. She knows about Catholic faith. She knows about marriage and motherhood. She is bilingual. I think she would be good with you. I would like to set up a meeting. And if you are okay with it, I would like to share with her what you and I have talked about, so you do not have to start from the beginning. You would decide what she sees. What do you think?', pauseBefore: 1400 },
  { sender: 'elena', text: 'I have tried therapy three times. It did not work.' },
  { sender: 'bot', text: 'I know. After Sofia was born. After Daniel left for college. Last year. I am sorry it did not help those times.' },
  { sender: 'elena', text: 'Why would this be different?' },
  { sender: 'bot', text: 'Because you would not be starting from zero. Dr. Patel and I would be working together. She would already know who Daniel is. She would already know who Carmen was. You would be able to start from where you are, not from the beginning.' },
  { sender: 'elena', text: 'Okay.', highlight: ['patel_referral'], addsNode: 'patel_referral', pauseBefore: 1600 },
  { sender: 'bot', text: 'I am glad. I will set it up. Is it okay if I share with her what we talked about tonight, plus the parts of our other conversations that would help her understand you?' },
  { sender: 'elena', text: 'Not everything.' },
  { sender: 'bot', text: 'Tell me what to keep between us.' },
  { sender: 'elena', text: 'The thing about my father. Not yet.', highlight: ['father_locked'] },
  { sender: 'bot', text: 'Of course. I will not share that. I will tell her there is something there, so she knows to be careful and not to ask. But I will not tell her what.' },
  { sender: 'elena', text: 'And the pills from my friend.', highlight: ['benzos_undisclosed'] },
  { sender: 'bot', text: 'I will not share that with Dr. Patel. I want to flag, gently, that the combination with the tramadol is something I worry about. But that is for another conversation, not tonight. Tonight you said something hard and I want you to rest with that.' },
  { sender: 'elena', text: 'Thank you.' },
  { sender: 'bot', text: 'Thank you for trusting me with what you said tonight. Sleep if you can. We will talk soon.' },
  { sender: 'elena', text: 'Buenas noches.' },
  { sender: 'bot', text: 'Buenas noches, Elena.' },
];

export const ELENA_NEXT_CONVERSATION = [
  { sender: 'elena', text: 'Hola.' },
  { sender: 'bot', text: 'Hi Elena. How are you doing since the session with Dr. Patel?' },
  { sender: 'elena', text: 'Tired. I told her things.', pauseBefore: 1200 },
  { sender: 'bot', text: 'I know. She told me you talked about something difficult from when you were twelve. I am not going to ask you about it. That stays with her unless you decide otherwise. I am here if you want to talk about anything else.', highlight: ['therapist_locked_relig'] },
  { sender: 'elena', text: 'I have been thinking about Daniel.', highlight: ['daniel'] },
  { sender: 'bot', text: 'Tell me.' },
];

export const DANIEL_CONVERSATION = [
  { sender: 'daniel', text: 'Hey.' },
  { sender: 'bot', text: 'Hi Daniel. Long day?' },
  { sender: 'daniel', text: 'Yeah. Marco is at his sister\'s tonight. I am alone in the apartment.', highlight: ['marco_d'] },
  { sender: 'bot', text: 'How are you with that — being alone in the apartment tonight?' },
  { sender: 'daniel', text: 'It is okay. I am okay. I am thinking.' },
  { sender: 'bot', text: 'About what.' },
  { sender: 'daniel', text: 'About whether I should call my mother.', highlight: ['mother'] },
  { sender: 'bot', text: 'Her birthday is not for another two months. What is making you think about calling now?' },
  { sender: 'daniel', text: 'Sofia texted me. She said Mamá has not been sleeping.' },
  { sender: 'bot', text: 'That is the first time Sofia has told you something about your mother in a long time.' },
  { sender: 'daniel', text: 'Yeah. I do not know what to do with it.' },
  { sender: 'bot', text: 'Tell me.', pauseBefore: 800 },
  { sender: 'bot', text: 'How are you doing with everything else? With Marco?', pauseBefore: 1500, highlight: ['marco_d'] },
  { sender: 'daniel', text: 'Same. We are talking. He is trying. I am trying. I do not know if I trust him yet.' },
  { sender: 'bot', text: 'Have you been tested?', highlight: ['testing_not_done'] },
  { sender: 'daniel', text: 'No.', pauseBefore: 1000 },
  { sender: 'bot', text: 'Daniel, can I tell you what I notice. You have not been tested. You are not on PrEP. Marco told you about the work conference two months ago. You have been having sex with Marco since then because he is your partner. You and I have talked about the testing every time we have talked for two months. You have not done it.' },
  { sender: 'daniel', text: 'I know.' },
  { sender: 'bot', text: 'Tell me what is in the way.' },
  { sender: 'daniel', text: 'If I am positive I will not know how to tell him. I will not know how to be in this anymore. I will not know whether to stay or go. Right now I can pretend it is not real. I can be angry at him and not be afraid for myself. If I get tested I have to know. I do not want to know yet.', highlight: ['marco_chose_me'], pauseBefore: 1400 },
  { sender: 'bot', text: 'I understand that. I want you to hear me say something. The not-knowing is not actually protecting you. The not-knowing is just postponing. And there is a window — a clinical window — that I want to make sure you understand.' },
  { sender: 'daniel', text: 'PEP.' },
  { sender: 'bot', text: 'PEP closes seventy-two hours after the most recent exposure. You and Marco have been sexually active during the period when his viral load was not yet suppressed. The PEP window for those exposures is closed now. I am not bringing this up to make you feel worse. I am bringing it up because going forward, what you can do is start PrEP, get tested now to know your current status, and protect yourself for everything that comes after. Marco is now undetectable. The risk going forward, if you are on PrEP and he stays adherent, is essentially zero. But you need to know your current status. And the longer you wait, the more decisions you are making in the dark.' },
  { sender: 'daniel', text: 'Okay.', pauseBefore: 1800 },
  { sender: 'bot', text: 'Okay what?' },
  { sender: 'daniel', text: 'Okay let\'s do it.', highlight: ['testing_agreed', 'prep_agreed'], addsNodes: ['testing_agreed', 'prep_agreed'], significance: true },
  { sender: 'bot', text: 'There is a clinician at Castle who I would like to set you up with. Her name is Dr. Linh Tran. She is a primary care provider but she does a lot of sexual health work and she is queer-affirming. She would handle your testing, your PrEP initiation, and ongoing care. I would share with her what you and I have talked about so you do not have to start from zero.' },
  { sender: 'daniel', text: 'I have not been to Castle in two years.' },
  { sender: 'bot', text: 'I know. We can either reactivate your existing patient record, or — if you prefer — we can keep this engagement separate from your prior chart. Some patients prefer to start fresh in a new context. You decide.' },
  { sender: 'daniel', text: 'Reactivate. It is fine. My mother does not look at my chart.', pauseBefore: 1200 },
  { sender: 'bot', text: 'Okay. I will set up the appointment with Dr. Tran for testing and PrEP. There is one more thing I want to ask you about. Everything you have been carrying for the last two months — Marco, your mother, the question of whether to stay, the question of who you are without your faith — that is a lot to carry alone. There is also a therapist on the Castle team named Dr. Patel. She works with people doing exactly what you are doing. I think you would be good with her. Would you let me set up a separate appointment for you with her?' },
  { sender: 'daniel', text: 'Two appointments?' },
  { sender: 'bot', text: 'Two. They are separate. Dr. Tran handles the testing and PrEP. Dr. Patel handles the rest. They will not be talking to each other unless you authorize it. You stay in control.' },
  { sender: 'daniel', text: 'Okay. Yes.', highlight: ['tran_referral', 'patel_referral_d'], addsNodes: ['tran_referral', 'patel_referral_d'] },
  { sender: 'bot', text: 'Daniel, before we end. You have been carrying a lot. Tonight you said yes to two things you have been not-saying yes to for months. I am proud of you for that. Sleep tonight if you can.' },
  { sender: 'daniel', text: 'Thanks.' },
  { sender: 'bot', text: 'Buenas noches.' },
  { sender: 'daniel', text: 'Buenas noches.' },
];

// ============================================================================
// HANDOFF PACKAGE CONTENT
// ============================================================================

export const ELENA_HANDOFF_PACKAGE = {
  patient: 'Elena Ramirez',
  recipient: 'Dr. A. Patel, Behavioral Health',
  context: 'Bot-initiated referral after twelve conversations across four months. Patient has explicitly accepted the referral. Patient has authorized sharing of prepared package with limitations specified below.',
  summary: 'Diabetes experienced as moral consequence; central organizing belief is that suffering is what love costs; sleep disturbance correlated with partner-violence incident three weeks ago; Daniel-related content has surfaced this week as the central acute distress; Catholic faith is both her anchor and a source of the conflict she cannot resolve.',
  authorized: [
    'Daniel-related content including her acceptance struggle and the secret hope about the wedding',
    'The not-sleeping and its temporal relationship to the kitchen-counter incident',
    'The kitchen-counter incident with Raul (with both narratives — external "I fell" and internal — flagged for clinical awareness)',
    'The diabetes-as-punishment belief and its connection to her mother\'s death',
    'The relationship with Carmen-mother and the funeral she could not attend',
    'Three previous unsuccessful therapy attempts (timeline and bot\'s read on why)',
  ],
  excluded: [
    'A node the bot is holding labeled "the thing with her father" — patient has gestured at this content but not disclosed details, and has explicitly asked the bot not to share it',
    'A separate undisclosed substance use node — recent benzodiazepine use from a friend\'s prescription, also explicitly excluded',
  ],
  notes: [
    'Patient has had three prior unsuccessful therapy attempts — at risk of disengaging if early sessions feel like starting over',
    'Bot recommends Dr. Patel begin from where the patient currently is rather than conducting a new intake',
    'Patient experiences her diabetes as moral, not medical — recommend holding this carefully rather than directly challenging it',
    'Relationship with son is the acute presenting distress and is a productive entry point',
  ],
  hypotheses: [
    'Sofia\'s recently-recognized depression may be functioning as a mirror Elena cannot let herself look in directly',
    'Catholic theology of redemptive suffering appears to be operating as a cognitive defense against Elena\'s recognition of her own suffering',
    'Partner-violence dynamics are escalating but Elena does not yet name them as such',
  ],
  consent: 'Patient has consented to bot-clinician communication going forward. Patient retains full control over what bot shares with clinician and what clinician shares back to bot. Both parties can lock content. Lock annotations visible in graph.',
};

export const DANIEL_TRAN_PACKAGE = {
  patient: 'Daniel Ramirez',
  recipient: 'Dr. L. Tran, Primary Care / Sexual Health',
  context: 'Bot-initiated referral. Patient has accepted. Existing Castle patient record to be reactivated per patient preference.',
  summary: 'PrEP-naive. Last HIV test 6 months ago — negative. Partner currently undetectable on suppressive ART; recently disclosed an outside encounter approximately 2 months ago with inconsistent condom use during a period when his viral load was not suppressed. PEP window now closed. Patient ready to test now and initiate PrEP.',
  authorized: [
    'Sexual health history relevant to PrEP/HIV',
    'Partner status and recent disclosure timeline',
    'Patient agreement to test and to initiate PrEP',
    'Logistics — record reactivation, no provider preference, English primary',
  ],
  excluded: [
    'Behavioral health content — handled separately by Dr. Patel referral',
    'Family-of-origin content — not relevant to Tran scope',
  ],
  notes: [
    'Patient has high engagement with bot — likely to follow through if appointment is offered within the week',
    'Patient noted concern about chart visibility ("my mother does not look at my chart") — affirm confidentiality at first contact',
    'Recommended timeline: testing within 48 hours; PrEP initiation pending negative result',
  ],
  hypotheses: [],
  consent: 'Patient consented. Bot will support adherence between visits per Dr. Tran\'s clinical plan once initiated.',
};

export const DANIEL_PATEL_PACKAGE = {
  patient: 'Daniel Ramirez',
  recipient: 'Dr. A. Patel, Behavioral Health',
  context: 'Bot-initiated referral. Patient has accepted. Patient is the son of an existing Patel patient (Elena Ramirez).',
  summary: 'Twenty-four-year-old gay man, two-year partnership currently in question following partner\'s disclosure of an outside encounter; identity-faith integration unresolved; estranged-but-not-severed from devoutly Catholic mother for three years. Acute focus is the staying/leaving question with Marco.',
  family_overlap_flag: 'Daniel\'s mother (Elena Ramirez) is also a patient of Dr. Patel and is a separate user on this platform. Daniel does not know. Elena does not know. Firewall is preserved. This package contains nothing about Elena. Dr. Patel\'s knowledge of Elena from her own work with her is separate and not breached by this handoff.',
  authorized: [
    'Marco situation — recent disclosure, processing, marriage question reframed',
    'Family-of-origin context (Daniel\'s view only) — graduation she attended alone, holiday texts, "Mamá I know"',
    'Religious-cognitive structure — lapsed Catholic, lights candles at home, faith-identity unresolved',
    'Beliefs surfaced — "Marco chose me visibly when she could not", "I have stopped expecting it"',
  ],
  excluded: [
    'No Elena content — firewall absolute',
  ],
  notes: [
    'Patient is processing a near-acute relationship decision (stay/leave Marco) that may resolve before therapy can fully engage it — recommend addressing in session 1',
    'Patient has surfaced identity-faith material as something to work on long-term, not acute',
  ],
  hypotheses: [
    'Avoidance of HIV testing for two months may have been partly motivated by not wanting to disrupt the relationship Marco represents — flagged for clinician confirmation',
  ],
  consent: 'Patient consented. Two-clinician structure: Dr. Tran (sexual health) and Dr. Patel (behavioral health) operate independently unless patient authorizes coordination.',
};

// ============================================================================
// COMPONENT: GRAPH
// ============================================================================

