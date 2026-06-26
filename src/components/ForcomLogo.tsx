import Image from "next/image";

interface Props {
  className?: string;
  priority?: boolean;
}

export default function ForcomLogo({ className = "", priority = false }: Props) {
  return (
    <Image
      src="/images/brand/forcom-logo.png"
      alt="FORCOM"
      width={4431}
      height={826}
      className={className}
      priority={priority}
    />
  );
}
