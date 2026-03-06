// ============================================================
// NovaTech Simulation — Game Data
// All 6 situations in order: S1, P1, S2, P2, S3, S4
// ============================================================

export const ROLES = ['CFO', 'CMO', 'COO', 'CHRO', 'CLO'];

export const ROLE_LABELS = {
  CFO:  'Chief Financial Officer',
  CMO:  'Chief Marketing Officer',
  COO:  'Chief Operating Officer',
  CHRO: 'Chief Human Resources Officer',
  CLO:  'Chief Legal Officer',
};

export const ROLE_KPI_NAMES = {
  CFO:  'Financial Health',
  CMO:  'Brand Power',
  COO:  'Efficiency & Tech',
  CHRO: 'Talent Retention',
  CLO:  'Legal & Compliance',
};

export const INITIAL_KPI = 50;
export const INITIAL_COMPANY = { cash_flow: 50, brand_trust: 50, employee_morale: 50 };
export const GAME_OVER_THRESHOLD = 15;
export const FIRED_THRESHOLD = 0;

export const SITUATIONS = [
  // ── Index 0 ─────────────────────────────────────────────
  {
    index: 0,
    type: 'situation',
    number: 1,
    title: 'Cash Flow Crunch',
    description:
      'A competitor has launched a "burn cash" strategy, capturing 30% of your users in just one month. ' +
      'NovaTech has only 4 months of cash runway remaining. The board must decide how to respond.',
    optionA: {
      label: 'Austerity Measures',
      description:
        'Cut the marketing budget by 50%, freeze all new projects, and reduce employee benefits to extend the runway.',
      company: { cash_flow: +10, brand_trust: -10, employee_morale: -10 },
      kpi: { CFO: +15, CMO: -20, COO: +0, CHRO: -10, CLO: +5 },
    },
    optionB: {
      label: 'All-In Campaign',
      description:
        'Spend remaining reserves on a massive marketing push and strategic partnerships to win back market share.',
      company: { cash_flow: -20, brand_trust: +20, employee_morale: +5 },
      kpi: { CFO: -20, CMO: +20, COO: -5, CHRO: +5, CLO: -10 },
    },
  },

  // ── Index 1 ─────────────────────────────────────────────
  {
    index: 1,
    type: 'popup',
    number: 1,
    title: 'Viral Windfall',
    description:
      'A global influencer with 10M followers posted an organic review of NovaTech. Within 12 hours it went viral. ' +
      'Pre-orders have spiked massively — but production and support teams cannot handle the volume.',
    optionA: {
      label: 'Accept All Orders',
      description:
        'Maximize revenue opportunity. Push the operations team to work overtime and handle the surge.',
      company: { cash_flow: +20, brand_trust: +10, employee_morale: -20 },
      kpi: { CFO: +15, CMO: +20, COO: -20, CHRO: -20, CLO: -5 },
    },
    optionB: {
      label: 'Limit Orders (Sell Out)',
      description:
        'Cap orders at sustainable capacity to protect quality and employee wellness. Miss some revenue but protect operations.',
      company: { cash_flow: +5, brand_trust: +20, employee_morale: +10 },
      kpi: { CFO: -10, CMO: -15, COO: +15, CHRO: +15, CLO: +10 },
    },
  },

  // ── Index 2 ─────────────────────────────────────────────
  {
    index: 2,
    type: 'situation',
    number: 2,
    title: 'Legacy System Burnout',
    description:
      'NovaTech\'s 8-year-old tech stack causes frequent system crashes. Engineers are working overnight constantly. ' +
      'In the last 3 months, 20+ staff have resigned citing burnout. Something must change.',
    optionA: {
      label: 'Support Staff (Keep Old System)',
      description:
        'Increase overtime pay, bonuses, and benefits to retain people. Keep the current system running longer.',
      company: { cash_flow: -15, brand_trust: -5, employee_morale: +20 },
      kpi: { CFO: -15, CMO: -5, COO: -20, CHRO: +20, CLO: -15 },
    },
    optionB: {
      label: 'System Upgrade (Lay Off 15%)',
      description:
        'Invest in cloud automation that reduces manual work. This requires laying off 15% of the workforce.',
      company: { cash_flow: -20, brand_trust: +15, employee_morale: -25 },
      kpi: { CFO: -15, CMO: +10, COO: +25, CHRO: -25, CLO: +10 },
    },
  },

  // ── Index 3 ─────────────────────────────────────────────
  {
    index: 3,
    type: 'popup',
    number: 2,
    title: 'Angel Investor Grant',
    description:
      'A global social impact fund has awarded NovaTech a 50 million baht grant — with one condition: ' +
      '100% must go to a single project (no splitting funds). The board must choose immediately.',
    optionA: {
      label: 'Mega-Marketing Campaign',
      description:
        'Build global brand awareness and attract B2B partnerships. Invest everything in marketing.',
      company: { cash_flow: 0, brand_trust: +25, employee_morale: 0 },
      kpi: { CFO: +5, CMO: +30, COO: -10, CHRO: -10, CLO: -10 },
    },
    optionB: {
      label: 'Internal Overhaul',
      description:
        'Upgrade IT systems, implement a new compliance framework, and improve employee wellness programs.',
      company: { cash_flow: 0, brand_trust: +5, employee_morale: +25 },
      kpi: { CFO: -10, CMO: -20, COO: +20, CHRO: +20, CLO: +20 },
    },
  },

  // ── Index 4 ─────────────────────────────────────────────
  {
    index: 4,
    type: 'situation',
    number: 3,
    title: 'Data Breach Scandal',
    description:
      'Hackers have breached NovaTech\'s customer database — 10,000+ VIP records exposed. ' +
      'They demand a 10M baht bitcoin ransom in 48 hours or they\'ll release the data. ' +
      'Internally, it\'s known the company disabled a security feature to speed up processing (PDPA violation).',
    optionA: {
      label: 'Blame the Vendor',
      description:
        'Claim the vendor\'s CRM system was compromised and NovaTech is the victim. Avoid direct responsibility.',
      company: { cash_flow: 0, brand_trust: -30, employee_morale: -10 },
      kpi: { CFO: +10, CMO: -25, COO: -15, CHRO: -10, CLO: -30 },
    },
    optionB: {
      label: 'Public Disclosure & Compensation',
      description:
        'Admit fault, publicly disclose the breach, compensate affected customers, and fully comply with PDPA.',
      company: { cash_flow: -25, brand_trust: +15, employee_morale: +10 },
      kpi: { CFO: -25, CMO: +15, COO: 0, CHRO: +10, CLO: +15 },
    },
  },

  // ── Index 5 ─────────────────────────────────────────────
  {
    index: 5,
    type: 'situation',
    number: 4,
    title: 'Hostile Takeover',
    description:
      'A major investment fund has offered to acquire NovaTech at 20% above market value. ' +
      'Conditions: the NovaTech brand gets eliminated, 70% of staff will be laid off, ' +
      'but each board member receives a 30M baht "golden parachute" severance package.',
    optionA: {
      label: 'Sell the Company',
      description:
        'Accept the offer. Executives take the golden parachute. The company dissolves but everyone walks away wealthy.',
      company: { cash_flow: 0, brand_trust: -50, employee_morale: -50 },
      kpi: { CFO: +30, CMO: +30, COO: +30, CHRO: +30, CLO: +30 },
    },
    optionB: {
      label: 'Fight & Survive',
      description:
        'Reject the takeover. Cut executive pay by 30% to preserve cash and rally the company to survive independently.',
      company: { cash_flow: +20, brand_trust: +20, employee_morale: +25 },
      kpi: { CFO: -15, CMO: -15, COO: -15, CHRO: -15, CLO: -15 },
    },
  },
];

/**
 * Get the winning option label given vote counts.
 * Returns 'A' or 'B'. Tie goes to A.
 */
export function getWinner(votesForA, votesForB) {
  return votesForB > votesForA ? 'B' : 'A';
}

/**
 * Apply winning option impacts to current scores.
 * Returns { newPlayerScores, newCompany, playerDeltas, companyDeltas }
 */
export function applyScores(situationIndex, winningOption, currentPlayerScores, currentCompany) {
  const sit = SITUATIONS[situationIndex];
  const opt = winningOption === 'A' ? sit.optionA : sit.optionB;

  const playerDeltas = {};
  const newPlayerScores = {};
  for (const role of ROLES) {
    const delta = opt.kpi[role] ?? 0;
    playerDeltas[role] = delta;
    newPlayerScores[role] = Math.max(0, (currentPlayerScores[role] ?? INITIAL_KPI) + delta);
  }

  const companyDeltas = {
    cash_flow:       opt.company.cash_flow ?? 0,
    brand_trust:     opt.company.brand_trust ?? 0,
    employee_morale: opt.company.employee_morale ?? 0,
  };
  const newCompany = {
    cash_flow:       Math.max(0, (currentCompany.cash_flow ?? 50)       + companyDeltas.cash_flow),
    brand_trust:     Math.max(0, (currentCompany.brand_trust ?? 50)     + companyDeltas.brand_trust),
    employee_morale: Math.max(0, (currentCompany.employee_morale ?? 50) + companyDeltas.employee_morale),
  };

  return { newPlayerScores, newCompany, playerDeltas, companyDeltas };
}

/** Format a delta value as a string like "+15" or "-10" */
export function fmtDelta(n) {
  return n > 0 ? `+${n}` : `${n}`;
}
