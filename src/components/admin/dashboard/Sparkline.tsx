import React from "react";

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Purely presentational sparkline. No state, no fetching.
 * Renders an inline SVG with gradient area + stroke + latest-point dot.
 */
export function Sparkline({
  data,
  color = "#0036DA",
  width = 92,
  height = 28,
}: SparklineProps) {
  const id = React.useId();
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const points = data.map((v, i) => [
    i * stepX,
    height - ((v - min) / range) * (height - 4) - 2,
  ] as [number, number]);
  const path = points
    .map((p, i) => (i === 0 ? "M" : "L") + ` ${p[0]} ${p[1]}`)
    .join(" ");
  const area = path + ` L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width, height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="2.4"
        fill={color}
        stroke="#fff"
        strokeWidth="1.2"
      />
    </svg>
  );
}
