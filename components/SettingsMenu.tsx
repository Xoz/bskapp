"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Permission } from "@/lib/auth";
import { IconSettings, IconPitch, IconOverview, IconPlayers, IconShield, IconWhistle } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";

export const SETTINGS_SECTIONS = [
  { id: "profil", label: "Profil", Icon: IconWhistle },
  { id: "matcher", label: "Matcher", Icon: IconPitch },
  { id: "laget", label: "Laget", Icon: IconOverview },
  { id: "trupp", label: "Spelare", Icon: IconPlayers },
  { id: "tranare", label: "Tränare", Icon: IconShield },
] as const;

export default function SettingsMenu({ permissions = [] }: { permissions?: Permission[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  const can = (permission: Permission) => permissions.includes(permission);
  return (
    <>
      <button type="button" className="bsk-icon-button" onClick={() => dialog.current?.showModal()} aria-label="Öppna verktyg och konto" aria-haspopup="dialog">
        <IconSettings width={21} height={21} />
      </button>
      <dialog ref={dialog} className="bsk-tools-dialog" aria-labelledby="tools-heading" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="bsk-tools-heading"><h2 id="tools-heading">Verktyg och konto</h2><button type="button" onClick={close} className="bsk-icon-button" aria-label="Stäng">✕</button></div>
        <nav className="bsk-tool-list" aria-label="Verktyg">
          {can("view_matches") && <Link onClick={close} href="/matcher"><IconPitch width={20} />Matcher och cuper</Link>}
          {can("view_players") && <Link onClick={close} href="/spelare"><IconPlayers width={20} />Spelarutveckling och samtal</Link>}
          {can("view_statistics") && <Link onClick={close} href="/statistik"><IconOverview width={20} />Statistik</Link>}
          {(can("manage_users") || can("manage_groups")) && <Link onClick={close} href="/administration"><IconShield width={20} />Administration</Link>}
          <Link onClick={close} href="/guide"><IconWhistle width={20} />Guide</Link>
        </nav>
        {can("manage_settings") && <section className="bsk-tools-section"><h3>Inställningar</h3><nav className="bsk-tool-list" aria-label="Inställningar">{SETTINGS_SECTIONS.map(({ id, label, Icon }) => <Link key={id} onClick={close} href={`/installningar#${id}`}><Icon width={20} />{label}</Link>)}</nav></section>}
        <section className="bsk-tools-section"><ThemeToggle /></section>
      </dialog>
    </>
  );
}
