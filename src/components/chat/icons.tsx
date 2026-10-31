/**
 * Chat-specific line icons on the shared doctor-workspace base (24px grid,
 * 1.5px stroke, always aria-hidden). Shared shapes are re-exported from there.
 */
import { BaseIcon, type IconProps } from "@/components/doctor/icons";

export {
  CalendarIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CloseIcon,
  PlusIcon,
} from "@/components/doctor/icons";

export function SparkleIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M10 3.5 11.6 8.4 16.5 10l-4.9 1.6L10 16.5l-1.6-4.9L3.5 10l4.9-1.6Z" />
      <path d="M18 14.5 18.8 16.7 21 17.5l-2.2.8L18 20.5l-.8-2.2-2.2-.8 2.2-.8Z" />
      <path d="M17.5 3.5v3M16 5h3" />
    </BaseIcon>
  );
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.25 2.4 2.4 4.6-4.9" />
    </BaseIcon>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <line x1="16" y1="16" x2="20.5" y2="20.5" />
    </BaseIcon>
  );
}

export function SidebarIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <line x1="9.5" y1="4.5" x2="9.5" y2="19.5" />
      <path d="M5.75 8.5h1.5M5.75 11h1.5" />
    </BaseIcon>
  );
}

export function PencilSquareIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13" />
      <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L12.5 14.4l-3.5.8.8-3.5Z" />
    </BaseIcon>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v3h3" />
      <path d="M12 8v4l2.5 2" />
    </BaseIcon>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    </BaseIcon>
  );
}

export function BuildingIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
      <path d="M10 20.5v-4h4v4" />
      <path d="M12 7v4M10 9h4" />
    </BaseIcon>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M5 12.5 10 17.5 19 7" />
    </BaseIcon>
  );
}
