import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getGraphData, HistoricalPoint } from "../api/client";
import LoadingSpinner from "./LoadingSpinner";

interface StockChartProps {
  stockId: number;
}

export default function StockChart({ stockId }: StockChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(false);
  const [header, setHeader] = useState("");
  const [months, setMonths] = useState(3);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const timeframes = [
    { label: "3-Months", value: 3 },
    { label: "6-Months", value: 6 },
    { label: "1-Year", value: 12 },
    { label: "2-Years", value: 24 },
    { label: "5-Years", value: 60 },
    { label: "Max", value: 1000 },
  ];

  useEffect(() => {
    makeGraph(months);
  }, [stockId, months]);

  async function makeGraph(numMonths: number) {
    setLoading(true);

    try {
      const res = await getGraphData(stockId, numMonths);
      const rawData = res.data;

      if (numMonths === 1000) {
        setHeader("All History");
      } else {
        setHeader(`${numMonths} - Month History`);
      }

      if (!rawData.length) {
        setLoading(false);
        return;
      }

      // Parse data
      const data: [Date, number][] = rawData.map((d) => {
        const pieces = d.date.split("-");
        return [
          new Date(
            Number(pieces[0]),
            Number(pieces[1]) - 1,
            Number(pieces[2])
          ),
          d.adjClose,
        ];
      });

      const graphMin = d3.min(data, (d) => d[1]) || 0;
      const graphMax = d3.max(data, (d) => d[1]) || 0;

      const svg = d3.select(svgRef.current);

      // Clear previous graph
      svg.selectAll("#xAxisG, #yAxisG, .graphPoints, #graphPath").remove();

      const WIDTH = 700;
      const HEIGHT = 500;
      const xOffset = graphMax > 9999 ? 100 : 70;
      const MARGINS = { top: 65, right: 20, bottom: 65, left: xOffset };

      const xScale = d3
        .scaleTime()
        .range([MARGINS.left, WIDTH - MARGINS.right])
        .domain([data[0][0], new Date()]);

      const yScale = d3
        .scaleLinear()
        .range([HEIGHT - MARGINS.top, MARGINS.bottom])
        .domain([0.9 * graphMin, 1.1 * graphMax]);

      const xAxis = d3.axisBottom(xScale);
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(10)
        .tickFormat((d) => `$${Number(d).toFixed(2)}`);

      const valueLine = d3
        .line<[Date, number]>()
        .x((d) => xScale(d[0]))
        .y((d) => yScale(d[1]));

      // Draw axes
      svg
        .append("g")
        .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
        .attr("id", "xAxisG")
        .call(xAxis)
        .selectAll("text")
        .attr("y", 5)
        .attr("x", 5)
        .attr("transform", "rotate(45)")
        .style("text-anchor", "start");

      svg
        .append("g")
        .attr("transform", `translate(${MARGINS.left},0)`)
        .attr("id", "yAxisG")
        .call(yAxis);

      // Draw line
      svg
        .append("path")
        .datum(data)
        .attr("d", valueLine)
        .attr("id", "graphPath");

      // Draw interactive points
      const tooltip = svg.select("#group");
      const tooltipText = svg.select("#tooltip_text");
      const tooltipPrice = svg.select("#tooltip_text_price");
      const horizLine = svg.select("#tooltip_line_horiz");
      const vertLine = svg.select("#tooltip_line_vert");

      svg
        .selectAll(".graphPoints")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "graphPoints")
        .attr("cx", (d) => xScale(d[0]))
        .attr("cy", (d) => yScale(d[1]))
        .attr("r", 4)
        .style("opacity", 0)
        .on("mouseover", function (event, d) {
          d3.select(this).style("opacity", 0.9).style("fill", "red");
          tooltip.style("opacity", 1);

          const monthIndex = d[0].getMonth();
          const year = d[0].getFullYear();
          const day = d[0].getDate();
          tooltipText.text(`${monthIndex + 1}/${day}/${year}`);
          tooltipPrice.text(`$${d[1].toFixed(2)}`);

          const cx = d3.select(this).attr("cx");
          const cy = d3.select(this).attr("cy");
          horizLine
            .attr("x1", xOffset)
            .attr("y1", cy)
            .attr("x2", cx)
            .attr("y2", cy);
          vertLine
            .attr("x1", cx)
            .attr("y1", 435)
            .attr("x2", cx)
            .attr("y2", cy);
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
    <>
      <div className="overview_wrapper">
        <h3>Graph Time Span</h3>
        <div className={`dropdown show pull-center ${dropdownOpen ? "open" : ""}`}>
          <button
            id="dropdown_button"
            className="btn btn-secondary dropdown-toggle"
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            Select Time Frame &#x25BC;
          </button>
          {dropdownOpen && (
            <div className="dropdown-menu show">
              {timeframes.map((tf) => (
                <div
                  key={tf.value}
                  className="graph_timeframes"
                  onClick={() => {
                    setMonths(tf.value);
                    setDropdownOpen(false);
                  }}
                >
                  {tf.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="col-md-8">
        <div id="graph_container" className="overview_wrapper">
          <h2 className="center_text" id="graph_header">
            {header}
          </h2>
          <svg ref={svgRef} id="visualisation" width="700" height="500">
            <g id="group" style={{ opacity: 0 }}>
              <rect
                id="tooltip"
                x="330"
                y="60"
                rx="5"
                ry="5"
                width="90"
                height="45"
                style={{ fill: "lightgray", stroke: "black" }}
              />
              <line
                id="tooltip_line_horiz"
                x1="370"
                y1="105"
                strokeDasharray="5,5"
                style={{ stroke: "rgb(150,150,150)", strokeWidth: 2 }}
              />
              <line
                id="tooltip_line_vert"
                x1="370"
                y1="105"
                strokeDasharray="5,5"
                style={{ stroke: "rgb(150,150,150)", strokeWidth: 2 }}
              />
              <text
                id="tooltip_text"
                style={{ fill: "black" }}
                transform="translate(335,78)"
              />
              <text
                id="tooltip_text_price"
                style={{ fill: "black" }}
                transform="translate(335,98)"
              />
            </g>
            {loading && <LoadingSpinner type="circles" />}
          </svg>
        </div>
      </div>
    </>
  );
}
