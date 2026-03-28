import { useState, useEffect, useRef } from "react";
import { getTickerTape, TickerItem } from "../api/client";

function getMarketStatus(): { text: string; isOpen: boolean } {
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
      return { text: `${hoursLeft + 1}h until close`, isOpen: true };
    }
    if (hoursLeft === 0) {
      return { text: `${minutesLeft}m until close`, isOpen: true };
    }
    return { text: `${hoursLeft}h ${minutesLeft}m until close`, isOpen: true };
  }

  return { text: "Market Closed", isOpen: false };
}

function TickerItems({ items }: { items: TickerItem[] }) {
  if (!items.length) {
    return (
      <span className="ticker-item">
        <span className="ticker-label" style={{ opacity: 0.4 }}>
          Loading...
        </span>
      </span>
    );
  }

  return (
    <>
      {items.map((item, i) => {
        const change = Number(item.change);
        const isUp = change >= 0;
        const price = Number(item.last_trade_price).toFixed(2);
        const changeStr = `${isUp ? "+" : ""}${change.toFixed(2)} (${item.change_in_percent})`;

        return (
          <span key={i} className="ticker-item">
            <span className="ticker-label">{item.label}</span>
            <span className="ticker-price">${price}</span>
            <span className={isUp ? "ticker-up" : "ticker-down"}>
              {changeStr}
            </span>
          </span>
        );
      })}
    </>
  );
}

export default function MarqueeTicker() {
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchTickerData = async () => {
    try {
      const res = await getTickerTape();
      setTickerItems(res.data);
    } catch {
      // silently fail
    }
    setMarketStatus(getMarketStatus());
  };

  useEffect(() => {
    fetchTickerData();
    intervalRef.current = setInterval(fetchTickerData, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="ticker-bar">
      <div className={`ticker-status${marketStatus.isOpen ? " market-open" : ""}`}>
        {marketStatus.text}
      </div>
      <div className="ticker-scroll">
        <div className="ticker-content">
          <TickerItems items={tickerItems} />
        </div>
      </div>
    </div>
  );
}
