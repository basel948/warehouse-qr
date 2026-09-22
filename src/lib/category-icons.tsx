import {
  BagIcon,
  BathtubIcon,
  BucketIcon,
  DotsIcon,
  DropletIcon,
  MopIcon,
  PackageIcon,
  PaperRollIcon,
  PlateIcon,
  ShieldIcon,
  SprayBottleIcon,
  WashingMachineIcon,
  WindIcon,
  WindowIcon,
  WrenchIcon,
} from "@/components/icons";

type IconComponent = (props: { className?: string }) => React.JSX.Element;

// Matched by exact name first (covers the categories/subcategories that
// exist today), then by substring as a looser fallback so a newly renamed
// or newly added category still gets something better than the generic
// icon. Order matters for the substring pass - more specific terms first.
const EXACT_MATCHES: Record<string, IconComponent> = {
  "חומרי ניקוי": SprayBottleIcon,
  "פלסטיק": BagIcon,
  "נייר": PaperRollIcon,
  "אריזה": PackageIcon,
  "כלים": WrenchIcon,
  "בטיחות": ShieldIcon,
  "אחר": DotsIcon,
  "אביזרי ניקוי": BucketIcon,
  "מטהרי אוויר": WindIcon,
  "ניקוי רצפות": MopIcon,
  "חיטוי וניקוי רב-תכליתי": DropletIcon,
  "ניקוי זכוכית ומשטחים": WindowIcon,
  "ניקוי אסלה ואמבטיה": BathtubIcon,
  "כביסה": WashingMachineIcon,
  "ניקוי כלים": PlateIcon,
};

const SUBSTRING_MATCHES: Array<[string, IconComponent]> = [
  ["כביסה", WashingMachineIcon],
  ["אמבט", BathtubIcon],
  ["אסלה", BathtubIcon],
  ["זכוכית", WindowIcon],
  ["רצפ", MopIcon],
  ["אוויר", WindIcon],
  ["חיטוי", DropletIcon],
  ["כלים", PlateIcon],
  ["ניקוי", SprayBottleIcon],
  ["נייר", PaperRollIcon],
  ["פלסטיק", BagIcon],
  ["בטיחות", ShieldIcon],
  ["אריז", PackageIcon],
];

export function getCategoryIcon(name: string): IconComponent {
  if (EXACT_MATCHES[name]) return EXACT_MATCHES[name];
  const match = SUBSTRING_MATCHES.find(([needle]) => name.includes(needle));
  return match ? match[1] : DotsIcon;
}
