import Link from "next/link";
import { getCurrentUser, getCoachName, isStaffRole } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { logout } from "@/lib/actions";
import { IconLogout } from "@/components/Icons";
import BrandLockup from "@/components/BrandLockup";
import NavLinks from "@/components/NavLinks";
import SettingsMenu from "@/components/SettingsMenu";

export default async function Navbar() {
  const [user, settings, coachName] = await Promise.all([getCurrentUser(), getAllSettings(), getCoachName()]);
  const isStaff = !!user && isStaffRole(user.primaryRole);
  const homeHref = isStaff ? "/idag" : user ? "/mina-spelare" : "/";
  return (
    <header className="bsk-header">
      <div className="bsk-header-inner">
        <Link href={homeHref} aria-label={`${settings.club_name || "Bollstanäs SK"} – startsida`}>
          <BrandLockup team={settings.team_name} club={settings.club_name} />
        </Link>
        {isStaff && <div className="bsk-header-nav"><NavLinks permissions={user?.permissions ?? []} horizontal /></div>}
        <div className="bsk-header-actions">
          {isStaff && coachName && <span className="bsk-coach-name">{coachName.split(" ")[0]}</span>}
          {user && <SettingsMenu permissions={user.permissions} />}
          {user && <form action={logout}><button type="submit" className="bsk-icon-button" title="Logga ut" aria-label="Logga ut"><IconLogout width={20} height={20} /></button></form>}
        </div>
      </div>
    </header>
  );
}
