type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z" />
      <path d="M3.29 7 12 12l8.71-5" />
      <path d="M12 22V12" />
    </Svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function CashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 6v12M18 6v12" />
    </Svg>
  );
}

export function CreditCardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

export function DuplicateIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

export function SprayBottleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="15" r="5" />
      <path d="M11 10V7" />
      <path d="M9.5 7h3l1.5-2" />
      <path d="M14 5l1.3 1" />
      <path d="M17.3 3.3l1.4.8" />
      <path d="M18.6 5.6l1.6.1" />
      <path d="M17.8 7.7l1.1 1.2" />
    </Svg>
  );
}

export function PaperRollIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="11" cy="6" rx="6" ry="2.5" />
      <ellipse cx="11" cy="6" rx="2.2" ry="1" />
      <path d="M5 6v10c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V6" />
      <path d="M14.5 18l1.8 1-1 2.3-1.8-.9 1-1.2z" />
    </Svg>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 8h13l1 12.2a1 1 0 0 1-1 1.1H5.5a1 1 0 0 1-1-1.1z" />
      <path d="M8.5 8V6a2.5 2.5 0 0 1 5 0v2" />
      <circle cx="9.5" cy="14" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="16" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function DotsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <circle cx="6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18" cy="12" r="1.7" />
    </svg>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function BucketIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h16l-1.5 12a2 2 0 0 1-2 1.8H7.5a2 2 0 0 1-2-1.8z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </Svg>
  );
}

export function WindIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="7" width="8" height="13" rx="2" />
      <rect x="9" y="3" width="4" height="4" rx="1" />
      <path d="M16.5 6.5L19 5" />
      <path d="M17.5 9.5H20" />
      <path d="M16.5 12.5l2.5 1.2" />
    </Svg>
  );
}

export function MopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.8 5.8l2.1 2.1" />
      <path d="M16.1 16.1l2.1 2.1" />
      <path d="M18.2 5.8l-2.1 2.1" />
      <path d="M7.9 16.1l-2.1 2.1" />
      <circle cx="12" cy="12" r="2.3" />
    </Svg>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2s7 7.58 7 12a7 7 0 1 1-14 0c0-4.42 7-12 7-12z" />
    </Svg>
  );
}

export function WindowIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 4v16" />
      <path d="M4 12h16" />
    </Svg>
  );
}

export function BathtubIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="2" width="7" height="4" rx="1" />
      <path d="M6 6h9v3.5A4.5 4.5 0 0 1 10.5 14 4.5 4.5 0 0 1 6 9.5z" />
      <path d="M7.5 14l-1 7h8l-1-7" />
    </Svg>
  );
}

export function WashingMachineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="13" r="5" />
      <circle cx="8" cy="6" r="0.8" fill="currentColor" />
      <circle cx="11" cy="6" r="0.8" fill="currentColor" />
    </Svg>
  );
}

export function PlateIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.3" />
      <path d="M5 6v4.5c0 1.27 3.13 2.3 7 2.3s7-1.03 7-2.3V6" />
      <path d="M5 10.5V15c0 1.27 3.13 2.3 7 2.3s7-1.03 7-2.3v-4.5" />
    </Svg>
  );
}
