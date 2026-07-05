import { Loader2, Plus, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurriculumCourse } from "@/features/curriculum/api";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import {
  useAddRequirement,
  useCourseRequirements,
  useRemoveRequirement,
  useUpdateCourseName,
  useUpdateCurriculumCourse,
} from "../hooks";

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Admin-only inline editor for a course's malla fields + requirements (ERS §17.3); all audited. */
export function AdminCourseEditor({
  course,
  allCourses,
  onDone,
}: {
  course: CurriculumCourse;
  allCourses: CurriculumCourse[];
  onDone: () => void;
}) {
  const [name, setName] = useState(course.name);
  const [credits, setCredits] = useState(String(Number(course.credits)));
  const [hours, setHours] = useState(String(course.hours ?? ""));
  const [term, setTerm] = useState(String(course.reference_term));

  const updateCc = useUpdateCurriculumCourse();
  const updateName = useUpdateCourseName();
  const pending = updateCc.isPending || updateName.isPending;

  const requirements = useCourseRequirements(course.id);
  const addReq = useAddRequirement();
  const removeReq = useRemoveRequirement();
  const [reqTarget, setReqTarget] = useState("");
  const [reqType, setReqType] = useState<"PREREQUISITE" | "COREQUISITE">("PREREQUISITE");

  async function save() {
    try {
      const trimmed = name.trim();
      if (trimmed && trimmed !== course.name) {
        await updateName.mutateAsync({ courseId: course.course_id, name: trimmed });
      }
      await updateCc.mutateAsync({
        id: course.id,
        patch: {
          credits,
          hours: Number(hours),
          reference_term: Number(term),
        },
      });
      toast.success("Materia actualizada.");
      onDone();
    } catch (error) {
      toast.error(apiMessage(error, "No se pudo actualizar la materia."));
    }
  }

  async function addRequirement() {
    if (!reqTarget) return;
    try {
      await addReq.mutateAsync({
        curriculum_course_id: course.id,
        required_curriculum_course_id: reqTarget,
        requirement_type: reqType,
      });
      setReqTarget("");
      toast.success("Requisito agregado.");
    } catch (error) {
      toast.error(apiMessage(error, "No se pudo agregar el requisito."));
    }
  }

  async function removeRequirement(id: string) {
    try {
      await removeReq.mutateAsync(id);
      toast.success("Requisito eliminado.");
    } catch (error) {
      toast.error(apiMessage(error, "No se pudo eliminar el requisito."));
    }
  }

  // Courses that could be a requirement: any other course in the malla.
  const candidates = allCourses.filter((c) => c.id !== course.id);

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Editar (admin)</p>
      <div className="space-y-1.5">
        <Label htmlFor="admin-course-name">Nombre</Label>
        <Input
          id="admin-course-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin-course-credits">Créditos</Label>
          <Input
            id="admin-course-credits"
            type="number"
            min={0}
            step="0.5"
            value={credits}
            onChange={(event) => setCredits(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-course-hours">Horas</Label>
          <Input
            id="admin-course-hours"
            type="number"
            min={0}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-course-term">Semestre</Label>
          <Input
            id="admin-course-term"
            type="number"
            min={1}
            max={9}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
      </div>
      <Button className="w-full" onClick={() => void save()} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />} Guardar cambios
      </Button>

      <div className="space-y-2 border-t border-primary/20 pt-3">
        <p className="text-xs font-medium text-muted-foreground">Prerrequisitos y correquisitos</p>
        {requirements.isLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (requirements.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin requisitos.</p>
        ) : (
          <ul className="space-y-1">
            {(requirements.data ?? []).map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between rounded-md bg-background/60 px-2 py-1 text-xs"
              >
                <span>
                  <span className="font-medium">{req.required_code}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {req.requirement_type === "PREREQUISITE" ? "prerrequisito" : "correquisito"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void removeRequirement(req.id)}
                  disabled={removeReq.isPending}
                  className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Quitar ${req.required_code}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-1.5">
          <Select value={reqTarget} onValueChange={setReqTarget}>
            <SelectTrigger className="h-8 flex-1 bg-background/70 text-xs">
              <SelectValue placeholder="Materia requisito" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reqType} onValueChange={(v) => setReqType(v as typeof reqType)}>
            <SelectTrigger className={cn("h-8 w-28 bg-background/70 text-xs")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PREREQUISITE">Prereq.</SelectItem>
              <SelectItem value="COREQUISITE">Correq.</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            className="size-8 shrink-0"
            onClick={() => void addRequirement()}
            disabled={!reqTarget || addReq.isPending}
            aria-label="Agregar requisito"
          >
            {addReq.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          </Button>
        </div>
      </div>
    </div>
  );
}
