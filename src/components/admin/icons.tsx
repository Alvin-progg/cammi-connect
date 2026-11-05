import { BaseIcon, type IconProps } from "@/components/doctor/icons";

/** Admin sidebar icons, drawn like the doctor set: 1.5px line icons on a 24px grid, decorative only. */

export function DashboardIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </BaseIcon>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c1-3.2 3.4-4.8 6-4.8s5 1.6 6 4.8" />
      <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4" />
      <path d="M17.5 15.6c1.6.6 2.8 2 3.5 4.4" />
    </BaseIcon>
  );
}

export function BuildingIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <line x1="9" y1="7" x2="10" y2="7" />
      <line x1="14" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="10" y2="11" />
      <line x1="14" y1="11" x2="15" y2="11" />
      <path d="M10 21v-4h4v4" />
    </BaseIcon>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.25" />
    </BaseIcon>
  );
}

export function HeartPulseIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M20.5 9.5c0 5-8.5 10-8.5 10S3.5 14.5 3.5 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2.5z" />
      <path d="M7 12h2.5l1.5-2.5 2 4 1.5-1.5H17" />
    </BaseIcon>
  );
}

export function ChecklistIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 6l1.5 1.5L8 5" />
      <path d="M4 12l1.5 1.5L8 11" />
      <path d="M4 18l1.5 1.5L8 17" />
      <line x1="11" y1="6.5" x2="20" y2="6.5" />
      <line x1="11" y1="12.5" x2="20" y2="12.5" />
      <line x1="11" y1="18.5" x2="20" y2="18.5" />
    </BaseIcon>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    </BaseIcon>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </BaseIcon>
  );
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </BaseIcon>
  );
}
