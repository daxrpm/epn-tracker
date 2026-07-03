import {
  Atom,
  Award,
  BookMarked,
  BookOpen,
  Briefcase,
  BrainCircuit,
  Building2,
  ChartNoAxesCombined,
  Code2,
  Database,
  GraduationCap,
  HandHeart,
  Image,
  Layers,
  MessagesSquare,
  Network,
  Palette,
  Server,
  ShieldCheck,
  Sigma,
  Smartphone,
} from "lucide-react";

import type { OrganizationUnit } from "./api";

type SubjectIcon = typeof BookOpen;

/**
 * Keyword -> icon rules, checked in order (first match wins), built from the actual course
 * names across the four EPN mallas (Computación, Software, Sistemas de Información, Ciencia de
 * Datos e IA). Falls back to a unit-based default for anything unmatched.
 */
const RULES: { pattern: RegExp; icon: SubjectIcon }[] = [
  { pattern: /inteligencia artificial|aprendizaje autom|machine learning|miner[ií]a de datos|anal[ií]tica/i, icon: BrainCircuit },
  { pattern: /big data|datos masivos|almacenamiento de datos|base(s)? de datos|business intelligence/i, icon: Database },
  { pattern: /red(es)? de computadores|redes y conectividad|internet of things/i, icon: Network },
  { pattern: /sistemas? operativos|arquitectura de computadores|multiprocesamiento|computaci[oó]n (distribuida|paralela)|cloud computing|sistemas embebidos|infraestructura/i, icon: Server },
  { pattern: /seguridad|auditor[ií]a/i, icon: ShieldCheck },
  { pattern: /programaci[oó]n|algoritmos|estructura de datos|compiladores|lenguajes/i, icon: Code2 },
  { pattern: /ingenier[ií]a de software|metodolog[ií]as [aá]giles|calidad de software|verificaci[oó]n y validaci[oó]n|construcci[oó]n.*software|gesti[oó]n de proyectos/i, icon: Layers },
  { pattern: /aplicaciones (web|m[oó]viles)|usabilidad|interacci[oó]n humano|user experience/i, icon: Smartphone },
  { pattern: /computaci[oó]n gr[aá]fica|visualizaci[oó]n de datos/i, icon: Image },
  { pattern: /matem[aá]tic|[aá]lgebra|c[aá]lculo|ecuaciones diferenciales|probabilidad|estad[ií]stica|m[eé]todos num[eé]ricos|computaci[oó]n num[eé]rica/i, icon: Sigma },
  { pattern: /mec[aá]nica|f[ií]sica|electr[oó]nica/i, icon: Atom },
  { pattern: /comunicaci[oó]n oral|liderazgo y comunicaci[oó]n/i, icon: MessagesSquare },
  { pattern: /gesti[oó]n organizacional|administraci[oó]n|financiera|econ[oó]mic|socioecon[oó]m|emprendimiento|procesos de negocio|gobernanza|arquitectura empresarial/i, icon: Briefcase },
  { pattern: /artes y humanidades|dise[nñ]o de software|dise[nñ]o de trabajo/i, icon: Palette },
  { pattern: /sistemas de informaci[oó]n|an[aá]lisis y dise[nñ]o de sistemas|sistemas empresariales/i, icon: Building2 },
  { pattern: /trabajo de integraci[oó]n curricular|examen complexivo/i, icon: Award },
  { pattern: /pr[aá]cticas laborales|servicio comunitario/i, icon: HandHeart },
  { pattern: /ciencias? de datos/i, icon: ChartNoAxesCombined },
];

const UNIT_FALLBACK: Record<OrganizationUnit, SubjectIcon> = {
  BASIC: BookOpen,
  PROFESSIONAL: Code2,
  CAPSTONE: GraduationCap,
  OTHER: BookMarked,
};

/** Picks a representative icon for a course based on its name, falling back to its unit. */
export function subjectIcon(name: string, organizationUnit: OrganizationUnit): SubjectIcon {
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.icon;
  }
  return UNIT_FALLBACK[organizationUnit];
}
