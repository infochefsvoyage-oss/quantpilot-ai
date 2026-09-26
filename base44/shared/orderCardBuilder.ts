// QuantPilot — Order/Execution Card Builder v0.2.0 (Modular)
// Erzeugt eine Order Card aus einem A+-bestätigten Signal.
// Vertraulich: Kernlogik ist geschützte IP von QuantPilot AI.
//
// Lot-Größe NUR wenn aktuelle sichere Account- und Brokerspezifikationen
// vorhanden sind — sonst "Lot nach Screenshot/Accountdaten berechnen".
// AUTO_EXECUTION und order_send bleiben strikt OFF/BLOCKED.

export interface OrderCard {
  instrument: string;
  direction: 'LONG' | 'SHORT';
  entry: number | null;
  entry_zone: { low: number | null; high: number | null };
  stop_loss: number | null;
  take_profits: {
    tp1: number | null;
    tp2: number | null;
    tp3: number | null;
    final_tp: number | null;
  };
  expected_rr: number;
  lot_size: number | string;       // number wenn Specs verfügbar, sonst String-Platzhalter
  lot_size_note: string;           // Hinweis wenn Specs fehlen
  estimated_risk_eur: number | null;
  potential_profit_eur: number | null;
  manual_entry_note: string;       // "manuelle Eingabe per Screenshot"
  account_specs_available: boolean;
  card_status: 'QUALIFIED_MANUAL' | 'TRIGGER_NEAR' | 'BLOCKED';
  auto_execution: 'OFF';
  order_send: 'BLOCKED';
}

export interface AccountSpecs {
  balance: number | null;
  equity: number | null;
  contract_size: number | null;   // z.B. 100 für XAUUSD
  volume_min: number | null;
  volume_max: number | null;
  volume_step: number | null;
  tick_value: number | null;
  tick_size: number | null;
  currency: string | null;
}

function n(v: any, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function stepDecimals(step: number): number {
  const s = String(step);
  if (s.includes('e-')) return Math.min(12, Number(s.split('e-')[1]) || 0);
  return Math.min(12, (s.split('.')[1] || '').length);
}

export function buildOrderCard(
  signal: any,
  gateResult: any,
  accountSpecs: AccountSpecs | null
): OrderCard {
  const entry = n(signal?.entry_price);
  const sl = n(signal?.stop_loss);
  const tp1 = n(signal?.take_profit_1 || signal?.tp1);
  const tp2 = n(signal?.take_profit_2 || signal?.tp2);
  const tp3 = n(signal?.take_profit_3 || signal?.tp3);
  const rr = n(signal?.rr || signal?.crv);
  const side = (signal?.side || 'LONG').toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG';

  // Lot-Sizing nur bei vollständigen, sicheren Specs
  const specsOk = accountSpecs
    && accountSpecs.balance != null && accountSpecs.balance > 0
    && accountSpecs.contract_size != null && accountSpecs.contract_size > 0
    && accountSpecs.volume_step != null && accountSpecs.volume_step > 0;

  let lotSize: number | string = 0;
  let lotSizeNote = '';
  let estimatedRiskEur: number | null = null;
  let potentialProfitEur: number | null = null;

  if (specsOk && entry > 0 && sl > 0) {
    const slDist = Math.abs(entry - sl);
    const riskPct = 0.5 / 100; // RiskSettings default 0.5%
    const riskAmount = (accountSpecs!.balance || 0) * riskPct;
    const rawSize = slDist > 0 ? riskAmount / (slDist * (accountSpecs!.contract_size || 1)) : 0;
    const volStep = accountSpecs!.volume_step!;
    const volMin = accountSpecs!.volume_min ?? volStep;
    const volMax = accountSpecs!.volume_max ?? 100;
    const decimals = stepDecimals(volStep);
    if (rawSize >= volMin) {
      lotSize = Math.floor(rawSize / volStep + 1e-9) * volStep;
      lotSize = Number(lotSize.toFixed(decimals));
      lotSize = Math.min(volMax, lotSize);
    } else {
      lotSize = volMin;
    }
    // Risiko & Gewinn in EUR (Account-Währung; vereinfacht EUR-Annahme)
    estimatedRiskEur = Math.abs(entry - sl) * (lotSize as number) * (accountSpecs!.contract_size || 1);
    const finalTp = tp3 > 0 ? tp3 : (tp2 > 0 ? tp2 : tp1);
    if (finalTp > 0) {
      potentialProfitEur = Math.abs(finalTp - entry) * (lotSize as number) * (accountSpecs!.contract_size || 1);
    }
  } else {
    lotSize = 'Lot nach Screenshot/Accountdaten berechnen';
    lotSizeNote = 'Account-/Brokerspezifikationen nicht vollständig verfügbar — manuelle Lot-Berechnung erforderlich.';
  }

  const cardStatus: OrderCard['card_status'] = gateResult?.a_plus
    ? 'QUALIFIED_MANUAL'
    : gateResult?.trigger_near
      ? 'TRIGGER_NEAR'
      : 'BLOCKED';

  return {
    instrument: signal?.symbol || '—',
    direction: side,
    entry: entry > 0 ? entry : null,
    entry_zone: { low: entry > 0 ? entry : null, high: entry > 0 ? entry : null },
    stop_loss: sl > 0 ? sl : null,
    take_profits: {
      tp1: tp1 > 0 ? tp1 : null,
      tp2: tp2 > 0 ? tp2 : null,
      tp3: tp3 > 0 ? tp3 : null,
      final_tp: (tp3 || tp2 || tp1) > 0 ? (tp3 || tp2 || tp1) : null,
    },
    expected_rr: rr,
    lot_size: lotSize,
    lot_size_note: lotSizeNote,
    estimated_risk_eur: estimatedRiskEur,
    potential_profit_eur: potentialProfitEur,
    manual_entry_note: 'manuelle Eingabe per Screenshot',
    account_specs_available: !!specsOk,
    card_status: cardStatus,
    auto_execution: 'OFF',
    order_send: 'BLOCKED',
  };
}

// Konstruiert ein synthetisches A+-Signal für den Dry-Test.
// Alle Gates bestätigt, bekannte XAUUSD-Werte, keine echte Order.
export function buildSyntheticAPlusSignal(): any {
  return {
    symbol: 'XAUUSD',
    side: 'LONG',
    entry_price: 2650.00,
    stop_loss: 2647.50,
    take_profit_1: 2655.00,
    take_profit_2: 2658.00,
    take_profit_3: 2662.50,
    rr: 3.0,
    ascan_score: 82,
    gate_liquidity_sweep: true,
    gate_reclaim_rejection: true,
    gate_volume_confirmation: true,
    gate_htf_alignment: true,
    data_fresh: true,
    source_confirmed: true,
    ict: { mss_bos: 'MSS', mss_direction: 'BULLISH', displacement: true, fvg_detected: true },
    _synthetic: true,
  };
}