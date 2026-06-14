// Eget ikonbibliotek – 24px stroke-ikoner, ärver currentColor
import type { SVGProps } from "react";

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconOverview = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3" y="3" width="7.5" height="10" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="6" rx="2" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="2" />
    <rect x="3" y="16" width="7.5" height="5" rx="2" />
  </Base>
);

export const IconPlayers = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3.2 20c.6-3.4 3-5.4 5.8-5.4s5.2 2 5.8 5.4" />
    <circle cx="17" cy="9.5" r="2.6" />
    <path d="M15.6 14.7c2.7.1 4.6 1.9 5.2 4.8" />
  </Base>
);

export const IconPitch = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <path d="M12 4.5v15" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M3 9h2.8v6H3M21 9h-2.8v6H21" />
  </Base>
);

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3.5 20.5h17" />
    <path d="M6 16.5v-4M11 16.5V8M16 16.5v-6.5M20 16.5V5" />
  </Base>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.35.95a7 7 0 0 0-2.42-1.4L13.7 2.6h-3.4l-.39 2.54a7 7 0 0 0-2.42 1.4l-2.35-.95-2 3.46 2 1.55a7.06 7.06 0 0 0 0 2.8l-2 1.55 2 3.46 2.35-.95a7 7 0 0 0 2.42 1.4l.39 2.54h3.4l.39-2.54a7 7 0 0 0 2.42-1.4l2.35.95 2-3.46-2-1.55A7 7 0 0 0 19 12Z" />
  </Base>
);

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M14 5.5V4a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 4 4v16a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 14 20v-1.5" />
    <path d="M9.5 12H21M17.5 8.5 21 12l-3.5 3.5" />
  </Base>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconBall = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2 16 10l-1.5 4.6h-5L8 10l4-2.8ZM12 3v4.2M16 10l4-1.2M14.5 14.6l2.6 3.6M9.5 14.6l-2.6 3.6M8 10 4 8.8" />
  </Base>
);

export const IconClock = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconTarget = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.8" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Base>
);

export const IconSpark = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 3.5 13.8 9 19 10.5l-4.6 3 1.2 6-3.6-3.4L8.4 19l1.2-5.5L5 10.5 10.2 9 12 3.5Z" />
  </Base>
);

export const IconTrendUp = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3.5 17.5 9.5 11l4 4 7-7.5" />
    <path d="M15.5 7.5h5v5" />
  </Base>
);

export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 3.8 21.2 19.5H2.8L12 3.8Z" />
    <path d="M12 10v4.2" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
  </Base>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4.5 12.5 10 18 19.5 6.5" />
  </Base>
);

export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Base>
);

export const IconArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </Base>
);

export const IconWhistle = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M13.5 8.5H21v3.2a7 7 0 1 1-9.6-6.5l2.1 3.3Z" />
    <circle cx="10.5" cy="14.5" r="1.6" />
    <path d="M15 5.5 14 3M18 5.5l1-2.5" />
  </Base>
);

export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 2.8 20 6v6c0 5-3.4 8-8 9.2C7.4 20 4 17 4 12V6l8-3.2Z" />
  </Base>
);

export const IconGlove = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M7.5 11V5.8a1.4 1.4 0 0 1 2.8 0V10M10.3 9.5V4.6a1.4 1.4 0 0 1 2.8 0V10M13.1 9.7V5.4a1.4 1.4 0 0 1 2.8 0V11" />
    <path d="M15.9 11.2l1.6-2.2a1.35 1.35 0 0 1 2.2 1.6l-3.2 4.9V19a2 2 0 0 1-2 2H10a2 2 0 0 1-1.7-.9L5 15.4a1.4 1.4 0 0 1 2.3-1.6l.2.3V11" />
  </Base>
);

export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 20.5C6.5 16.7 3.5 13.6 3.5 9.9 3.5 7.2 5.6 5 8.2 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.6 0 4.7 2.2 4.7 4.9 0 3.7-3 6.8-8.5 10.6Z" />
  </Base>
);

export const IconChat = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Base>
);

export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Base>
);
