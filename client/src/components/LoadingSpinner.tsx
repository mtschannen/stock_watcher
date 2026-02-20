import { useState, useEffect, useRef } from "react";

interface LoadingSpinnerProps {
  type?: "circles" | "dots";
}

export default function LoadingSpinner({ type = "circles" }: LoadingSpinnerProps) {
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setFrame((f) => f + 1);
    }, type === "circles" ? 100 : 150);
    return () => clearInterval(intervalRef.current);
  }, [type]);

  if (type === "dots") {
    const dotColors = ["#bfbfbf", "#737373", "#262626"];
    return (
      <div id="overview_div_container">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="load_div"
            style={{ backgroundColor: dotColors[(frame + i) % 3] }}
          />
        ))}
      </div>
    );
  }

  const colors = [
    "#d9d9d9",
    "#bfbfbf",
    "#a6a6a6",
    "#8c8c8c",
    "#737373",
    "#595959",
    "#404040",
    "#262626",
  ];

  const positions = [
    { cx: 350, cy: 220 },
    { cx: 390, cy: 220 },
    { cx: 418, cy: 248 },
    { cx: 418, cy: 288 },
    { cx: 390, cy: 316 },
    { cx: 350, cy: 316 },
    { cx: 322, cy: 288 },
    { cx: 322, cy: 248 },
  ];

  return (
    <g id="loading_graphic">
      {positions.map((pos, i) => (
        <circle
          key={i}
          cx={pos.cx}
          cy={pos.cy}
          r={10}
          fill={colors[(frame + i) % 8]}
        />
      ))}
    </g>
  );
}
