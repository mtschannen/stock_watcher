import { BookValueData } from "./quandl";

export interface FypmResult {
  derivative_fypm: number | "N/A";
  linear_fypm: number | "N/A";
  rate_fypm: number | "N/A";
}

export function calculateFypm(
  bookValues: BookValueData,
  dividendYield: number,
  price: number,
  interestRate: number
): FypmResult {
  if (
    !bookValues.data ||
    bookValues.data.length < 5 ||
    price === 0 ||
    interestRate === 0
  ) {
    return {
      derivative_fypm: "N/A",
      linear_fypm: "N/A",
      rate_fypm: "N/A",
    };
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

  return {
    derivative_fypm: derivativeFypm,
    linear_fypm: linearFypm,
    rate_fypm: rateFypm,
  };
}
