// Hand-drawn SVG scenes: a few kilobytes instead of photos or video (Requirement 5: first visit ≤ 300 KB).
// Purely decorative, so screen readers skip them; the page text carries the meaning.
// Motion is gentle and switches off when the phone asks for reduced motion (see styles.css).

// Left: healthy forest and a clear river. Right: land opened up by galamsey, pits, an excavator, a brown river.
export function LandscapeHero() {
  return (
    <svg className="scene scene-hero" viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe3f2" />
          <stop offset="1" stopColor="#eef6e4" />
        </linearGradient>
        <linearGradient id="clear-water" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fb3d6" />
          <stop offset="1" stopColor="#2f86b0" />
        </linearGradient>
        <linearGradient id="muddy-water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4f9fbf" />
          <stop offset="0.35" stopColor="#9a7a45" />
          <stop offset="1" stopColor="#8a5f2e" />
        </linearGradient>
      </defs>

      <rect width="400" height="190" fill="url(#sky)" />
      <circle className="sun" cx="318" cy="38" r="17" fill="#f6c445" />

      <g className="cloud cloud-a" fill="#ffffff" opacity="0.9">
        <ellipse cx="70" cy="34" rx="22" ry="8" />
        <ellipse cx="86" cy="29" rx="15" ry="9" />
      </g>
      <g className="cloud cloud-b" fill="#ffffff" opacity="0.75">
        <ellipse cx="212" cy="22" rx="18" ry="6" />
        <ellipse cx="225" cy="18" rx="11" ry="7" />
      </g>

      {/* far hills */}
      <path d="M0 98 Q60 62 120 88 T240 80 T400 86 V190 H0 Z" fill="#8cc08f" />
      {/* forest hill on the left, bare brown land on the right */}
      <path d="M0 112 Q70 84 150 104 Q190 114 215 112 V190 H0 Z" fill="#2f7d4f" />
      <path d="M205 112 Q260 100 320 110 Q365 116 400 108 V190 H205 Z" fill="#c79b63" />

      {/* trees */}
      <g fill="#1f6b45">
        <circle cx="22" cy="104" r="11" />
        <circle cx="40" cy="98" r="13" />
        <circle cx="62" cy="96" r="12" />
        <circle cx="84" cy="99" r="13" />
        <circle cx="108" cy="101" r="12" />
        <circle cx="130" cy="104" r="11" />
        <circle cx="152" cy="107" r="10" />
        <circle cx="176" cy="110" r="9" />
      </g>
      <g fill="#17533a">
        <circle cx="32" cy="112" r="9" />
        <circle cx="74" cy="108" r="10" />
        <circle cx="118" cy="111" r="9" />
        <circle cx="163" cy="115" r="8" />
      </g>

      {/* stumps where the forest was cut */}
      <g fill="#7a5530">
        <rect x="214" y="112" width="4" height="6" rx="1" />
        <rect x="229" y="110" width="4" height="6" rx="1" />
        <rect x="246" y="113" width="4" height="5" rx="1" />
      </g>

      {/* mining pits with standing water */}
      <ellipse cx="300" cy="134" rx="30" ry="9" fill="#9b6f3c" />
      <ellipse cx="300" cy="135" rx="22" ry="6" fill="#a88655" />
      <ellipse cx="360" cy="122" rx="20" ry="6" fill="#9b6f3c" />
      <ellipse cx="360" cy="123" rx="14" ry="4" fill="#a88655" />

      {/* excavator */}
      <g className="excavator">
        <rect x="318" y="100" width="30" height="13" rx="2" fill="#e0a800" />
        <rect x="336" y="91" width="12" height="11" rx="1.5" fill="#e0a800" />
        <rect x="338" y="93" width="8" height="6" fill="#bfe3f2" />
        <rect x="314" y="113" width="38" height="7" rx="3.5" fill="#3b3b3b" />
        <g className="excavator-arm">
          <path d="M322 104 L300 88 L286 104" fill="none" stroke="#c99400" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M282 102 L292 102 L288 110 Z" fill="#3b3b3b" />
        </g>
      </g>

      {/* the river: clear on the left, brown downstream of the mining */}
      <path d="M0 150 Q80 132 170 146 T400 150 V172 Q300 168 200 166 T0 174 Z" fill="url(#muddy-water)" />
      <path d="M0 150 Q80 132 170 146 Q190 149 205 150 V168 Q120 166 0 174 Z" fill="url(#clear-water)" opacity="0.65" />
      <g className="flow" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M10 160 Q70 148 140 156" />
        <path d="M60 167 Q120 158 190 163" />
      </g>
      <g className="flow flow-mud" fill="none" stroke="#e7c896" strokeWidth="1.6" strokeLinecap="round" opacity="0.65">
        <path d="M230 158 Q300 152 380 158" />
        <path d="M250 165 Q320 160 395 164" />
      </g>

      {/* river bank in front */}
      <path d="M0 176 Q120 168 230 172 T400 170 V190 H0 Z" fill="#3f8a57" />
      <path d="M230 172 Q320 168 400 170 V190 H230 Z" fill="#b48a55" />
    </svg>
  );
}

// A calm river through forest: used where the reporter is waiting or has finished
export function RiverBanner() {
  return (
    <svg className="scene scene-banner" viewBox="0 0 400 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="banner-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cde9f4" />
          <stop offset="1" stopColor="#eef6e4" />
        </linearGradient>
        <linearGradient id="banner-water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5fb3d6" />
          <stop offset="1" stopColor="#2f86b0" />
        </linearGradient>
      </defs>
      <rect width="400" height="110" fill="url(#banner-sky)" />
      <g className="cloud cloud-a" fill="#ffffff" opacity="0.85">
        <ellipse cx="300" cy="22" rx="20" ry="7" />
        <ellipse cx="315" cy="18" rx="12" ry="7" />
      </g>
      <path d="M0 62 Q100 38 200 56 T400 50 V110 H0 Z" fill="#8cc08f" />
      <path d="M0 72 Q90 54 190 70 T400 66 V110 H0 Z" fill="#2f7d4f" />
      <g fill="#1f6b45">
        <circle cx="30" cy="66" r="10" />
        <circle cx="54" cy="62" r="12" />
        <circle cx="300" cy="64" r="11" />
        <circle cx="326" cy="60" r="12" />
        <circle cx="352" cy="63" r="11" />
        <circle cx="376" cy="66" r="10" />
      </g>
      <path d="M0 88 Q110 76 220 86 T400 84 V100 Q280 96 180 98 T0 102 Z" fill="url(#banner-water)" />
      <g className="flow" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
        <path d="M20 94 Q120 86 220 92" />
        <path d="M200 96 Q300 90 390 94" />
      </g>
      <path d="M0 102 Q140 96 280 100 T400 98 V110 H0 Z" fill="#3f8a57" />
    </svg>
  );
}

// A young tree: shown after a report is sent
export function Seedling() {
  return (
    <svg className="scene-seedling" viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="80" rx="44" ry="8" fill="#c7e3cc" />
      <path d="M60 80 V44" stroke="#5b3d1e" strokeWidth="4" strokeLinecap="round" />
      <path className="leaf leaf-left" d="M60 56 Q38 54 30 36 Q52 34 60 52 Z" fill="#2f7d4f" />
      <path className="leaf leaf-right" d="M60 48 Q80 44 90 24 Q66 22 60 44 Z" fill="#1f6b45" />
      <circle cx="60" cy="44" r="3" fill="#7fb685" />
    </svg>
  );
}
