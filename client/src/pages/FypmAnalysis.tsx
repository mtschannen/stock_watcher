import { useState, useRef, useEffect } from "react";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  getFypmBacktest,
  FypmAnalysisResult,
  FypmDataPoint,
  FypmCorrelationStats,
  FypmQuartileStats,
  FypmZScoreBucket,
  FypmTickerStickinessStats,
  FypmStickinessResult,
} from "../api/client";

// ── Variant types & metadata ────────────────────────────────────────────────

type Variant = "linear" | "derivative" | "rate" | "composite" | "cagr" | "exponential" | "recency_weighted" | "conservative";

const VARIANT_LABELS: Record<Variant, string> = {
  linear:           "Linear",
  derivative:       "Derivative",
  rate:             "Rate",
  composite:        "Composite",
  cagr:             "CAGR",
  exponential:      "Exponential",
  recency_weighted: "Recency-Wtd",
  conservative:     "Conservative",
};

const VARIANT_DESCRIPTIONS: Record<Variant, string> = {
  linear:           "Projects book value using a linear extrapolation of the 5-year level trend",
  derivative:       "Projects book value growth using the rate of change between annual periods",
  rate:             "Projects book value using the slope of the growth trend",
  composite:        "Average of Linear, Derivative, Rate, CAGR, Exponential, and Recency-Weighted variants",
  cagr:             "Compound annual growth rate projection — assumes historical % growth continues exponentially",
  exponential:      "Log-linear regression on BVPS — more appropriate for multiplicative growth patterns",
  recency_weighted: "Weights recent years 5× more than oldest — emphasizes current trajectory over full history",
  conservative:     "Uses the minimum of Linear, CAGR, and Recency-Weighted projections (when available) — margin-of-safety estimate",
};

type FypmVariantKey = keyof Pick<FypmDataPoint, "fypm_linear" | "fypm_derivative" | "fypm_rate" | "fypm_composite" | "fypm_cagr" | "fypm_exponential" | "fypm_recency_weighted" | "fypm_conservative">;

const VARIANT_FYPM_KEY: Record<Variant, FypmVariantKey> = {
  linear:           "fypm_linear",
  derivative:       "fypm_derivative",
  rate:             "fypm_rate",
  composite:        "fypm_composite",
  cagr:             "fypm_cagr",
  exponential:      "fypm_exponential",
  recency_weighted: "fypm_recency_weighted",
  conservative:     "fypm_conservative",
};

const VARIANT_ORDER: Variant[] = [
  "linear", "derivative", "rate", "cagr", "exponential", "recency_weighted", "conservative", "composite",
];

// ── Linear regression helper ────────────────────────────────────────────────

function linReg(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const { x, y } of points) {
    sumX  += x;
    sumY  += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ── Colour helpers ──────────────────────────────────────────────────────────

function rColour(r: number): string {
  if (r > 0.3)  return "#22c55e";  // green
  if (r > 0.1)  return "#f59e0b";  // amber
  if (r >= 0)   return "#6b7280";  // gray
  return "#ef4444";                 // red
}

function returnColour(v: number | null): string {
  if (v === null) return "inherit";
  return v >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
}

function fmt(v: number | null, digits = 2): string {
  if (v === null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CorrelationCard({
  label,
  stats,
  active,
}: {
  label: string;
  stats: FypmCorrelationStats;
  active?: boolean;
}) {
  const rows: { horizon: string; r: number; r2: number; n: number }[] = [
    { horizon: "30d",  r: stats.r30d,  r2: stats.r2_30d,  n: stats.n30d  },
    { horizon: "90d",  r: stats.r90d,  r2: stats.r2_90d,  n: stats.n90d  },
    { horizon: "180d", r: stats.r180d, r2: stats.r2_180d, n: stats.n180d },
  ];
  return (
    <div style={{
      background: active ? "rgba(59,130,246,0.08)" : "var(--bg-surface)",
      border: active ? "1px solid var(--accent)" : "1px solid var(--border-solid)",
      borderRadius: 8,
      padding: "16px 20px",
      flex: "1 1 200px",
      minWidth: 200,
      transition: "border-color 0.15s, background 0.15s",
    }}>
      <div style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? "var(--accent)" : "var(--text-primary)", marginBottom: 12 }}>
        {label}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "var(--text-muted)" }}>
            <th style={{ textAlign: "left", paddingBottom: 6, fontWeight: 500 }}>Horizon</th>
            <th style={{ textAlign: "right", paddingBottom: 6, fontWeight: 500 }}>r</th>
            <th style={{ textAlign: "right", paddingBottom: 6, fontWeight: 500 }}>R²</th>
            <th style={{ textAlign: "right", paddingBottom: 6, fontWeight: 500 }}>N</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ horizon, r, r2, n }) => (
            <tr key={horizon}>
              <td style={{ padding: "3px 0", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{horizon}</td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: rColour(r) }}>
                {r.toFixed(3)}
              </td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                {r2.toFixed(3)}
              </td>
              <td style={{ textAlign: "right", color: "var(--text-muted)" }}>{n.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScatterPlot({
  title,
  horizon,
  variantLabel,
  dataPoints,
  fypmKey,
  returnKey,
}: {
  title: string;
  horizon: string;
  variantLabel: string;
  dataPoints: FypmDataPoint[];
  fypmKey: FypmVariantKey;
  returnKey: keyof Pick<FypmDataPoint, "return_30d" | "return_90d" | "return_180d">;
}) {
  const validPoints = dataPoints
    .filter(p => p[returnKey] !== null && p[fypmKey] !== null)
    .map(p => ({ x: p[fypmKey] as number, y: p[returnKey] as number }));

  // Subsample for rendering performance (max 1000 points)
  const step = Math.max(1, Math.floor(validPoints.length / 1000));
  const plotPoints = validPoints.filter((_, i) => i % step === 0);

  const reg = linReg(plotPoints);
  let trendData: { x: number; trend: number }[] = [];
  if (reg && plotPoints.length > 1) {
    const xs = plotPoints.map(p => p.x);
    const xMin = xs.reduce((m, v) => v < m ? v : m, Infinity);
    const xMax = xs.reduce((m, v) => v > m ? v : m, -Infinity);
    trendData = [
      { x: xMin, trend: reg.slope * xMin + reg.intercept },
      { x: xMax, trend: reg.slope * xMax + reg.intercept },
    ];
  }

  const yVals = plotPoints.map(p => p.y);
  const yMin = yVals.length > 0 ? yVals.reduce((m, v) => v < m ? v : m, Infinity) : -50;
  const yMax = yVals.length > 0 ? yVals.reduce((m, v) => v > m ? v : m, -Infinity) : 50;

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border-solid)",
      borderRadius: 8,
      padding: "16px 20px",
      flex: "1 1 300px",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {variantLabel} FYPM vs {horizon} return  ·  {plotPoints.length.toLocaleString()} points
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-solid)" />
          <XAxis
            dataKey="x"
            type="number"
            name="FYPM"
            domain={["auto", "auto"]}
            tickFormatter={v => v.toFixed(1)}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            label={{ value: "FYPM", position: "insideBottom", offset: -4, fontSize: 10, fill: "var(--text-muted)" }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="Return %"
            tickFormatter={v => `${v.toFixed(0)}%`}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            domain={[Math.max(yMin - 5, -100), Math.min(yMax + 5, 200)]}
          />
          <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              return (
                <div style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-solid)",
                  padding: "6px 10px",
                  fontSize: 11,
                  borderRadius: 4,
                }}>
                  <div>FYPM: {d.x?.toFixed(2)}</div>
                  <div>Return: {d.y?.toFixed(2)}%</div>
                </div>
              );
            }}
          />
          <Scatter
            name="Data points"
            data={plotPoints}
            fill="rgba(59,130,246,0.35)"
            r={2}
            line={false}
          />
          {trendData.length === 2 && (
            <Line
              data={trendData}
              type="linear"
              dataKey="trend"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              legendType="none"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function QuartileTable({
  quartileGroup,
}: {
  quartileGroup: {
    q1: FypmQuartileStats;
    q2: FypmQuartileStats;
    q3: FypmQuartileStats;
    q4: FypmQuartileStats;
  };
}) {
  const rows = [
    { label: "Q1 (Lowest)",  data: quartileGroup.q1 },
    { label: "Q2",           data: quartileGroup.q2 },
    { label: "Q3",           data: quartileGroup.q3 },
    { label: "Q4 (Highest)", data: quartileGroup.q4 },
  ];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-solid)" }}>
            {["Quartile", "FYPM Range", "Avg 30d Return", "Avg 90d Return", "Avg 180d Return", "Count"].map(h => (
              <th key={h} style={{
                textAlign: h === "Quartile" || h === "FYPM Range" ? "left" : "right",
                padding: "8px 12px",
                color: "var(--text-muted)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, data }) => (
            <tr key={label} style={{ borderBottom: "1px solid var(--border-solid)" }}>
              <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{label}</td>
              <td style={{ padding: "10px 12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontSize: 11 }}>
                {data.fypmRange[0].toFixed(2)} – {data.fypmRange[1].toFixed(2)}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", background: returnColour(data.avg30d) }}>
                {fmt(data.avg30d)}%
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", background: returnColour(data.avg90d) }}>
                {fmt(data.avg90d)}%
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", background: returnColour(data.avg180d) }}>
                {fmt(data.avg180d)}%
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                {data.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stickiness sub-components ────────────────────────────────────────────────

function ZScoreBucketTable({ buckets }: { buckets: FypmZScoreBucket[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-solid)" }}>
            {["FYPM vs Own Mean", "Observations", "Avg 30d Return", "Avg 90d Return", "Avg 180d Return"].map(h => (
              <th key={h} style={{
                textAlign: h === "FYPM vs Own Mean" ? "left" : "right",
                padding: "8px 12px",
                color: "var(--text-muted)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map(b => (
            <tr key={b.label} style={{ borderBottom: "1px solid var(--border-solid)" }}>
              <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 500 }}>
                {b.label}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-muted)" }}>
                {b.count.toLocaleString()}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", background: returnColour(b.avg30d) }}>
                {fmt(b.avg30d)}%
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", background: returnColour(b.avg90d) }}>
                {fmt(b.avg90d)}%
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", background: returnColour(b.avg180d) }}>
                {fmt(b.avg180d)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CVTable({
  tickers,
  label,
}: {
  tickers: FypmTickerStickinessStats[];
  label: string;
}) {
  return (
    <div style={{ flex: "1 1 300px", minWidth: 280 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>{label}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-solid)" }}>
            {["Ticker", "Mean FYPM", "Std Dev", "CV"].map(h => (
              <th key={h} style={{
                textAlign: h === "Ticker" ? "left" : "right",
                padding: "6px 8px",
                color: "var(--text-muted)",
                fontWeight: 500,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map(t => (
            <tr key={t.ticker} style={{ borderBottom: "1px solid var(--border-solid)" }}>
              <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>
                {t.ticker}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                {t.mean.toFixed(2)}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                {t.std.toFixed(3)}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--font-mono)", color: t.cv < 0.15 ? "var(--green,#22c55e)" : t.cv > 0.4 ? "#ef4444" : "var(--text-secondary)" }}>
                {(t.cv * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function interpretStickiness(stickiness: FypmStickinessResult): string {
  const buckets = stickiness.zScoreBuckets;
  const veryLow  = buckets[0];
  const veryHigh = buckets[5];

  const meanReversionEvidence =
    veryLow.avg180d !== null && veryHigh.avg180d !== null &&
    veryLow.avg180d > 0 && veryHigh.avg180d < 0;

  const cv = stickiness.medianCV;
  const cvStr = (cv * 100).toFixed(1);

  let base = `Median coefficient of variation across tickers: ${cvStr}%. `;
  base += cv < 0.2
    ? "FYPM is generally sticky — most stocks maintain a relatively narrow FYPM range over time. "
    : cv < 0.4
    ? "FYPM shows moderate variability — stocks drift meaningfully from their typical range but don't swing wildly. "
    : "FYPM shows high variability — stocks frequently move far from their typical range, suggesting FYPM is sensitive to price swings. ";

  if (meanReversionEvidence) {
    base += `Mean reversion signal detected: when a stock's FYPM is very low relative to its own history (< −2σ), the 180-day avg return was ${fmt(veryLow.avg180d)}%, while very high FYPM (> +2σ) preceded avg returns of ${fmt(veryHigh.avg180d)}%. This pattern is consistent with price reverting toward a mean FYPM level.`;
  } else {
    base += "No strong mean-reversion pattern detected in this dataset — FYPM deviations from a stock's own mean did not clearly predict subsequent price reversals.";
  }

  return base;
}

function interpretR(r30: number, r90: number, r180: number): string {
  const best = Math.max(Math.abs(r30), Math.abs(r90), Math.abs(r180));
  const sign = (r30 + r90 + r180) / 3 >= 0 ? "positive" : "negative";

  if (best >= 0.3 && sign === "positive") {
    return `Strong positive correlation detected (r up to ${best.toFixed(3)}). FYPM appears to be a meaningful predictor of future returns — stocks with higher FYPM scores tended to deliver meaningfully better returns across all horizons. This supports the FYPM hypothesis.`;
  }
  if (best >= 0.15 && sign === "positive") {
    return `Moderate positive correlation detected (r up to ${best.toFixed(3)}). Higher FYPM scores are associated with modestly better returns. The relationship is real but not strong enough to use in isolation as a trading signal.`;
  }
  if (best >= 0.05 && sign === "positive") {
    return `Weak positive correlation detected (r up to ${best.toFixed(3)}). There is a slight tendency for higher FYPM stocks to outperform, but the relationship is noisy and may not be statistically significant with the current dataset size.`;
  }
  if (sign === "negative") {
    return `Negative correlation detected (r as low as ${Math.min(r30, r90, r180).toFixed(3)}). Contrary to the FYPM hypothesis, higher FYPM scores were associated with lower subsequent returns in this dataset. This could indicate mean reversion, data quality issues, or a regime-specific effect.`;
  }
  return `Near-zero correlation detected (r up to ${best.toFixed(3)}). FYPM does not appear to have meaningful predictive power over the measured time horizon and universe. The data is consistent with FYPM being a valuation metric rather than a near-term return predictor.`;
}

// ── Variant selector ────────────────────────────────────────────────────────

function VariantSelector({
  value,
  onChange,
}: {
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Variant:</label>
      {VARIANT_ORDER.map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: "5px 13px",
            borderRadius: 20,
            border: "1px solid",
            borderColor: value === v ? "var(--accent)" : "var(--border-solid)",
            background: value === v ? "rgba(59,130,246,0.15)" : "transparent",
            color: value === v ? "var(--accent)" : "var(--text-secondary)",
            fontSize: 12,
            fontWeight: value === v ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {VARIANT_LABELS[v]}
        </button>
      ))}
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginLeft: 4 }}>
        {VARIANT_DESCRIPTIONS[value]}
      </span>
    </div>
  );
}

// ── Main page component ─────────────────────────────────────────────────────

export default function FypmAnalysis() {
  const [result, setResult]   = useState<FypmAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [months, setMonths]   = useState(24);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [variant, setVariant] = useState<Variant>("linear");
  const abortControllerRef    = useRef<AbortController | null>(null);

  // Cancel any in-flight request when the component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function runAnalysis() {
    // Cancel any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(null);
    const t0 = Date.now();
    try {
      const res = await getFypmBacktest(months, "all", controller.signal);
      if (!controller.signal.aborted) {
        setResult(res.data);
        setElapsed(Math.round((Date.now() - t0) / 1000));
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? String(err);
      setError(msg);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const activeCorr = result?.correlations[variant];
  const fypmKey    = VARIANT_FYPM_KEY[variant];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 0 60px" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0, marginBottom: 6 }}>
          FYPM Predictive Analysis
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, maxWidth: 720 }}>
          <strong>FYPM</strong> (Five-Year Performance Multiple) measures expected stock returns vs. risk-free returns:
          <br />
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
            (5yr projected book value yield + 5yr dividend yield) / 5yr risk-free return
          </code>
          <br />
          <strong>Hypothesis:</strong> stocks with higher FYPM today should deliver superior returns
          over the next 30–180 days. This tool backtests that hypothesis across the cached S&amp;P 500 universe.
        </p>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Lookback period:</label>
          {[12, 18, 24, 36].map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              style={{
                padding: "5px 11px",
                borderRadius: 5,
                border: "1px solid",
                borderColor: months === m ? "var(--accent)" : "var(--border-solid)",
                background: months === m ? "rgba(59,130,246,0.15)" : "transparent",
                color: months === m ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              {m}mo
            </button>
          ))}
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "1px solid var(--accent)",
            background: loading ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.2)",
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {loading && (
            <span style={{
              display: "inline-block",
              width: 12,
              height: 12,
              border: "2px solid var(--accent)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
          )}
          {loading ? "Running analysis…" : "Run Analysis"}
        </button>

        {loading && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Fetching price histories for all tickers — may take 2–5 minutes…
          </span>
        )}
        {elapsed !== null && !loading && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Completed in {elapsed}s
          </span>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 6,
          padding: "12px 16px",
          color: "#ef4444",
          fontSize: 13,
          marginBottom: 24,
        }}>
          Error: {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <>
          {/* Look-ahead bias warning */}
          <div style={{
            background: "rgba(234,179,8,0.12)",
            border: "1px solid rgba(234,179,8,0.5)",
            borderRadius: 6,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
              <strong>Look-ahead bias warning:</strong> FYPM values are computed using <em>current</em>{" "}
              book values, dividend yields, and interest rates applied to historical prices. This means
              data that was not available at those historical dates is being used, which inflates the
              apparent predictive power of FYPM. Results should be interpreted as illustrative only
              and not as a validated trading signal.
            </div>
          </div>
          {/* Meta row */}
          <div style={{
            display: "flex",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}>
            {[
              ["Tickers Analyzed", result.meta.tickersAnalyzed.toLocaleString()],
              ["Total Data Points", result.meta.totalDataPoints.toLocaleString()],
              ["Date Range", `${result.meta.dateRange.start} → ${result.meta.dateRange.end}`],
            ].map(([label, value]) => (
              <div key={label as string} style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-solid)",
                borderRadius: 6,
                padding: "10px 16px",
                fontSize: 12,
              }}>
                <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── Correlation cards ── */}
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            Pearson Correlations (FYPM → Forward Return)
          </h2>
          <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
            {VARIANT_ORDER.map(v => (
              <CorrelationCard key={v} label={`${VARIANT_LABELS[v]} FYPM`} stats={result.correlations[v]} active={variant === v} />
            ))}
          </div>

          {/* ── Variant selector ── */}
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-solid)",
            borderRadius: 8,
            padding: "14px 20px",
            marginBottom: 20,
          }}>
            <VariantSelector value={variant} onChange={setVariant} />
          </div>

          {/* ── Scatter plots ── */}
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            Scatter Plots — {VARIANT_LABELS[variant]} FYPM vs Forward Returns
          </h2>
          <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
            <ScatterPlot
              title="30-Day Return"
              horizon="30d"
              variantLabel={VARIANT_LABELS[variant]}
              dataPoints={result.sampledDataPoints}
              fypmKey={fypmKey}
              returnKey="return_30d"
            />
            <ScatterPlot
              title="90-Day Return"
              horizon="90d"
              variantLabel={VARIANT_LABELS[variant]}
              dataPoints={result.sampledDataPoints}
              fypmKey={fypmKey}
              returnKey="return_90d"
            />
            <ScatterPlot
              title="180-Day Return"
              horizon="180d"
              variantLabel={VARIANT_LABELS[variant]}
              dataPoints={result.sampledDataPoints}
              fypmKey={fypmKey}
              returnKey="return_180d"
            />
          </div>

          {/* ── Quartile table ── */}
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
            Quartile Breakdown — {VARIANT_LABELS[variant]} FYPM
          </h2>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-solid)",
            borderRadius: 8,
            marginBottom: 28,
            overflow: "hidden",
          }}>
            <QuartileTable quartileGroup={result.quartiles[variant]} />
          </div>

          {/* ── FYPM Stickiness ── */}
          <>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              FYPM Stickiness &amp; Mean Reversion
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6, maxWidth: 800 }}>
              For each stock, its <em>own</em> historical FYPM mean and standard deviation are computed. Each
              observation is then placed in a z-score bucket relative to that stock's baseline. If FYPM is "sticky"
              and mean-reverting, you would expect: observations where FYPM is very low (cheap vs. own history) to
              be followed by positive returns, and very high FYPM (expensive) to precede below-average returns.
              Z-scores use the <strong>Linear FYPM</strong> variant.
            </p>

            {/* Z-score bucket table */}
            <div style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-solid)",
              borderRadius: 8,
              marginBottom: 20,
              overflow: "hidden",
            }}>
              <ZScoreBucketTable buckets={result.stickiness.zScoreBuckets} />
            </div>

            {/* CV summary + top/bottom tickers */}
            <div style={{
              display: "flex",
              gap: 20,
              marginBottom: 20,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}>
              {/* Median CV badge */}
              <div style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-solid)",
                borderRadius: 8,
                padding: "16px 20px",
                minWidth: 200,
                flex: "0 0 auto",
              }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Median CV (all tickers)</div>
                <div style={{
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: result.stickiness.medianCV < 0.2 ? "var(--green,#22c55e)" : result.stickiness.medianCV > 0.4 ? "#ef4444" : "#f59e0b",
                }}>
                  {(result.stickiness.medianCV * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {result.stickiness.medianCV < 0.2 ? "Low — FYPM is sticky" : result.stickiness.medianCV < 0.4 ? "Moderate variability" : "High — FYPM is volatile"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                  CV = std / |mean|. Lower means the stock's FYPM stays close to its own average — a "sticky" value.
                </div>
              </div>

              {/* Most stable */}
              <div style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-solid)",
                borderRadius: 8,
                padding: "16px 20px",
                flex: "1 1 280px",
              }}>
                <CVTable tickers={result.stickiness.topSticky} label="Most Stable FYPM (lowest CV)" />
              </div>

              {/* Most variable */}
              <div style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-solid)",
                borderRadius: 8,
                padding: "16px 20px",
                flex: "1 1 280px",
              }}>
                <CVTable tickers={result.stickiness.topUnstable} label="Most Variable FYPM (highest CV)" />
              </div>
            </div>

            {/* Stickiness interpretation */}
            <div style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-solid)",
              borderRadius: 8,
              padding: "16px 20px",
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              marginBottom: 28,
            }}>
              {interpretStickiness(result.stickiness)}
            </div>
          </>

          {/* ── Interpretation ── */}
          {activeCorr && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
                Interpretation
              </h2>
              <div style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-solid)",
                borderRadius: 8,
                padding: "16px 20px",
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.7,
                marginBottom: 28,
              }}>
                <p style={{ margin: 0, marginBottom: 12 }}>
                  {interpretR(activeCorr.r30d, activeCorr.r90d, activeCorr.r180d)}
                </p>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>
                  Note: Correlation is computed using current book values and dividend yields as approximations
                  for historical dates. Past correlations may not persist. This analysis uses {result.meta.totalDataPoints.toLocaleString()} (ticker, date)
                  pairs across {result.meta.tickersAnalyzed} stocks over {months} months.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!result && !loading && !error && (
        <div style={{
          textAlign: "center",
          padding: "80px 0",
          color: "var(--text-muted)",
          fontSize: 14,
        }}>
          Click <strong>Run Analysis</strong> to backtest FYPM's predictive power across the S&amp;P 500.
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
