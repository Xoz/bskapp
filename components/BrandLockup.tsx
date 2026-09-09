import Image from "next/image";

export default function BrandLockup({ team = "F2014", club = "Bollstanäs SK" }: { team?: string; club?: string }) {
  return (
    <span className="bsk-brand">
      <Image src="/bsk-club.png" width={200} height={216} alt="" unoptimized />
      <span>
        <strong className="bsk-brand-full">{club || "Bollstanäs SK"}</strong>
        <strong className="bsk-brand-short">BSK</strong>
        <small>{team || "F2014"}</small>
      </span>
    </span>
  );
}
