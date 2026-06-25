interface Props {
  className?: string;
}

export default function ForcomLogo({ className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 148 42"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="FORCOM"
      className={className}
      style={{ display: "block" }}
    >
      <text
        y="38"
        fontFamily="'Barlow Condensed', sans-serif"
        fontWeight="800"
        fontSize="44"
        letterSpacing="-0.3"
      >
        <tspan fill="#E8231A">FOR</tspan>
        <tspan fill="#FFFFFF">COM</tspan>
      </text>
      <text
        x="138"
        y="8"
        fontFamily="'Barlow Condensed', sans-serif"
        fontWeight="700"
        fontSize="11"
        fill="#FFFFFF"
      >
        ®
      </text>
    </svg>
  );
}
