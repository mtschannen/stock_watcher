import axios from "axios";

const QUANDL_API_KEY = process.env.QUANDL_API_KEY || "rWvJtw9jPu2px-yskKZ4";

export interface BookValueData {
  data: [string, number][];
}

export async function getBookValueHistory(
  ticker: string
): Promise<BookValueData | null> {
  try {
    const url = `https://www.quandl.com/api/v3/datasets/SF0/${ticker}_BVPS_MRY.json?api_key=${QUANDL_API_KEY}`;
    const response = await axios.get(url);
    const dataset = response.data?.dataset;
    if (!dataset) return null;
    return { data: dataset.data };
  } catch (err) {
    console.error("Quandl API error:", err);
    return null;
  }
}
