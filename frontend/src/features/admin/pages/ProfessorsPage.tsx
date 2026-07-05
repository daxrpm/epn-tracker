import { Loader2, Pencil, Trash2, UserPlus } from "lucide-react";
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
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

import type { Professor } from "../api";
import {
  useCreateProfessor,
  useDeleteProfessor,
  useInstitutions,
  useProfessors,
  useUpdateProfessor,
} from "../hooks";

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function ProfessorsPage() {
  const user = useAuthStore((state) => state.user);
  const professors = useProfessors();
  const institutions = useInstitutions();
  const createProfessor = useCreateProfessor();
  const updateProfessor = useUpdateProfessor();
  const deleteProfessor = useDeleteProfessor();

  const [editing, setEditing] = useState<Professor | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Professor | null>(null);

  if (user && user.role === "STUDENT") {
    return <Navigate to="/app/dashboard" replace />;
  }
  const institutionId = institutions.data?.[0]?.id;

  async function toggleActive(professor: Professor) {
    try {
      await updateProfessor.mutateAsync({
        id: professor.id,
        patch: { is_active: !professor.is_active },
      });
    } catch (error) {
      toast.error(message(error, "No se pudo actualizar."));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteProfessor.mutateAsync(toDelete.id);
      toast.success("Profesor desactivado.");
      setToDelete(null);
    } catch (error) {
      toast.error(message(error, "No se pudo eliminar."));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Administración
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Profesores</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Registra y edita el catálogo de docentes de la institución.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!institutionId}>
          <UserPlus /> Crear profesor
        </Button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/55 shadow-sm">
        {professors.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (professors.data ?? []).length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            Aún no hay profesores registrados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(professors.data ?? []).map((professor) => (
                <TableRow key={professor.id} className={cn(!professor.is_active && "opacity-50")}>
                  <TableCell className="font-medium">{professor.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{professor.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "bg-background/50 font-normal",
                        professor.is_active
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {professor.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => void toggleActive(professor)}>
                        {professor.is_active ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(professor)}
                        aria-label={`Editar ${professor.full_name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setToDelete(professor)}
                        aria-label={`Eliminar ${professor.full_name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ProfessorDialog
        open={creating || editing !== null}
        professor={editing}
        pending={createProfessor.isPending || updateProfessor.isPending}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={async (values) => {
          try {
            if (editing) {
              await updateProfessor.mutateAsync({ id: editing.id, patch: values });
              toast.success("Profesor actualizado.");
            } else if (institutionId) {
              await createProfessor.mutateAsync({ institution_id: institutionId, ...values });
              toast.success("Profesor creado.");
            }
            setCreating(false);
            setEditing(null);
          } catch (error) {
            toast.error(message(error, "No se pudo guardar."));
          }
        }}
      />

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar profesor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se desactivará <span className="font-medium">{toDelete?.full_name}</span>. Sus ofertas y
            esquemas se conservan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleteProfessor.isPending}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfessorDialog({
  open,
  professor,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  professor: Professor | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { full_name: string; email: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Sync fields when the dialog opens for a specific professor (or a fresh create).
  const [lastId, setLastId] = useState<string | null>(null);
  const currentId = professor?.id ?? null;
  if (open && currentId !== lastId) {
    setLastId(currentId);
    setName(professor?.full_name ?? "");
    setEmail(professor?.email ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{professor ? "Editar profesor" : "Crear profesor"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ full_name: name.trim(), email: email.trim() || null });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="prof-name">Nombre completo</Label>
            <Input
              id="prof-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={1}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-email">Correo (opcional)</Label>
            <Input
              id="prof-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
