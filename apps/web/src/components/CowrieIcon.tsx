"use client";

import { SVGProps, useId } from "react";

interface CowrieIconProps extends SVGProps<SVGSVGElement> {
  filled?: boolean;
  size?: number | string;
  glow?: boolean;
}

/**
 * A beautifully detailed SVG representation of a cowrie shell.
 * Includes gradient shading, highlights, and stylized teeth (denticulations).
 */
export function CowrieIcon({
  filled = false,
  size = 40,
  glow = false,
  className = "",
  ...props
}: CowrieIconProps) {
  const rawId = useId();
  const uniqueId = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `cowrieGrad-${uniqueId}`;
  const slitId = `innerSlitGrad-${uniqueId}`;
  const filterId = `glow-${uniqueId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-300 ${className}`}
      {...props}
    >
      <defs>
        {/* Rich cream to brass/gold gradient for the outer shell body */}
        <linearGradient id={gradId} x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbf9f4" /> {/* Bright ivory highlight */}
          <stop offset="35%" stopColor="#f4ecdd" /> {/* Classic cowrie cream */}
          <stop offset="75%" stopColor="#d4ab36" /> {/* Gold */}
          <stop offset="100%" stopColor="#a37e1e" /> {/* Brass */}
        </linearGradient>

        {/* Deep background shadow for the central aperture slit */}
        <linearGradient id={slitId} x1="50" y1="15" x2="50" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#100e1a" />
          <stop offset="100%" stopColor="#0a0812" />
        </linearGradient>

        {/* Ambient glow filter for active state */}
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Main outer shell body */}
      <path
        d="M50 10 C 25 14, 16 38, 16 60 C 16 78, 28 90, 50 90 C 72 90, 84 78, 84 60 C 84 38, 75 14, 50 10 Z"
        fill={filled ? `url(#${gradId})` : "rgba(34, 30, 58, 0.4)"}
        stroke={filled ? "var(--color-gold)" : "rgba(244, 236, 221, 0.2)"}
        strokeWidth={filled ? "1.5" : "1"}
        filter={glow && filled ? `url(#${filterId})` : undefined}
        className="transition-all duration-300"
      />

      {/* 2. Glossy highlight overlay on the left curve (only when filled) */}
      {filled && (
        <path
          d="M28 42 C 26 52, 30 70, 38 78 C 31 74, 24 62, 24 48 C 24 36, 28 24, 38 18 C 32 24, 28 32, 28 42 Z"
          fill="#ffffff"
          opacity="0.25"
          pointerEvents="none"
        />
      )}

      {/* 3. Central aperture slit */}
      <path
        d="M50 16 C 47.5 30, 46.5 45, 47.5 55 C 48.5 65, 49.5 75, 50 84 C 50.5 75, 51.5 65, 52.5 55 C 53.5 45, 52.5 30, 50 16 Z"
        fill={filled ? `url(#${slitId})` : "rgba(16, 14, 26, 0.6)"}
        stroke={filled ? "transparent" : "rgba(244, 236, 221, 0.15)"}
        strokeWidth="0.5"
      />

      {/* 4. Toothed ridges (denticulations) along both sides of the slit */}
      {/* Left teeth */}
      <path
        d="M47.3 26 L42.5 27 M47.1 33 L41.5 34 M46.9 40 L40.5 41 M46.9 47 L40.5 48 M47.1 54 L41.5 55 M47.3 61 L41.5 62 M47.7 68 L42.5 69 M48.2 74 L43.5 75"
        stroke={filled ? "var(--color-gold)" : "rgba(244, 236, 221, 0.15)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={filled ? 0.95 : 0.6}
      />

      {/* Right teeth */}
      <path
        d="M52.7 26 L57.5 27 M52.9 33 L58.5 34 M53.1 40 L59.5 41 M53.1 47 L59.5 48 M52.9 54 L58.5 55 M52.7 61 L58.5 62 M52.3 68 L57.5 69 M51.8 74 L56.5 75"
        stroke={filled ? "var(--color-gold)" : "rgba(244, 236, 221, 0.15)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={filled ? 0.95 : 0.6}
      />
    </svg>
  );
}
