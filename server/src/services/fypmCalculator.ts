import { BookValueData } from "./quandl";

export interface FypmResult {
  derivative_fypm: number | "N/A";
  linear_fypm: number | "N/A";
  rate_fypm: number | "N/A";
  composite_fypm: number | "N/A";
  cagr_fypm: number | "N/A";
  exponential_fypm: number | "N/A";
  recency_weighted_fypm: number | "N/A";
  conservative_fypm: number | "N/A";
}

export function calculateFypm(
  bookValues: BookValueData,
  dividendYield: number,
  price: number,
  interestRate: number,
  _forwardEps?: number | null,
  _dividendRate?: number | null
): FypmResult {
  const na: FypmResult = {
    derivative_fypm: "N/A",
    linear_fypm: "N/A",
    rate_fypm: "N/A",
    composite_fypm: "N/A",
    cagr_fypm: "N/A",
    exponential_fypm: "N/A",
    recency_weighted_fypm: "N/A",
    conservative_fypm: "N/A",
  };

  if (
    !bookValues.data ||
    bookValues.data.length < 5 ||
    price === 0 ||
    interestRate === 0
  ) {
    return na;
  }

  const fiveYearDivYield =
    (Math.pow(dividendYield * 0.01 + 1.0, 5.0) - 1.0) * 100.0;
  const fiveYearInterestRateYield =
    100 * (Math.pow(interestRate / 100 + 1, 5) - 1);

  // Derivative FYPM values
  const v1d =
    bookValues.data[3][1] - bookValues.data[4][1];
  const v2d =
    bookValues.data[2][1] - bookValues.data[3][1];
  const v3d =
    bookValues.data[1][1] - bookValues.data[2][1];
  const v4d =
    bookValues.data[0][1] - bookValues.data[1][1];

  // Variables for derivative book value linear fit
  let sigmaX = 6.0;
  let sigmaXSquared = 14.0;
  let sigmaY = v1d + v2d + v3d + v4d;
  let sigmaXY = v2d + v3d * 2.0 + v4d * 3.0;
  let n = 4.0;

  // Derivative book value linear fit
  let a =
    (sigmaY * sigmaXSquared - sigmaX * sigmaXY) /
    (n * sigmaXSquared - sigmaX ** 2);
  let b =
    (n * sigmaXY - sigmaX * sigmaY) /
    (n * sigmaXSquared - sigmaX ** 2);
  const fiveYearBookValueAdded = (6.5 * b + a) * 5.0;
  const fiveYearBookValueYield = (fiveYearBookValueAdded / price) * 100;

  const derivativeFypm =
    (fiveYearBookValueYield + fiveYearDivYield) / fiveYearInterestRateYield;

  // Non-derivative FYPM values
  const v1 = bookValues.data[4][1];
  const v2 = bookValues.data[3][1];
  const v3 = bookValues.data[2][1];
  const v4 = bookValues.data[1][1];
  const v5 = bookValues.data[0][1];

  // Variables for non-derivative book value linear fit
  sigmaX = 10.0;
  sigmaXSquared = 30.0;
  sigmaY = v1 + v2 + v3 + v4 + v5;
  sigmaXY = v2 + v3 * 2.0 + v4 * 3.0 + v5 * 4.0;
  n = 5.0;

  // Non-derivative book value linear fit
  a =
    (sigmaY * sigmaXSquared - sigmaX * sigmaXY) /
    (n * sigmaXSquared - sigmaX ** 2);
  b =
    (n * sigmaXY - sigmaX * sigmaY) /
    (n * sigmaXSquared - sigmaX ** 2);

  const fiveYearBookValueAddedLinear = 10.0 * b + a - v5;
  const fiveYearBookValueAddedRate = 5.0 * b;
  const fiveYearBookValueYieldLinear =
    (fiveYearBookValueAddedLinear / price) * 100;
  const fiveYearBookValueYieldRate =
    (fiveYearBookValueAddedRate / price) * 100;

  const linearFypm =
    (fiveYearBookValueYieldLinear + fiveYearDivYield) /
    fiveYearInterestRateYield;
  const rateFypm =
    (fiveYearBookValueYieldRate + fiveYearDivYield) /
    fiveYearInterestRateYield;

  // ── CAGR method ──────────────────────────────────────────────────────────────
  // Use compound annual growth rate of book value (4 periods from v1 to v5)
  let cagrFypm: number | "N/A" = "N/A";
  if (v1 > 0 && v5 > 0) {
    const cagr = Math.pow(v5 / v1, 1 / 4) - 1;
    const projectedBV = v5 * Math.pow(1 + cagr, 5);
    const fiveYearBVAdded = projectedBV - v5;
    const fiveYearBVYield = (fiveYearBVAdded / price) * 100;
    cagrFypm = (fiveYearBVYield + fiveYearDivYield) / fiveYearInterestRateYield;
  }

  // ── Exponential regression method ────────────────────────────────────────────
  // Fit ln(bv) = a + b*x, project 5 years forward
  let exponentialFypm: number | "N/A" = "N/A";
  if (v1 > 0 && v2 > 0 && v3 > 0 && v4 > 0 && v5 > 0) {
    const lnVals = [
      Math.log(v1),
      Math.log(v2),
      Math.log(v3),
      Math.log(v4),
      Math.log(v5),
    ];
    // xs = [0, 1, 2, 3, 4], n=5, sumX=10, sumX2=30
    const sumLnY = lnVals.reduce((s, y) => s + y, 0);
    const sumXLnY = lnVals.reduce((s, y, i) => s + i * y, 0);
    const bExp = (5 * sumXLnY - 10 * sumLnY) / (5 * 30 - 10 ** 2);
    const aExp = (sumLnY - bExp * 10) / 5;
    // Project to x = 9 (5 years beyond x=4)
    const projectedBV = Math.exp(aExp + bExp * 9);
    const fiveYearBVAdded = projectedBV - v5;
    const fiveYearBVYield = (fiveYearBVAdded / price) * 100;
    exponentialFypm =
      (fiveYearBVYield + fiveYearDivYield) / fiveYearInterestRateYield;
  }

  // ── Recency-weighted linear regression ───────────────────────────────────────
  // Weights [1,2,3,4,5] give higher weight to more recent years
  let recencyWeightedFypm: number | "N/A" = "N/A";
  {
    const ys = [v1, v2, v3, v4, v5];
    const weights = [1, 2, 3, 4, 5];
    let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0;
    for (let i = 0; i < 5; i++) {
      const w = weights[i];
      sumW   += w;
      sumWX  += w * i;
      sumWY  += w * ys[i];
      sumWXX += w * i * i;
      sumWXY += w * i * ys[i];
    }
    const den = sumW * sumWXX - sumWX ** 2;
    if (den !== 0) {
      const bRec = (sumW * sumWXY - sumWX * sumWY) / den;
      const aRec = (sumWY - bRec * sumWX) / sumW;
      const projectedBV = aRec + bRec * 9; // 5 years beyond index 4
      const fiveYearBVAdded = projectedBV - v5;
      const fiveYearBVYield = (fiveYearBVAdded / price) * 100;
      recencyWeightedFypm =
        (fiveYearBVYield + fiveYearDivYield) / fiveYearInterestRateYield;
    }
  }

  // ── Conservative method ───────────────────────────────────────────────────────
  // Minimum of valid numeric methods (linear, CAGR, recency-weighted)
  let conservativeFypm: number | "N/A" = "N/A";
  {
    const candidates: number[] = [linearFypm];
    if (typeof cagrFypm === "number") candidates.push(cagrFypm);
    if (typeof recencyWeightedFypm === "number") candidates.push(recencyWeightedFypm);
    conservativeFypm = Math.min(...candidates);
  }

  // ── Composite method ──────────────────────────────────────────────────────────
  // Average of all six base methods (excludes conservative to avoid circularity)
  let compositeFypm: number | "N/A" = "N/A";
  {
    const vals: number[] = [derivativeFypm, linearFypm, rateFypm];
    if (typeof cagrFypm === "number") vals.push(cagrFypm);
    if (typeof exponentialFypm === "number") vals.push(exponentialFypm);
    if (typeof recencyWeightedFypm === "number") vals.push(recencyWeightedFypm);
    if (vals.length > 0) {
      compositeFypm = vals.reduce((s, x) => s + x, 0) / vals.length;
    }
  }

  return {
    derivative_fypm: derivativeFypm,
    linear_fypm: linearFypm,
    rate_fypm: rateFypm,
    composite_fypm: compositeFypm,
    cagr_fypm: cagrFypm,
    exponential_fypm: exponentialFypm,
    recency_weighted_fypm: recencyWeightedFypm,
    conservative_fypm: conservativeFypm,
  };
}
