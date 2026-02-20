import axios from "axios";

const FRED_API_KEY =
  process.env.FRED_API_KEY || "d9f592689a18d841cab93825d4e060c7";

export async function getFiveYearInterestRate(): Promise<number> {
  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS5&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}`;
    const response = await axios.get(url);
    const observations = response.data?.observations;
    if (!observations || observations.length === 0) return 2.0;

    const lastValue = observations[observations.length - 1].value;
    return parseFloat(lastValue) || 2.0;
  } catch (err) {
    console.error("FRED API error:", err);
    return 2.0;
  }
}
