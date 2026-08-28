/** Pasta pública do Google Drive com os relatórios diários oficiais (Agosto 2026 / Recente). */
export const DEFAULT_DRIVE_FOLDER_ID = "1C77k-tUwxQXsKTyQ6VRByNa7yEmk9HZT";

/** Aceita tanto o ID quanto a URL completa da pasta. */
export function extractFolderId(input: string): string {
  const m = input.match(/folders\/([-_A-Za-z0-9]+)/);
  return (m ? m[1] : input).replace(/[^-_A-Za-z0-9]/g, "");
}
