import { supabase } from "../integrations/supabase/client";

export type ProjectFile = {
  id: string;
  projectId: string;
  title: string;
  path: string;
  fileType: string;
  createdAt: string;
};

const BUCKET = "project-files";

function safeName(name: string) {
  return name.replace(/[^\w.\-\u0590-\u05FF ]+/g, "_").slice(-80);
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from("files")
    .select("id, project_id, title, url, file_type, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    title: (row.title as string) ?? "",
    path: (row.url as string) ?? "",
    fileType: (row.file_type as string) ?? "",
    createdAt: row.created_at as string,
  }));
}

/** Uploads one document to the project's private storage folder and registers it. */
export async function uploadProjectFile(projectId: string, file: File): Promise<ProjectFile> {
  const path = `${projectId}/${Date.now()}-${safeName(file.name)}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);

  const { data, error } = await supabase
    .from("files")
    .insert({
      project_id: projectId,
      title: file.name,
      url: path,
      file_type: file.type || "file",
      visibility: "client_visible",
      added_by: "client",
    })
    .select("id, project_id, title, url, file_type, created_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id as string,
    projectId: data.project_id as string,
    title: data.title as string,
    path: data.url as string,
    fileType: data.file_type as string,
    createdAt: data.created_at as string,
  };
}

/** Short-lived link so the client can reopen a document they uploaded. */
export async function getProjectFileLink(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}