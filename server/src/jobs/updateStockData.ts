import cron from "node-cron";
import { findAllStocks } from "../models/Stock";
import { createStockDatum } from "../models/StockDatum";
import { getQuotes } from "../services/yahooFinance";
import { getBookValueHistory } from "../services/quandl";
import { getFiveYearInterestRate } from "../services/fred";
import { calculateFypm } from "../services/fypmCalculator";

export async function runDataCollection(): Promise<void> {
  console.log("Starting data collection...");
  const stocks = await findAllStocks();

  for (const stock of stocks) {
    try {
      const quotes = await getQuotes([stock.ticker_symbol]);
      if (!quotes.length) continue;

      const quote = quotes[0];
      const bookValues = await getBookValueHistory(stock.ticker_symbol);
      const interestRate = await getFiveYearInterestRate();

      if (!bookValues) {
        await createStockDatum(stock.ticker_symbol, "N/A", "N/A", "N/A");
        continue;
      }

      const fypm = calculateFypm(
        bookValues,
        quote.dividend_yield,
        quote.last_trade_price,
        interestRate
      );

      await createStockDatum(
        stock.ticker_symbol,
        fypm.derivative_fypm,
        fypm.linear_fypm,
        fypm.rate_fypm
      );

      console.log(`Data collected for ${stock.ticker_symbol}`);
    } catch (err) {
      console.error(
        `Error collecting data for ${stock.ticker_symbol}:`,
        err
      );
    }
  }

  console.log("Data collection complete.");
}

export function scheduleDataCollection(): void {
  // Run daily at 9 PM
  cron.schedule("0 21 * * *", () => {
    runDataCollection().catch(console.error);
  });
  console.log("Data collection scheduled for 9 PM daily");
}
