import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CurriculumCourse } from "@/features/curriculum/api";
import { ApiError } from "@/lib/api/types";

import { useUpdateCourseName, useUpdateCurriculumCourse } from "../hooks";

/** Admin-only inline editor for a course's malla fields (ERS §17.3). Every save is audited server-side. */
export function AdminCourseEditor({
  course,
  onDone,
}: {
  course: CurriculumCourse;
  onDone: () => void;
}) {
  const [name, setName] = useState(course.name);
  const [credits, setCredits] = useState(String(Number(course.credits)));
  const [hours, setHours] = useState(String(course.hours ?? ""));
  const [term, setTerm] = useState(String(course.reference_term));

  const updateCc = useUpdateCurriculumCourse();
  const updateName = useUpdateCourseName();
  const pending = updateCc.isPending || updateName.isPending;

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
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar la materia.");
    }
  }

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
    </div>
  );
}
