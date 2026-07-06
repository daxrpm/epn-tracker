import { CalendarClock, GraduationCap, Loader2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCareers } from "@/features/curriculum/hooks";
import { ApiError } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth.store";

import type { AcademicPeriod, Career } from "../api";
import {
  useAcademicPeriods,
  useCreateAcademicPeriod,
  useInstitutions,
  useUpdateAcademicPeriod,
  useUpdateCareer,
} from "../hooks";

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Superadmin system console: academic periods and careers (ERS §12.9, §17.3); all audited. */
export function SistemaPage() {
  const user = useAuthStore((state) => state.user);
  if (user && user.role !== "SUPER_ADMIN") {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Superadministración
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Sistema</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Gestiona los periodos académicos y las carreras de la institución. Cada cambio se aplica al
          instante y queda registrado en la auditoría.
        </p>
      </header>

      <PeriodsSection />
      <CareersSection />
    </div>
  );
}

// --- Academic periods -----------------------------------------------------------------------------

function PeriodsSection() {
  const periods = useAcademicPeriods();
  const institutions = useInstitutions();
  const createPeriod = useCreateAcademicPeriod();
  const updatePeriod = useUpdateAcademicPeriod();

  const [editing, setEditing] = useState<AcademicPeriod | null>(null);
  const [creating, setCreating] = useState(false);
  const institutionId = institutions.data?.[0]?.id;

  async function setCurrent(period: AcademicPeriod) {
    try {
      await updatePeriod.mutateAsync({ id: period.id, patch: { is_current: true } });
      toast.success(`“${period.name}” es ahora el periodo actual.`);
    } catch (error) {
      toast.error(message(error, "No se pudo actualizar."));
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Periodos académicos</h2>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} disabled={!institutionId}>
          <Plus /> Nuevo periodo
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/55 shadow-sm">
        {periods.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (periods.data ?? []).length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aún no hay periodos académicos.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(periods.data ?? []).map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.code}</TableCell>
                  <TableCell>{period.name}</TableCell>
                  <TableCell className="text-muted-foreground">{period.starts_on ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{period.ends_on ?? "—"}</TableCell>
                  <TableCell>
                    {period.is_current ? (
                      <Badge
                        variant="outline"
                        className="bg-background/50 font-normal text-emerald-600 dark:text-emerald-400"
                      >
                        Actual
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {!period.is_current && (
                        <Button variant="outline" size="sm" onClick={() => void setCurrent(period)}>
                          Marcar actual
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(period)}
                        aria-label={`Editar ${period.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PeriodDialog
        open={creating || editing !== null}
        period={editing}
        pending={createPeriod.isPending || updatePeriod.isPending}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={async (values) => {
          try {
            if (editing) {
              await updatePeriod.mutateAsync({ id: editing.id, patch: values });
              toast.success("Periodo actualizado.");
            } else if (institutionId) {
              await createPeriod.mutateAsync({ institution_id: institutionId, ...values });
              toast.success("Periodo creado.");
            }
            setCreating(false);
            setEditing(null);
          } catch (error) {
            toast.error(message(error, "No se pudo guardar el periodo."));
          }
        }}
      />
    </section>
  );
}

function PeriodDialog({
  open,
  period,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  period: AcademicPeriod | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    code: string;
    name: string;
    starts_on: string | null;
    ends_on: string | null;
    is_current: boolean;
  }) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);

  const [lastId, setLastId] = useState<string | null>(null);
  const currentId = period?.id ?? null;
  if (open && currentId !== lastId) {
    setLastId(currentId);
    setCode(period?.code ?? "");
    setName(period?.name ?? "");
    setStartsOn(period?.starts_on ?? "");
    setEndsOn(period?.ends_on ?? "");
    setIsCurrent(period?.is_current ?? false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{period ? "Editar periodo" : "Nuevo periodo"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              code: code.trim(),
              name: name.trim(),
              starts_on: startsOn || null,
              ends_on: endsOn || null,
              is_current: isCurrent,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="period-code">Código</Label>
              <Input
                id="period-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="2025-A"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-name">Nombre</Label>
              <Input
                id="period-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Semestre 2025-A"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="period-start">Inicio</Label>
              <Input
                id="period-start"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">Fin</Label>
              <Input
                id="period-end"
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(event) => setIsCurrent(event.target.checked)}
              className="size-4 rounded border-border"
            />
            Marcar como periodo actual
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending || !code.trim() || !name.trim()}>
              {pending && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Careers --------------------------------------------------------------------------------------

function CareersSection() {
  const careers = useCareers();
  const updateCareer = useUpdateCareer();
  const [editing, setEditing] = useState<Career | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Carreras</h2>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/55 shadow-sm">
        {careers.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (careers.data ?? []).length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aún no hay carreras registradas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrera</TableHead>
                <TableHead>Título que otorga</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(careers.data ?? []).map((career) => (
                <TableRow key={career.id}>
                  <TableCell className="font-medium">{career.name}</TableCell>
                  <TableCell className="text-muted-foreground">{career.degree_title}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(career)}
                        aria-label={`Editar ${career.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CareerDialog
        career={editing}
        pending={updateCareer.isPending}
        onClose={() => setEditing(null)}
        onSubmit={async (values) => {
          if (!editing) return;
          try {
            await updateCareer.mutateAsync({ id: editing.id, patch: values });
            toast.success("Carrera actualizada.");
            setEditing(null);
          } catch (error) {
            toast.error(message(error, "No se pudo actualizar la carrera."));
          }
        }}
      />
    </section>
  );
}

function CareerDialog({
  career,
  pending,
  onClose,
  onSubmit,
}: {
  career: Career | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; degree_title: string }) => void;
}) {
  const [name, setName] = useState("");
  const [degree, setDegree] = useState("");

  const [lastId, setLastId] = useState<string | null>(null);
  const currentId = career?.id ?? null;
  if (career && currentId !== lastId) {
    setLastId(currentId);
    setName(career.name);
    setDegree(career.degree_title);
  }

  return (
    <Dialog open={career !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar carrera</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ name: name.trim(), degree_title: degree.trim() });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="career-name">Nombre</Label>
            <Input
              id="career-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="career-degree">Título que otorga</Label>
            <Input
              id="career-degree"
              value={degree}
              onChange={(event) => setDegree(event.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim() || !degree.trim()}>
              {pending && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
