// ============================================================
// NovaTech Simulation — ข้อมูลเกม (ภาษาไทย)
// ลำดับสถานการณ์: S1, S2, P1, S3, P2, S4
// ============================================================

export const ROLES = ['CFO', 'CMO', 'COO', 'CHRO', 'CLO'];

export const ROLE_LABELS = {
  CFO:  'ประธานเจ้าหน้าที่ฝ่ายการเงิน',
  CMO:  'ประธานเจ้าหน้าที่ฝ่ายการตลาด',
  COO:  'ประธานเจ้าหน้าที่ฝ่ายปฏิบัติการ',
  CHRO: 'ประธานเจ้าหน้าที่ฝ่ายทรัพยากรบุคคล',
  CLO:  'ประธานเจ้าหน้าที่ฝ่ายกฎหมาย',
};

export const ROLE_KPI_NAMES = {
  CFO:  'สุขภาพทางการเงิน',
  CMO:  'พลังของแบรนด์',
  COO:  'ประสิทธิภาพและระบบ',
  CHRO: 'การรักษาบุคลากร',
  CLO:  'ความถูกต้องทางกฎหมาย',
};

export const INITIAL_KPI = 50;
export const INITIAL_COMPANY = { cash_flow: 50, brand_trust: 50, employee_morale: 50 };
export const GAME_OVER_THRESHOLD = 0;
export const FIRED_THRESHOLD = 0;

export const SITUATIONS = [
  // ── Index 0 — S1 ───────────────────────────────────────────
  {
    index: 0,
    type: 'situation',
    number: 1,
    title: 'วิกฤตยอดขายตกและกระแสเงินสดร่อยหรอ',
    description:
      'คู่แข่งข้ามชาติเปิดตัวกลยุทธ์ "Burn Cash" กระโจนเข้าสู่ตลาด ปล่อยโปรโมชั่นแบบไม่สนกำไร ' +
      'ภายในเดือนเดียว ผู้ใช้งานประจำของ NovaTech หายไปถึง 30% ' +
      'รายงานบัญชีล่าสุดระบุว่า Cash Runway เหลือเพียง 4 เดือน ' +
      'บอร์ดบริหารต้องตัดสินใจทันที — จะรัดเข็มขัดหรือทุ่มหมดหน้าตัก?',
    optionA: {
      label: 'รัดเข็มขัด ตัดงบ 50%',
      description:
        'ตัดงบการตลาดลงครึ่งหนึ่ง ชะลอโครงการใหม่ และลดสวัสดิการบางส่วน ' +
        'เพื่อยืดเวลาหายใจออกไปได้อีกประมาณ 8 เดือน',
      company: { cash_flow: +10, brand_trust: -10, employee_morale: -10 },
      kpi: { CFO: +15, CMO: -20, COO: +0, CHRO: -10, CLO: +5 },
    },
    optionB: {
      label: 'ทุ่มหมดหน้าตัก จัดแคมเปญใหญ่',
      description:
        'ใช้เงินก้อนสุดท้ายของบริษัทจัด Big Campaign ครั้งใหญ่ ' +
        'อัดโปรโมชั่นการตลาดและความร่วมมือกับพาร์ตเนอร์ให้หนักที่สุด ' +
        'เพื่อดึงผู้ใช้กลับมาในระยะเวลาอันสั้น นี่คือการเดิมพันแบบ All-in',
      company: { cash_flow: -20, brand_trust: +20, employee_morale: +5 },
      kpi: { CFO: -20, CMO: +20, COO: -5, CHRO: +5, CLO: -10 },
    },
  },

  // ── Index 1 — S2 ───────────────────────────────────────────
  {
    index: 1,
    type: 'situation',
    number: 2,
    title: 'หนี้กรรมทางเทคโนโลยีและพนักงานหมดไฟ',
    description:
      'โครงสร้างพื้นฐานด้านไอทีของ NovaTech ถูกสร้างขึ้นตั้งแต่เริ่มสตาร์ทอัปเมื่อ 8 ปีก่อน ' +
      'ระบบล่มในช่วง Peak เกิดขึ้นบ่อยขึ้น ทีมวิศวกรต้องแก้โค้ดฉุกเฉินจนถึงเช้าแทบทุกคืน ' +
      'ฝ่าย HR พบใบลาออกจากพนักงานระดับท็อปกว่า 20 ใบ ทุกใบเขียนเหตุผลว่า "หมดไฟ (Burnout)" ' +
      'พร้อมกันนั้น Vendor เสนอระบบ Cloud Automation ใหม่ที่แก้ปัญหาได้ แต่ต้องปลดพนักงาน 15%',
    optionA: {
      label: 'ประคองคนไว้ ใช้ระบบเดิมต่อ',
      description:
        'เพิ่มค่าล่วงเวลา ปรับโบนัส และเพิ่มสวัสดิการชั่วคราว ' +
        'เพื่อรักษาพนักงานไว้และซื้อเวลาให้ทีมงานหายใจได้บ้าง ' +
        'แต่ระบบเก่าจะยังคงสร้างปัญหาต่อไป',
      company: { cash_flow: -15, brand_trust: -5, employee_morale: +20 },
      kpi: { CFO: -15, CMO: -5, COO: -20, CHRO: +20, CLO: -15 },
    },
    optionB: {
      label: 'รีบก้าวสู่ระบบใหม่ ปลดพนักงาน 15%',
      description:
        'ลงทุนในระบบ Cloud Automation ใหม่ทันที ลด Downtime และเพิ่มประสิทธิภาพระยะยาว ' +
        'แต่ต้องปลดพนักงานราว 15% ซึ่งอาจทำลายความเชื่อใจในองค์กร',
      company: { cash_flow: -20, brand_trust: +15, employee_morale: -25 },
      kpi: { CFO: -15, CMO: +10, COO: +25, CHRO: -25, CLO: +10 },
    },
  },

  // ── Index 2 — P1 ───────────────────────────────────────────
  {
    index: 2,
    type: 'popup',
    number: 1,
    title: 'ปรากฏการณ์ไวรัลข้ามคืน',
    description:
      'อินฟลูเอนเซอร์ระดับโลก 10 ล้านฟอลโลเวอร์ โพสต์รีวิว NovaTech แบบออร์แกนิคโดยบริษัทไม่ได้จ้าง ' +
      'ภายใน 12 ชั่วโมง คลิปกลายเป็นไวรัล ยอด Pre-order พุ่งทะลักจนเกินกำลังผลิตและทีม Support ' +
      'ฝ่าย Operation แจ้งว่าหากเปิดรับออเดอร์ทั้งหมด ระบบอาจล่ม การส่งของล่าช้า บอร์ดต้องตัดสินใจทันที',
    optionA: {
      label: 'กอบโกยให้สุด เปิดรับออเดอร์ทั้งหมด',
      description:
        'เปิดรับออเดอร์ทุกรายการ โกยเงินสดเข้าบริษัทให้มากที่สุด ' +
        'แล้วค่อยให้ฝ่ายผลิตและทีม Support เร่งทำงานล่วงเวลาเพื่อไล่ตามยอด',
      company: { cash_flow: +20, brand_trust: +10, employee_morale: -20 },
      kpi: { CFO: +15, CMO: +20, COO: -20, CHRO: -20, CLO: -5 },
    },
    optionB: {
      label: 'จำกัดออเดอร์ ประกาศ Sold Out ชั่วคราว',
      description:
        'จำกัดจำนวนออเดอร์เท่าที่ระบบรับได้ เพื่อรักษาคุณภาพบริการ ' +
        'และไม่ให้พนักงานทำงานเกินกำลัง แม้จะเสียรายได้บางส่วน',
      company: { cash_flow: +5, brand_trust: +20, employee_morale: +10 },
      kpi: { CFO: -10, CMO: -15, COO: +15, CHRO: +15, CLO: +10 },
    },
  },

  // ── Index 3 — S3 ───────────────────────────────────────────
  {
    index: 3,
    type: 'situation',
    number: 3,
    title: 'วิกฤตข้อมูลหลุด สแกนดัลสะเทือนแบรนด์',
    description:
      'กลุ่มแฮกเกอร์เจาะระบบและดึงข้อมูลส่วนบุคคลของลูกค้า VIP กว่า 10,000 รายชื่อออกไปได้ ' +
      'พวกเขาเรียกค่าไถ่ Bitcoin มูลค่า 10 ล้านบาท ภายใน 48 ชั่วโมง หากไม่จ่ายจะปล่อยข้อมูลลง Dark Web ' +
      'ปัญหาคือ ทีมวิศวกรของ NovaTech เคยปิดระบบ Security Module ชั่วคราวเพื่อให้ระบบทำงานเร็วขึ้น ' +
      'และไม่เคยเปิดกลับ — ซึ่งถือเป็นการละเมิด PDPA',
    optionA: {
      label: 'โยนความผิดให้ Vendor เต็มรูปแบบ',
      description:
        'ประกาศว่าการรั่วไหลเกิดจาก Vendor ภายนอกที่พัฒนาระบบ CRM ' +
        'และกำลังดำเนินการฟ้องร้องเพื่อเรียกค่าเสียหาย ' +
        'แต่มีประวัติ Log ในระบบที่แสดงว่าบริษัทเองปิดระบบความปลอดภัยไว้',
      company: { cash_flow: 0, brand_trust: -30, employee_morale: -10 },
      kpi: { CFO: +10, CMO: -25, COO: -15, CHRO: -10, CLO: -30 },
    },
    optionB: {
      label: 'แถลงการณ์ยอมรับและจ่ายชดเชยลูกค้า',
      description:
        'ออกแถลงการณ์อย่างโปร่งใส ยอมรับว่าการรั่วไหลเกิดจากทั้ง Vendor และการตัดสินใจภายใน ' +
        'พร้อมประกาศมาตรการเยียวยาลูกค้าที่ได้รับผลกระทบ และปฏิบัติตามหลัก PDPA อย่างเคร่งครัด',
      company: { cash_flow: -25, brand_trust: +15, employee_morale: +10 },
      kpi: { CFO: -25, CMO: +15, COO: 0, CHRO: +10, CLO: +15 },
    },
  },

  // ── Index 4 — P2 ───────────────────────────────────────────
  {
    index: 4,
    type: 'popup',
    number: 2,
    title: 'ทุนให้เปล่าจากนักลงทุนพันธมิตร',
    description:
      'กองทุนเพื่อสังคมระดับโลกแห่งหนึ่ง ประทับใจในวิสัยทัศน์และศักยภาพระยะยาวของ NovaTech ' +
      'จึงตัดสินใจมอบเงินให้เปล่า (Grant) มูลค่า 50 ล้านบาท ' +
      'แต่มีเงื่อนไขสำคัญ: เงินทั้งหมดต้องถูกใช้กับโครงการเดียว 100% ห้ามแบ่งงบ ' +
      'แต่ละแผนกต่างเสนอเหตุผลว่าทำไมเงินนี้ควรเป็นของพวกเขา',
    optionA: {
      label: 'ทุ่มงบการตลาด Mega-Marketing & Global PR',
      description:
        'ทุ่มเงินทั้งหมดไปกับแคมเปญการตลาดระดับโลก สร้าง Brand Awareness ขนาดใหญ่ ' +
        'หวังดึงลูกค้าระดับ B2B และพาร์ตเนอร์รายใหญ่เข้ามา',
      company: { cash_flow: 0, brand_trust: +25, employee_morale: 0 },
      kpi: { CFO: +5, CMO: +30, COO: -10, CHRO: -10, CLO: -10 },
    },
    optionB: {
      label: 'ทุ่มงบรื้อระบบหลังบ้าน และสวัสดิการ',
      description:
        'นำเงินทั้งหมดไปยกระดับระบบภายใน อัปเกรดโครงสร้าง IT ' +
        'จ้างที่ปรึกษากฎหมายมาวางระบบ Compliance ใหม่ และปรับปรุงสวัสดิการพนักงาน',
      company: { cash_flow: 0, brand_trust: +5, employee_morale: +25 },
      kpi: { CFO: -10, CMO: -20, COO: +20, CHRO: +20, CLO: +20 },
    },
  },

  // ── Index 5 — S4 ───────────────────────────────────────────
  {
    index: 5,
    type: 'situation',
    number: 4,
    title: 'ข้อเสนอควบรวมกิจการ เผชิญหน้าความโลภ',
    description:
      'กลุ่มทุนยักษ์ใหญ่ระดับประเทศเสนอซื้อกิจการ NovaTech ทั้งบริษัท ในราคาสูงกว่าตลาด 20% ' +
      'พร้อมอัดฉีดเงินทุนและล้างหนี้ทั้งหมด แต่เงื่อนไขคือ: แบรนด์ NovaTech จะถูกยุบถาวร ' +
      'พนักงานกว่า 70% ถูกเลิกจ้าง และบอร์ดบริหารจะได้รับเงินชดเชยพิเศษคนละ 30 ล้านบาท ' +
      'นี่คือคำถามที่ตรงไปตรงมา — จะเลือกเอาตัวรอด หรือเลือกสู้ต่อ?',
    optionA: {
      label: 'โหวตขายกิจการ',
      description:
        'ยอมรับข้อเสนอการซื้อกิจการ ผู้ถือหุ้นได้ผลตอบแทน ผู้บริหารได้รับเงินชดเชยก้อนใหญ่ ' +
        'แต่ชื่อ NovaTech จะหายไปจากตลาด และพนักงานหลายร้อยชีวิตจะถูกทิ้งไว้ข้างหลัง',
      company: { cash_flow: 0, brand_trust: -50, employee_morale: -50 },
      kpi: { CFO: +30, CMO: +30, COO: +30, CHRO: +30, CLO: +30 },
    },
    optionB: {
      label: 'ปฏิเสธการขาย และสู้ต่อ',
      description:
        'ปฏิเสธดีล ประกาศลดเงินเดือนตัวเอง 30% เพื่อประคองบริษัท ' +
        'สร้างความเชื่อใจจากพนักงานและพิสูจน์ภาวะผู้นำ แต่เส้นทางข้างหน้าจะไม่ง่ายเลย',
      company: { cash_flow: +20, brand_trust: +20, employee_morale: +25 },
      kpi: { CFO: -15, CMO: -15, COO: -15, CHRO: -15, CLO: -15 },
    },
  },

];

/**
 * หาตัวเลือกที่ชนะจากคะแนนโหวต
 * คืนค่า 'A' หรือ 'B' — ถ้าเท่ากันให้ A ชนะ
 */
export function getWinner(votesForA, votesForB) {
  return votesForB > votesForA ? 'B' : 'A';
}

/**
 * คำนวณและอัปเดตคะแนนหลังเปิดผล
 * คืนค่า { newPlayerScores, newCompany, playerDeltas, companyDeltas }
 */
export function applyScores(situationIndex, winningOption, currentPlayerScores, currentCompany) {
  const sit = SITUATIONS[situationIndex];
  const opt = winningOption === 'A' ? sit.optionA : sit.optionB;

  const playerDeltas = {};
  const newPlayerScores = {};
  for (const role of ROLES) {
    const delta = opt.kpi[role] ?? 0;
    playerDeltas[role] = delta;
    newPlayerScores[role] = (currentPlayerScores[role] ?? INITIAL_KPI) + delta;
  }

  const companyDeltas = {
    cash_flow:       opt.company.cash_flow ?? 0,
    brand_trust:     opt.company.brand_trust ?? 0,
    employee_morale: opt.company.employee_morale ?? 0,
  };
  const newCompany = {
    cash_flow:       (currentCompany.cash_flow ?? 50)       + companyDeltas.cash_flow,
    brand_trust:     (currentCompany.brand_trust ?? 50)     + companyDeltas.brand_trust,
    employee_morale: (currentCompany.employee_morale ?? 50) + companyDeltas.employee_morale,
  };

  return { newPlayerScores, newCompany, playerDeltas, companyDeltas };
}

// ── Special Cards ──────────────────────────────────────────────
export const SPECIAL_CARDS = {
  consulting_report: {
    id: 'consulting_report',
    name: 'Consulting Firm Report',
    nameTh: 'รายงานบริษัทที่ปรึกษา',
    description: 'เปิดเผยผลกระทบ KPI บริษัทของทั้งตัวเลือก A และ B ให้ทั้งกลุ่มเห็น',
    icon: '📊',
    useDuring: 'voting',
  },
  shadow_capital: {
    id: 'shadow_capital',
    name: 'Shadow Capital Injection',
    nameTh: 'ฉีดทุนลับ',
    description: 'ป้องกันไม่ให้ KPI บริษัททุกตัวต่ำกว่า 0 ในรอบนี้',
    icon: '💰',
    useDuring: 'voting',
  },
  global_pr: {
    id: 'global_pr',
    name: 'Global PR Blitz',
    nameTh: 'แคมเปญ PR ระดับโลก',
    description: 'เลือก KPI บริษัท 1 ตัว แล้วเพิ่ม +20 ทันที',
    icon: '📢',
    useDuring: 'anytime',
    requiresTarget: 'company_kpi',
  },
  employee_shield: {
    id: 'employee_shield',
    name: 'Employee Shield Policy',
    nameTh: 'นโยบายคุ้มครองพนักงาน',
    description: 'ป้องกันผู้เล่น 1 คนจากการถูกไล่ออก (KPI จะไม่ต่ำกว่า 0)',
    icon: '🛡️',
    useDuring: 'anytime',
    requiresTarget: 'player',
  },
};

export const ALL_CARD_IDS = Object.keys(SPECIAL_CARDS);
export const MAX_CARDS_PER_GROUP = 2;

/** แสดงค่าเปลี่ยนแปลงเช่น "+15" หรือ "-10" */
export function fmtDelta(n) {
  return n > 0 ? `+${n}` : `${n}`;
}
