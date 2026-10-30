/**
 * Small inline icon set for the doctor workspace. Line icons, 1.5px stroke on
 * a 24px grid, decorative only (always aria-hidden).
 */
export type IconProps = { className?: string };

export function BaseIcon({
  className = "size-5",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </BaseIcon>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </BaseIcon>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="12" width="3" height="8" rx="0.75" />
      <rect x="11" y="7" width="3" height="13" rx="0.75" />
      <rect x="16" y="10" width="3" height="10" rx="0.75" />
    </BaseIcon>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </BaseIcon>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </BaseIcon>
  );
}

export function StethoscopeIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M5 3v6a5 5 0 0 0 10 0V3" />
      <path d="M10 14v3a4 4 0 0 0 8 0v-2" />
      <circle cx="18" cy="13" r="2" />
    </BaseIcon>
  );
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="13" y2="15" />
    </BaseIcon>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M15 6l-6 6 6 6" />
    </BaseIcon>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M9 6l6 6-6 6" />
    </BaseIcon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </BaseIcon>
  );
}

export function SignOutIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 16l-4-4 4-4" />
      <line x1="6" y1="12" x2="15" y2="12" />
    </BaseIcon>
  );
}
