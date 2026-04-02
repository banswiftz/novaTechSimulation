// ============================================================
// NovaTech Simulation — Game Data & Engine
// Flow: S1 → S2 → P1 → S3 → P2 → S4
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

// Ordered step IDs — this defines the game flow
export const STEPS = ['S1', 'S2', 'P1', 'S3', 'P2', 'S4'];

export const STEP_DATA = {
  // ── S1 ─────────────────────────────────────────────────
  S1: {
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
      deltas: { cash: 10, brand: -10, morale: -10, cfo: 15, cmo: -20, coo: 0, chro: -10, clo: 5 },
    },
    optionB: {
      label: 'ทุ่มหมดหน้าตัก จัดแคมเปญใหญ่',
      description:
        'ใช้เงินก้อนสุดท้ายของบริษัทจัด Big Campaign ครั้งใหญ่ ' +
        'อัดโปรโมชั่นการตลาดและความร่วมมือกับพาร์ตเนอร์ให้หนักที่สุด ' +
        'เพื่อดึงผู้ใช้กลับมาในระยะเวลาอันสั้น นี่คือการเดิมพันแบบ All-in',
      deltas: { cash: -20, brand: 20, morale: 5, cfo: -20, cmo: 20, coo: -5, chro: 5, clo: -10 },
    },
  },

  // ── S2 ─────────────────────────────────────────────────
  S2: {
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
      deltas: { cash: -15, brand: -5, morale: 20, cfo: -15, cmo: -5, coo: -20, chro: 20, clo: -15 },
    },
    optionB: {
      label: 'รีบก้าวสู่ระบบใหม่ ปลดพนักงาน 15%',
      description:
        'ลงทุนในระบบ Cloud Automation ใหม่ทันที ลด Downtime และเพิ่มประสิทธิภาพระยะยาว ' +
        'แต่ต้องปลดพนักงานราว 15% ซึ่งอาจทำลายความเชื่อใจในองค์กร',
      deltas: { cash: -20, brand: 15, morale: -25, cfo: -15, cmo: 10, coo: 25, chro: -25, clo: 10 },
    },
  },

  // ── P1 (Pop-up Event 1) ────────────────────────────────
  P1: {
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
      deltas: { cash: 20, brand: 10, morale: -20, cfo: 15, cmo: 20, coo: -20, chro: -20, clo: -5 },
    },
    optionB: {
      label: 'จำกัดออเดอร์ ประกาศ Sold Out ชั่วคราว',
      description:
        'จำกัดจำนวนออเดอร์เท่าที่ระบบรับได้ เพื่อรักษาคุณภาพบริการ ' +
        'และไม่ให้พนักงานทำงานเกินกำลัง แม้จะเสียรายได้บางส่วน',
      deltas: { cash: 5, brand: 20, morale: 10, cfo: -10, cmo: -15, coo: 15, chro: 15, clo: 10 },
    },
  },

  // ── S3 ─────────────────────────────────────────────────
  S3: {
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
      deltas: { cash: 0, brand: -30, morale: -10, cfo: 10, cmo: -25, coo: -15, chro: -10, clo: -30 },
    },
    optionB: {
      label: 'แถลงการณ์ยอมรับและจ่ายชดเชยลูกค้า',
      description:
        'ออกแถลงการณ์อย่างโปร่งใส ยอมรับว่าการรั่วไหลเกิดจากทั้ง Vendor และการตัดสินใจภายใน ' +
        'พร้อมประกาศมาตรการเยียวยาลูกค้าที่ได้รับผลกระทบ และปฏิบัติตามหลัก PDPA อย่างเคร่งครัด',
      deltas: { cash: -25, brand: 15, morale: 10, cfo: -25, cmo: 15, coo: 0, chro: 10, clo: 15 },
    },
  },

  // ── P2 (Pop-up Event 2) ────────────────────────────────
  P2: {
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
      deltas: { cash: 0, brand: 25, morale: 0, cfo: 5, cmo: 30, coo: -10, chro: -10, clo: -10 },
    },
    optionB: {
      label: 'ทุ่มงบรื้อระบบหลังบ้าน และสวัสดิการ',
      description:
        'นำเงินทั้งหมดไปยกระดับระบบภายใน อัปเกรดโครงสร้าง IT ' +
        'จ้างที่ปรึกษากฎหมายมาวางระบบ Compliance ใหม่ และปรับปรุงสวัสดิการพนักงาน',
      deltas: { cash: 0, brand: 5, morale: 25, cfo: -10, cmo: -20, coo: 20, chro: 20, clo: 20 },
    },
  },

  // ── S4 ─────────────────────────────────────────────────
  S4: {
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
      deltas: { cash: 0, brand: -50, morale: -50, cfo: 30, cmo: 30, coo: 30, chro: 30, clo: 30 },
    },
    optionB: {
      label: 'ปฏิเสธการขาย และสู้ต่อ',
      description:
        'ปฏิเสธดีล ประกาศลดเงินเดือนตัวเอง 30% เพื่อประคองบริษัท ' +
        'สร้างความเชื่อใจจากพนักงานและพิสูจน์ภาวะผู้นำ แต่เส้นทางข้างหน้าจะไม่ง่ายเลย',
      deltas: { cash: 20, brand: 20, morale: 25, cfo: -15, cmo: -15, coo: -15, chro: -15, clo: -15 },
    },
  },
};

// KPI field names matching the DB columns
export const KPI_FIELDS = ['cash', 'brand', 'morale', 'cfo', 'cmo', 'coo', 'chro', 'clo'];
export const COMPANY_FIELDS = ['cash', 'brand', 'morale'];
export const ROLE_FIELDS = ['cfo', 'cmo', 'coo', 'chro', 'clo'];

export const KPI_LABELS = {
  cash: 'กระแสเงินสด',
  brand: 'ความเชื่อมั่นแบรนด์',
  morale: 'ขวัญกำลังใจ',
  cfo: 'CFO',
  cmo: 'CMO',
  coo: 'COO',
  chro: 'CHRO',
  clo: 'CLO',
};

/**
 * Apply a choice to the current state and return new KPI values.
 * Does NOT mutate the input.
 */
export function applyChoice(state, stepId, choice) {
  const step = STEP_DATA[stepId];
  if (!step) return null;
  const opt = choice === 'A' ? step.optionA : step.optionB;
  const result = {};
  for (const field of KPI_FIELDS) {
    result[field] = (state[field] ?? 50) + (opt.deltas[field] ?? 0);
  }
  return result;
}

/**
 * Get the next step ID, or 'ended' if at the last step.
 */
export function getNextStep(currentStep) {
  const idx = STEPS.indexOf(currentStep);
  if (idx === -1 || idx >= STEPS.length - 1) return 'ended';
  return STEPS[idx + 1];
}

/**
 * Get step label for display.
 */
export function getStepLabel(stepId) {
  const step = STEP_DATA[stepId];
  if (!step) return stepId;
  return step.type === 'popup'
    ? `เหตุการณ์พิเศษ ${step.number}`
    : `สถานการณ์ ${step.number}`;
}

/** Format delta: "+15" or "-10" */
export function fmtDelta(n) {
  return n > 0 ? `+${n}` : `${n}`;
}
