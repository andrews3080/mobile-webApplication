// One small picture per report category, so people can choose by what they saw rather than by reading.
// Each is a few hundred bytes. Decorative: the tile's text label is what screen readers announce.

const SKY = "#d9eef6";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg className="category-art" viewBox="0 0 80 56" aria-hidden="true" focusable="false">
      <rect width="80" height="56" rx="6" fill={SKY} />
      {children}
    </svg>
  );
}

export function CategoryArt({ category }: { category: string }) {
  switch (category) {
    case "excavation_site":
      return (
        <Frame>
          <rect y="30" width="80" height="26" fill="#c79b63" />
          <ellipse cx="40" cy="42" rx="24" ry="7" fill="#8f6333" />
          <ellipse cx="40" cy="43" rx="17" ry="4.5" fill="#a88655" />
          <path d="M60 14 L54 36" stroke="#5b3d1e" strokeWidth="3" strokeLinecap="round" />
          <path d="M50 34 L58 38 L54 44 L47 40 Z" fill="#6b6b6b" />
          <circle cx="16" cy="33" r="3" fill="#7a5530" />
          <circle cx="24" cy="31" r="2.5" fill="#7a5530" />
        </Frame>
      );
    case "river_pollution":
      return (
        <Frame>
          <rect y="22" width="80" height="34" fill="#3f8a57" />
          <path d="M0 34 Q20 28 40 34 T80 33 V48 Q60 44 40 47 T0 48 Z" fill="#9a7a45" />
          <path d="M6 41 Q20 37 34 41" stroke="#e7c896" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M44 42 Q58 38 74 42" stroke="#e7c896" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="14" cy="20" r="7" fill="#1f6b45" />
          <circle cx="66" cy="19" r="8" fill="#1f6b45" />
        </Frame>
      );
    case "forest_clearing":
      return (
        <Frame>
          <rect y="34" width="80" height="22" fill="#b48a55" />
          <circle cx="12" cy="22" r="10" fill="#2f7d4f" />
          <rect x="10" y="28" width="4" height="8" fill="#5b3d1e" />
          <rect x="30" y="32" width="6" height="5" rx="1" fill="#7a5530" />
          <ellipse cx="33" cy="32" rx="3" ry="1.2" fill="#c9a26b" />
          <rect x="48" y="33" width="6" height="4" rx="1" fill="#7a5530" />
          <ellipse cx="51" cy="33" rx="3" ry="1.2" fill="#c9a26b" />
          <path d="M58 44 L76 40" stroke="#7a5530" strokeWidth="4" strokeLinecap="round" />
        </Frame>
      );
    case "machinery_or_equipment":
      return (
        <Frame>
          <rect y="38" width="80" height="18" fill="#c79b63" />
          <rect x="34" y="22" width="26" height="12" rx="2" fill="#e0a800" />
          <rect x="48" y="14" width="10" height="10" rx="1.5" fill="#e0a800" />
          <rect x="50" y="16" width="6" height="5" fill={SKY} />
          <rect x="30" y="34" width="34" height="7" rx="3.5" fill="#3b3b3b" />
          <path d="M38 26 L22 16 L12 30" fill="none" stroke="#c99400" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M8 28 L17 28 L13 35 Z" fill="#3b3b3b" />
        </Frame>
      );
    default:
      return (
        <Frame>
          <rect y="36" width="80" height="20" fill="#8cc08f" />
          <circle cx="40" cy="26" r="13" fill="#ffffff" stroke="#1f6b45" strokeWidth="2" />
          <path d="M35 22 Q35 16 40 16 Q46 16 46 21 Q46 25 40 27 V30" fill="none" stroke="#1f6b45" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="35" r="1.6" fill="#1f6b45" />
        </Frame>
      );
  }
}
