import { apiClient } from "@/lib/api/client";

/** Study resources (recursos) contract. Files live in MinIO; only metadata is returned here. */

export type ResourceKind = "PDF" | "IMAGE" | "MARKDOWN" | "TEXT" | "OFFICE" | "LINK";
export type ResourceStatus =
  | "PERSONAL"
  | "COMMUNITY_PENDING"
  | "COMMUNITY_VERIFIED"
  | "ADMIN_VERIFIED"
  | "REJECTED"
  | "ARCHIVED";
export type Contribution = "APORTE_1" | "APORTE_2";
export type ResourceVisibility = "PRIVATE" | "COMMUNITY" | "PUBLIC";

export interface ResourceListItem {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  tema: string | null;
  kind: ResourceKind;
  contribution: Contribution | null;
  status: ResourceStatus;
  visibility: ResourceVisibility;
  approval_count: number;
  professor_id: string | null;
  professor_name: string | null;
  academic_period_id: string | null;
  academic_period_code: string | null;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  external_url: string | null;
  created_by_user_id: string | null;
  is_owner: boolean;
  created_at: string;
}

export interface ResourceDetail extends ResourceListItem {
  course_code: string | null;
  course_name: string | null;
  can_moderate: boolean;
  download_url: string | null;
}

export interface ResourceCreateOut {
  id: string;
  status: ResourceStatus;
  kind: ResourceKind;
}

export interface ResourceFilters {
  course_id?: string;
  academic_period_id?: string;
  professor_id?: string;
  contribution?: Contribution;
  kind?: ResourceKind;
  tema?: string;
  mine?: boolean;
}

export interface FileResourceInput {
  file: File;
  course_id: string;
  title: string;
  description?: string;
  tema?: string;
  contribution?: Contribution;
  professor_id?: string;
  academic_period_id?: string;
  visibility?: ResourceVisibility;
}

export interface LinkResourceInput {
  course_id: string;
  title: string;
  external_url: string;
  description?: string;
  tema?: string;
  contribution?: Contribution;
  professor_id?: string;
  academic_period_id?: string;
  visibility?: ResourceVisibility;
}

export interface CourseOption {
  id: string;
  code: string;
  name: string;
}

/** Search catalog courses (materias) by code or name. */
export async function searchCourses(query: string): Promise<CourseOption[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await apiClient.get<CourseOption[]>("/courses/search", { params: { q } });
  return data;
}

export async function listResources(filters: ResourceFilters): Promise<ResourceListItem[]> {
  const { data } = await apiClient.get<ResourceListItem[]>("/resources", { params: filters });
  return data;
}

export async function getResource(id: string): Promise<ResourceDetail> {
  const { data } = await apiClient.get<ResourceDetail>(`/resources/${id}`);
  return data;
}

export async function createFileResource(
  input: FileResourceInput,
  onProgress?: (fraction: number) => void,
): Promise<ResourceCreateOut> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("course_id", input.course_id);
  form.append("title", input.title);
  if (input.description) form.append("description", input.description);
  if (input.tema) form.append("tema", input.tema);
  if (input.contribution) form.append("contribution", input.contribution);
  if (input.professor_id) form.append("professor_id", input.professor_id);
  if (input.academic_period_id) form.append("academic_period_id", input.academic_period_id);
  form.append("visibility", input.visibility ?? "COMMUNITY");

  // The shared client pins Content-Type to JSON; override so the browser sets the multipart
  // boundary. The auth interceptor still attaches the Bearer token.
  const { data } = await apiClient.post<ResourceCreateOut>("/resources", form, {
    headers: { "Content-Type": undefined },
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(event.loaded / event.total);
    },
  });
  return data;
}

export async function createLinkResource(input: LinkResourceInput): Promise<ResourceCreateOut> {
  const { data } = await apiClient.post<ResourceCreateOut>("/resources/links", input);
  return data;
}

export async function updateResource(
  id: string,
  patch: Partial<Pick<LinkResourceInput, "title" | "description" | "tema" | "contribution" | "professor_id" | "academic_period_id">>,
): Promise<ResourceCreateOut> {
  const { data } = await apiClient.patch<ResourceCreateOut>(`/resources/${id}`, patch);
  return data;
}

export async function voteResource(
  id: string,
  vote: "APPROVE" | "REJECT" = "APPROVE",
): Promise<{ resource_id: string; status: ResourceStatus; approval_count: number }> {
  const { data } = await apiClient.post(`/resources/${id}/vote`, { vote });
  return data;
}

/**
 * Fetch the raw bytes of a file resource through the same-origin proxy (Bearer attached),
 * returning an object URL usable in <img>/<iframe> plus the blob for text extraction / download.
 * Same-origin avoids any MinIO CORS configuration.
 */
export async function fetchResourceBlob(id: string): Promise<{ url: string; blob: Blob }> {
  const { data } = await apiClient.get<Blob>(`/resources/${id}/content`, {
    responseType: "blob",
  });
  return { url: URL.createObjectURL(data), blob: data };
}

// --- Admin moderation -----------------------------------------------------------------------------

export async function listPendingResources(): Promise<ResourceListItem[]> {
  const { data } = await apiClient.get<ResourceListItem[]>("/admin/resources");
  return data;
}

export async function approveResource(id: string): Promise<ResourceCreateOut> {
  const { data } = await apiClient.post<ResourceCreateOut>(`/admin/resources/${id}/approve`);
  return data;
}

export async function rejectResource(id: string): Promise<ResourceCreateOut> {
  const { data } = await apiClient.post<ResourceCreateOut>(`/admin/resources/${id}/reject`);
  return data;
}

export async function deleteResource(id: string): Promise<void> {
  await apiClient.delete(`/admin/resources/${id}`);
}
