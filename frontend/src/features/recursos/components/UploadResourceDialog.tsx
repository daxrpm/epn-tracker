import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { listAcademicPeriods } from "@/features/admin/api";
import type { Professor } from "@/features/offering/api";
import { ApiError } from "@/lib/api/types";

import type { Contribution, CourseOption } from "../api";
import { CONTRIBUTION_LABELS } from "../constants";
import { useCreateFileResource, useCreateLinkResource } from "../hooks";
import { CoursePicker } from "./CoursePicker";
import { ProfessorPicker } from "./ProfessorPicker";

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional preselected materia (from the consultation panel). */
  initialCourse?: CourseOption | null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function UploadResourceDialog({ open, onOpenChange, initialCourse }: Props) {
  const [tab, setTab] = useState<"file" | "link">("file");
  const [course, setCourse] = useState<CourseOption | null>(initialCourse ?? null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tema, setTema] = useState("");
  const [contribution, setContribution] = useState<Contribution | typeof NONE>(NONE);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [periodId, setPeriodId] = useState<string>(NONE);
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [progress, setProgress] = useState(0);

  const periodsQuery = useQuery({
    queryKey: ["academic-periods"],
    queryFn: listAcademicPeriods,
  });

  const createFile = useCreateFileResource((fraction) => setProgress(fraction));
  const createLink = useCreateLinkResource();
  const pending = createFile.isPending || createLink.isPending;

  function reset() {
    setTab("file");
    setCourse(initialCourse ?? null);
    setTitle("");
    setDescription("");
    setTema("");
    setContribution(NONE);
    setFile(null);
    setUrl("");
    setAdvanced(false);
    setPeriodId(NONE);
    setProfessor(null);
    setProgress(0);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  const commonMeta = () => ({
    course_id: course!.id,
    title: title.trim(),
    description: description.trim() || undefined,
    tema: tema.trim() || undefined,
    contribution: contribution === NONE ? undefined : contribution,
    professor_id: professor?.id,
    academic_period_id: periodId === NONE ? undefined : periodId,
    visibility: "COMMUNITY" as const,
  });

  async function submit() {
    if (!course) {
      toast.error("Elige una materia.");
      return;
    }
    if (!title.trim()) {
      toast.error("Escribe un título.");
      return;
    }
    try {
      if (tab === "file") {
        if (!file) {
          toast.error("Selecciona un archivo.");
          return;
        }
        await createFile.mutateAsync({ file, ...commonMeta() });
      } else {
        if (!url.trim()) {
          toast.error("Escribe un enlace.");
          return;
        }
        await createLink.mutateAsync({ external_url: url.trim(), ...commonMeta() });
      }
      toast.success("Recurso enviado. Quedará visible tras la aprobación de la comunidad.");
      close();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo subir el recurso."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" /> Aportar recurso
          </DialogTitle>
          <DialogDescription>
            Sube apuntes, exámenes o enlaces para una materia. El año se toma del periodo actual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Materia</Label>
            <CoursePicker value={course} onChange={setCourse} />
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as "file" | "link")}>
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                Archivo
              </TabsTrigger>
              <TabsTrigger value="link" className="flex-1">
                Enlace
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-3 space-y-1.5">
              <Label htmlFor="resource-file">Archivo (PDF, imagen, .md, .txt, documento)</Label>
              <Input
                id="resource-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.md,.markdown,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </TabsContent>

            <TabsContent value="link" className="mt-3 space-y-1.5">
              <Label htmlFor="resource-url">Enlace (Drive, YouTube, repositorio…)</Label>
              <Input
                id="resource-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://…"
              />
            </TabsContent>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="resource-title">Título</Label>
            <Input
              id="resource-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Resumen de derivadas"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="resource-tema">Tema</Label>
              <Input
                id="resource-tema"
                value={tema}
                onChange={(event) => setTema(event.target.value)}
                placeholder="Ej. Límites"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bimestre</Label>
              <Select value={contribution} onValueChange={(value) => setContribution(value as Contribution | typeof NONE)}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin especificar</SelectItem>
                  <SelectItem value="APORTE_1">{CONTRIBUTION_LABELS.APORTE_1}</SelectItem>
                  <SelectItem value="APORTE_2">{CONTRIBUTION_LABELS.APORTE_2}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resource-desc">Descripción</Label>
            <Textarea
              id="resource-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <button
            type="button"
            onClick={() => setAdvanced((value) => !value)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={`size-4 transition-transform ${advanced ? "rotate-180" : ""}`} />
            Opciones avanzadas
          </button>

          {advanced && (
            <div className="space-y-4 rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label>Año / periodo académico</Label>
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Periodo actual (automático)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Periodo actual (automático)</SelectItem>
                    {(periodsQuery.data ?? []).map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.code} — {period.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Profesor</Label>
                <ProfessorPicker value={professor} onChange={setProfessor} />
              </div>
            </div>
          )}

          {pending && tab === "file" && <Progress value={Math.round(progress * 100)} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Aportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
