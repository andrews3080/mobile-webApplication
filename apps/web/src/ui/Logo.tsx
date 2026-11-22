import { useId } from "react";

// The Asaase Ani mark (docs/brand/asaase-ani-mark.svg): an eye watching over the land, with a location pin.
// Inline SVG: sharp at any size and well under 1 KB, instead of downloading the PNG.
export function LogoMark({ width = 44 }: { width?: number }) {
  const clip = `eye-${useId().replace(/:/g, "")}`; // unique per use, so two marks on a page never clash
  const eye = "M6 36 Q60 -17 114 36 Q60 89 6 36 Z";
  return (
    <svg className="logo-mark" width={width} height={(width * 72) / 120} viewBox="0 0 120 72" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <path d={eye} />
        </clipPath>
      </defs>
      <path d={eye} fill="#ffffff" />
      <g clipPath={`url(#${clip})`}>
        <circle cx="60" cy="36" r="26.5" fill="#1f4d3a" />
        <g fill="none" stroke="#6a9a78" strokeWidth="2">
          <ellipse cx="60" cy="36" rx="22" ry="17.5" />
          <ellipse cx="60" cy="36" rx="16.5" ry="12.5" />
          <ellipse cx="60" cy="36" rx="11" ry="8" />
        </g>
      </g>
      <path d={eye} fill="none" stroke="#1f4d3a" strokeWidth="5" strokeLinejoin="round" />
      <path d="M60 49.5 C56.5 44 51.5 38 51.5 31.5 A8.5 8.5 0 1 1 68.5 31.5 C68.5 38 63.5 44 60 49.5 Z" fill="#e0a526" />
      <circle cx="60" cy="30.5" r="3.2" fill="#1f4d3a" />
    </svg>
  );
}
