import { Loader2, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import type { AdminUser, UserRole, UserStatus } from "../api";
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUserRole,
  useUpdateUserStatus,
  useUsers,
} from "../hooks";

const ROLE_LABEL: Record<UserRole, string> = {
  STUDENT: "Estudiante",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Superadmin",
};

const STATUS_META: Record<UserStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Activo", className: "text-emerald-600 dark:text-emerald-400" },
  SUSPENDED: { label: "Suspendido", className: "text-amber-600 dark:text-amber-400" },
  DELETED: { label: "Eliminado", className: "text-muted-foreground" },
};

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const usersQuery = useUsers();
  const createUser = useCreateUser();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  // Client-side gate; the API is the real authority (require_super_admin on every endpoint).
  if (currentUser && currentUser.role !== "SUPER_ADMIN") {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function changeRole(user: AdminUser, role: UserRole) {
    try {
      await updateRole.mutateAsync({ id: user.id, role });
      toast.success(`${user.email} ahora es ${ROLE_LABEL[role].toLowerCase()}.`);
    } catch (error) {
      toast.error(message(error, "No se pudo cambiar el rol."));
    }
  }

  async function toggleStatus(user: AdminUser) {
    const next = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await updateStatus.mutateAsync({ id: user.id, status: next });
      toast.success(next === "ACTIVE" ? "Cuenta reactivada." : "Cuenta suspendida.");
    } catch (error) {
      toast.error(message(error, "No se pudo cambiar el estado."));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteUser.mutateAsync(toDelete.id);
      toast.success("Cuenta eliminada.");
      setToDelete(null);
    } catch (error) {
      toast.error(message(error, "No se pudo eliminar la cuenta."));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Superadministración
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Usuarios y roles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Crea administradores, cambia roles y suspende cuentas. No puedes modificar tu propia
            cuenta ni dejar al sistema sin un superadministrador activo.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus /> Crear usuario
        </Button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/55 shadow-sm">
        {usersQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Correo</TableHead>
                <TableHead className="w-44">Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usersQuery.data ?? []).map((user) => {
                const isSelf = currentUser?.id === user.id;
                const isDeleted = user.status === "DELETED";
                const locked = isSelf || isDeleted;
                return (
                  <TableRow key={user.id} className={cn(isDeleted && "opacity-50")}>
                    <TableCell>
                      <div className="font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.is_verified ? "Verificado" : "Sin verificar"}
                        {isSelf && " · Tú"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => void changeRole(user, value as UserRole)}
                        disabled={locked || updateRole.isPending}
                      >
                        <SelectTrigger className="h-9 bg-background/70">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABEL) as UserRole[]).map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("bg-background/50 font-normal", STATUS_META[user.status].className)}
                      >
                        {STATUS_META[user.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {!isDeleted && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void toggleStatus(user)}
                            disabled={locked || updateStatus.isPending}
                          >
                            {user.status === "ACTIVE" ? "Suspender" : "Reactivar"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(user)}
                          disabled={locked}
                          aria-label={`Eliminar ${user.email}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        pending={createUser.isPending}
        onCreate={async (input) => {
          try {
            await createUser.mutateAsync(input);
            toast.success("Usuario creado.");
            setCreateOpen(false);
          } catch (error) {
            toast.error(message(error, "No se pudo crear el usuario."));
          }
        }}
      />

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              Se marcará <span className="font-medium">{toDelete?.email}</span> como eliminada. Su
              historial se conserva, pero no podrá iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  pending,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onCreate: (input: { email: string; password: string; role: UserRole }) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ADMIN");

  function reset() {
    setEmail("");
    setPassword("");
    setRole("ADMIN");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" /> Crear usuario
          </DialogTitle>
          <DialogDescription>
            La cuenta queda verificada al crearse. Usa un correo institucional @epn.edu.ec.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate({ email: email.trim(), password, role });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">Correo</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="persona@epn.edu.ec"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Contraseña</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
