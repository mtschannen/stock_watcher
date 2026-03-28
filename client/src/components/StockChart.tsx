import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getMarketGraph, HistoricalPoint } from "../api/client";
import LoadingSpinner from "./LoadingSpinner";

interface StockChartProps {
  ticker: string;
}

const FYPM_LINES = [
  { key: "derivative_fypm" as const, id: "derivativeFypmPath", color: "#a78bfa", label: "Derived FYPM" },
  { key: "linear_fypm"    as const, id: "linearFypmPath",    color: "#34d399", label: "Linear FYPM"  },
  { key: "rate_fypm"      as const, id: "rateFypmPath",      color: "#fb923c", label: "Rate FYPM"    },
];

export default function StockChart({ ticker }: StockChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState("");
  const [months, setMonths] = useState(3);
  const [hasFypm, setHasFypm] = useState(false);

  const timeframes = [
    { label: "3-Months", value: 3 },
    { label: "6-Months", value: 6 },
    { label: "1-Year",   value: 12 },
    { label: "2-Years",  value: 24 },
    { label: "5-Years",  value: 60 },
    { label: "Max",      value: 1000 },
  ];

  useEffect(() => {
    makeGraph(months);
  }, [ticker, months]);

  async function makeGraph(numMonths: number) {
    setLoading(true);
    try {
      const res = await getMarketGraph(ticker, numMonths);
      const rawData = res.data;

      setHeader(numMonths === 1000 ? "All History" : `${numMonths}-Month History`);

      if (!rawData.length) return;

      // Parse price data
      const priceData: [Date, number][] = rawData.map((d) => {
        const [y, m, day] = d.date.split("-").map(Number);
        return [new Date(y, m - 1, day), d.adjClose];
      });

      // Parse FYPM data (points where all three values are present)
      const fypmPoints = rawData
        .filter((d) => d.derivative_fypm !== null)
        .map((d) => {
          const [y, m, day] = d.date.split("-").map(Number);
          return {
            date: new Date(y, m - 1, day),
            derivative_fypm: d.derivative_fypm as number,
            linear_fypm:     d.linear_fypm     as number,
            rate_fypm:       d.rate_fypm        as number,
          };
        });

      setHasFypm(fypmPoints.length > 0);

      const graphMin = d3.min(priceData, (d) => d[1]) || 0;
      const graphMax = d3.max(priceData, (d) => d[1]) || 0;

      const svg = d3.select(svgRef.current);
      svg.selectAll(
        "#xAxisG, #yAxisG, #yAxisRightG, .graphPoints, #graphPath, .fypmPath"
      ).remove();

      const WIDTH  = 700;
      const HEIGHT = 500;
      const xOffset = graphMax > 9999 ? 100 : 70;
      const rightMargin = fypmPoints.length > 0 ? 60 : 20;
      const MARGINS = { top: 65, right: rightMargin, bottom: 65, left: xOffset };

      const xScale = d3.scaleTime()
        .range([MARGINS.left, WIDTH - MARGINS.right])
        .domain([priceData[0][0], new Date()]);

      const yScale = d3.scaleLinear()
        .range([HEIGHT - MARGINS.top, MARGINS.bottom])
        .domain([0.9 * graphMin, 1.1 * graphMax]);

      // Axes
      svg.append("g")
        .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
        .attr("id", "xAxisG")
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("y", 5).attr("x", 5)
        .attr("transform", "rotate(45)")
        .style("text-anchor", "start");

      svg.append("g")
        .attr("transform", `translate(${MARGINS.left},0)`)
        .attr("id", "yAxisG")
        .call(d3.axisLeft(yScale).ticks(10).tickFormat((d) => `$${Number(d).toFixed(2)}`));

      // Price line
      svg.append("path")
        .datum(priceData)
        .attr("d", d3.line<[Date, number]>().x((d) => xScale(d[0])).y((d) => yScale(d[1])))
        .attr("id", "graphPath");

      // FYPM secondary axis + lines
      if (fypmPoints.length > 0) {
        const allFypmVals = fypmPoints.flatMap((p) =>
          [p.derivative_fypm, p.linear_fypm, p.rate_fypm]
        );
        const fypmMin = d3.min(allFypmVals) || 0;
        const fypmMax = d3.max(allFypmVals) || 1;

        const yFypm = d3.scaleLinear()
          .range([HEIGHT - MARGINS.top, MARGINS.bottom])
          .domain([fypmMin * 0.85, fypmMax * 1.15]);

        svg.append("g")
          .attr("transform", `translate(${WIDTH - MARGINS.right},0)`)
          .attr("id", "yAxisRightG")
          .call(
            d3.axisRight(yFypm).ticks(5).tickFormat((d) => Number(d).toFixed(2))
          );

        FYPM_LINES.forEach(({ key, id, color }) => {
          svg.append("path")
            .datum(fypmPoints)
            .attr("class", "fypmPath")
            .attr("id", id)
            .attr("d",
              d3.line<typeof fypmPoints[0]>()
                .x((p) => xScale(p.date))
                .y((p) => yFypm(p[key]))
            )
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "5,3")
            .attr("fill", "none")
            .attr("opacity", 0.7);
        });
      }

      // Interactive hover points
      const tooltip   = svg.select("#group");
      const ttText    = svg.select("#tooltip_text");
      const ttPrice   = svg.select("#tooltip_text_price");
      const horizLine = svg.select("#tooltip_line_horiz");
      const vertLine  = svg.select("#tooltip_line_vert");

      svg.selectAll(".graphPoints")
        .data(priceData)
        .enter()
        .append("circle")
        .attr("class", "graphPoints")
        .attr("cx", (d) => xScale(d[0]))
        .attr("cy", (d) => yScale(d[1]))
        .attr("r", 4)
        .style("opacity", 0)
        .on("mouseover", function (_ev, d) {
          d3.select(this).style("opacity", 0.9).style("fill", "#3b82f6");
          tooltip.style("opacity", 1);
          ttText.text(`${d[0].getMonth() + 1}/${d[0].getDate()}/${d[0].getFullYear()}`);
          ttPrice.text(`$${d[1].toFixed(2)}`);
          const cx = d3.select(this).attr("cx");
          const cy = d3.select(this).attr("cy");
          horizLine.attr("x1", xOffset).attr("y1", cy).attr("x2", cx).attr("y2", cy);
          vertLine.attr("x1", cx).attr("y1", 435).attr("x2", cx).attr("y2", cy);
        })
        .on("mouseout", function () {
          d3.select(this).style("opacity", 0);
          tooltip.style("opacity", 0);
        });

    } catch (err) {
      console.error("Error loading graph data:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="graph_container" className="overview_wrapper">
      {/* Header row: label + timeframe buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <span id="graph_header">{header}</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setMonths(tf.value)}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                border: "1px solid",
                borderColor: months === tf.value ? "var(--accent)" : "var(--border-solid)",
                background: months === tf.value ? "rgba(59,130,246,0.15)" : "transparent",
                color: months === tf.value ? "var(--accent)" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                transition: "all 0.15s",
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG chart */}
      <svg
        ref={svgRef}
        id="visualisation"
        viewBox="0 0 720 520"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <g id="group" style={{ opacity: 0 }}>
          <rect id="tooltip" x="330" y="60" rx="5" ry="5" width="90" height="45" />
          <line id="tooltip_line_horiz" x1="370" y1="105" strokeDasharray="5,5" />
          <line id="tooltip_line_vert"  x1="370" y1="105" strokeDasharray="5,5" />
          <text id="tooltip_text"       transform="translate(335,78)" />
          <text id="tooltip_text_price" transform="translate(335,98)" />
        </g>
        {loading && <LoadingSpinner type="circles" />}
      </svg>

      {/* Legend */}
      {hasFypm && (
        <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
            <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="var(--accent)" strokeWidth="2" /></svg>
            Price
          </div>
          {FYPM_LINES.map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
              <svg width="24" height="10">
                <line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray="5,3" />
              </svg>
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
