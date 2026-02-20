import { useState, useEffect, useRef } from "react";
import { getTickerTape, TickerItem } from "../api/client";

function getMarketStatus(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;

  const marketClose = new Date();
  marketClose.setHours(16, 0, 0, 0);
  const marketCloseUtc = marketClose.getTime() + 14400000;

  const marketOpen = new Date();
  marketOpen.setHours(8, 30, 0, 0);
  const marketOpenUtc = marketOpen.getTime() + 14400000;

  const dateNow = new Date(utcMs);
  const dateMarketClose = new Date(marketCloseUtc);
  const dateMarketOpen = new Date(marketOpenUtc);
  const dayOfWeek = dateNow.getDay();

  if (
    dateNow >= dateMarketOpen &&
    dateNow < dateMarketClose &&
    dayOfWeek >= 1 &&
    dayOfWeek <= 5
  ) {
    let diff = (dateMarketClose.getTime() - dateNow.getTime()) / 1000 / 60;
    const hoursLeft = Math.floor(diff / 60);
    let minutesLeft = Math.ceil(diff % 60);
    if (minutesLeft === 60) {
      return `${hoursLeft + 1} HOURS AND 0 MINUTES UNTIL MARKET CLOSE`;
    }
    if (hoursLeft === 1)
      return `${hoursLeft} HOUR AND ${minutesLeft} MINUTES UNTIL MARKET CLOSE`;
    if (hoursLeft === 0)
      return `${minutesLeft} MINUTES UNTIL MARKET CLOSE`;
    return `${hoursLeft} HOURS AND ${minutesLeft} MINUTES UNTIL MARKET CLOSE`;
  }

  return "MARKET CLOSED";
}

function formatTickerString(data: TickerItem[]): string {
  return data
    .map((item) => {
      const price = Number(item.last_trade_price).toFixed(2);
      const change = Number(item.change);
      const changeStr = change >= 0
        ? ` +${change.toFixed(2)}(${item.change_in_percent})`
        : ` ${change.toFixed(2)}(${item.change_in_percent})`;
      return `${item.label}: ${price}${changeStr}`;
    })
    .join("      ");
}

export default function MarqueeTicker() {
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [tickerText, setTickerText] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchTickerData = async () => {
    try {
      const res = await getTickerTape();
      setTickerText(formatTickerString(res.data));
    } catch {
      // Silently fail - ticker will just not update
    }
    setMarketStatus(getMarketStatus());
  };

  useEffect(() => {
    fetchTickerData();
    intervalRef.current = setInterval(fetchTickerData, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <>
      <div id="time_tape" className="marquee-tape">
        <div className="marquee-content">
          <span>{marketStatus}</span>
        </div>
      </div>
      <div id="ticker_tape" className="marquee-tape">
        <div className="marquee-content">
          <span>{tickerText || "Loading market data..."}</span>
        </div>
      </div>
    </>
  );
}
