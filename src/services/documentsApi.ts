import { supabase } from "../integrations/supabase/client";

export type ProjectDocType =
  | "project_brief" | "functional_spec" | "technical_spec" | "supplier_brief"
  | "client_proposal" | "internal_planning" | "implementation_checklist"
  | "meeting_summary" | "change_request";

export type ProjectDocumentAudience = "agency" | "client" | "supplier";

export type ProjectDocument = {
  id: string;
  project_id: string;
  document_type: ProjectDocType;
  audience: ProjectDocumentAudience;
  language: string;
  version: number;
  status: "draft" | "published" | "signed" | "superseded";
  markdown: string;
  created_at: string;
};

export async function listProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from("project_documents")
    .select("id, project_id, document_type, audience, language, version, status, markdown, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectDocument[];
}

export async function generateProjectDocument(input: {
  projectId: string;
  docType: ProjectDocType;
  language: string;
  notes?: string;
  audience?: ProjectDocumentAudience;
}): Promise<{ markdown: string; document: ProjectDocument }> {
  const { data, error } = await supabase.functions.invoke("project-documents", { body: input });
  if (error) {
    const response = (error as any)?.context as Response | undefined;
    if (response && typeof response.json === "function") {
      try {
        const body = await response.clone().json();
        if (body?.error) throw new Error(String(body.error));
      } catch (parseError) {
        if (parseError instanceof Error && !/JSON/i.test(parseError.message)) throw parseError;
      }
    }
    throw new Error(error.message);
  }
  if (data && typeof data === "object" && "error" in data && (data as any).error) {
    throw new Error(String((data as any).error));
  }
  return data as { markdown: string; document: ProjectDocument };
}
