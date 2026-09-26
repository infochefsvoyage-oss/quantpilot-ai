// QuantPilot — A+/QUALIFIED_MANUAL Gate v0.2.0 (Modular, fail-closed)
// Ergänzt die bestehende VALIDATED_SETUP-Stufe um ein explizites A+-Gate.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.
//
// A+ darf ausschließlich TRUE werden, wenn GLEICHZEITIG vorliegen:
//   1. Liquidity Sweep        = bestätigt (true)
//   2. Reclaim/Rejection      = bestätigt (true)
//   3. Volume Confirmation    = bestätigt (true)
//   4. M5 MSS/CHoCH/BOS       = bestätigt (nicht NONE)
//   5. M1 MSS/CHoCH/BOS       = bestätigt (nicht NONE)
//   6. Setup-Qualität        >= 75%
//   7. CRV                   >= 2.5
//   8. Daten frisch           = true (stale → fail-closed)
//   9. Quelle bestätigt       = true (unconfirmed → fail-closed)
//
// Fehlendes oder stale/unbestätigtes Pflichtfeld → A+ = false (fail-closed).
// TRIGGER_NEAR: kompakte Vorwarnung, aber keine Order Card freigegeben.

export interface APlusGateInput {
  liquidity_sweep: boolean;
  reclaim_rejection: boolean;
  volume_confirmation: boolean;
  m5_mss_bos: boolean;        // M5 Structure Shift/MSS-CHoCH-BOS bestätigt
  m1_mss_bos: boolean;        // M1 Structure Shift/MSS-CHoCH-BOS bestätigt
  setup_quality: number;      // 0-100 (ASCAN/ICT Score)
  crv: number;                // Reward/Risk
  data_fresh: boolean;
  source_confirmed: boolean;
}

export interface APlusGateResult {
  a_plus: boolean;
  qualified_manual: boolean;   // synonym für a_plus (explizite Benennung)
  trigger_near: boolean;       // Vorwarnung, keine Card freigegeben
  fail_closed_reason: string | null;
  checks: {
    liquidity_sweep: boolean;
    reclaim_rejection: boolean;
    volume_confirmation: boolean;
    m5_mss_bos: boolean;
    m1_mss_bos: boolean;
    setup_quality_min_75: boolean;
    crv_min_2_5: boolean;
    data_fresh: boolean;
    source_confirmed: boolean;
  };
  mandatory_passed: number;
  mandatory_total: number;
}

const MANDATORY_KEYS: (keyof APlusGateResult['checks'])[] = [
  'liquidity_sweep', 'reclaim_rejection', 'volume_confirmation',
  'm5_mss_bos', 'm1_mss_bos', 'setup_quality_min_75', 'crv_min_2_5',
  'data_fresh', 'source_confirmed',
];

export function evaluateAPlusGate(input: APlusGateInput): APlusGateResult {
  const checks = {
    liquidity_sweep: input.liquidity_sweep === true,
    reclaim_rejection: input.reclaim_rejection === true,
    volume_confirmation: input.volume_confirmation === true,
    m5_mss_bos: input.m5_mss_bos === true,
    m1_mss_bos: input.m1_mss_bos === true,
    setup_quality_min_75: Number(input.setup_quality) >= 75,
    crv_min_2_5: Number(input.crv) >= 2.5,
    data_fresh: input.data_fresh === true,
    source_confirmed: input.source_confirmed === true,
  };

  const mandatoryPassed = MANDATORY_KEYS.filter((k) => checks[k]).length;
  const mandatoryTotal = MANDATORY_KEYS.length;
  const allPass = mandatoryPassed === mandatoryTotal;

  // Fail-closed: jedes fehlende/stale/unbestätigte Pflichtfeld blockiert A+.
  const failed = MANDATORY_KEYS.filter((k) => !checks[k]);
  const failClosedReason = allPass ? null : `FAIL_CLOSED: ${failed.join(', ')}`;

  // TRIGGER_NEAR: mindestens 7/9 Pflichtfelder + Score >= 70 + CRV >= 2.2
  // → kompakte Vorwarnung, aber KEINE Order Card freigegeben.
  const triggerNear = !allPass
    && mandatoryPassed >= 7
    && Number(input.setup_quality) >= 70
    && Number(input.crv) >= 2.2
    && input.data_fresh === true
    && input.source_confirmed === true;

  return {
    a_plus: allPass,
    qualified_manual: allPass,
    trigger_near: triggerNear,
    fail_closed_reason: failClosedReason,
    checks,
    mandatory_passed: mandatoryPassed,
    mandatory_total: mandatoryTotal,
  };
}

// Hilfsfunktion: Mappt ein Live-Sniper-Signal auf das A+-Gate-Input.
// M5-Structure-Shift wird aus HTF-Alignment + bestätigtem MSS/BOS abgeleitet
// (HTF-Kontext muss aligniert sein UND ein Structure Shift muss vorliegen).
// M1-Structure-Shift aus dem Entry-Timeframe MSS/BOS des Signals.
export function mapSignalToAPlusInput(signal: any): APlusGateInput {
  const mssBos = signal?.ict?.mss_bos || signal?.mss_bos || 'NONE';
  const mssConfirmed = mssBos !== 'NONE' && !!mssBos;
  const htfAligned = signal?.gate_htf_alignment === true || signal?.htf_bias === signal?.side;
  return {
    liquidity_sweep: signal?.gate_liquidity_sweep === true,
    reclaim_rejection: signal?.gate_reclaim_rejection === true,
    volume_confirmation: signal?.gate_volume_confirmation === true,
    m5_mss_bos: htfAligned && mssConfirmed,
    m1_mss_bos: mssConfirmed,
    setup_quality: Number(signal?.ascan_score || signal?.ict_score || 0),
    crv: Number(signal?.rr || signal?.crv || 0),
    data_fresh: signal?.data_fresh === true,
    source_confirmed: signal?.source_confirmed === true,
  };
}