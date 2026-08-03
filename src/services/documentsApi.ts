import { supabase } from "../integrations/supabase/client";

export type ProjectDocType =
  | "project_brief" | "functional_spec" | "technical_spec" | "supplier_brief"
  | "client_proposal" | "internal_planning" | "implementation_checklist"
  | "meeting_summary" | "change_request";

export async function generateProjectDocument(input: {
  projectId: string;
  docType: ProjectDocType;
  language: string;
  notes?: string;
}): Promise<{ markdown: string }> {
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
  return data as { markdown: string };
}