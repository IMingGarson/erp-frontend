export const CompanyLogo = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 120 140" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* 👇 必須要有這段 defs，正面的軌道才切得出來 */}
    <defs>
      <clipPath id="front-clip">
        <polygon points="-20,160 140,160 -20,40" />
      </clipPath>
    </defs>

    {/* 橢圓軌道背面 (虛線) */}
    <ellipse 
      cx="60" cy="70" rx="32" ry="62" 
      transform="rotate(35 60 70)" 
      fill="none" 
      stroke="#111827" 
      strokeWidth="1.5" 
      strokeDasharray="4 2" 
    />

    {/* 主體 G */}
    <text 
      x="60" y="112" 
      fontFamily='"Times New Roman", Times, serif' 
      fontSize="115" 
      fontStyle="italic" 
      fontWeight="900" 
      textAnchor="middle" 
      fill="#111827"
    >
      G
    </text>

    {/* 橢圓軌道正面 (實線) */}
    <ellipse 
      cx="60" cy="70" rx="32" ry="62" 
      transform="rotate(35 60 70)" 
      fill="none" 
      stroke="#111827" 
      strokeWidth="3.5" 
      strokeLinecap="round"
      clipPath="url(#front-clip)" 
    />
  </svg>
);