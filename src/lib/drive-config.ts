/** Pasta pública do Google Drive com os relatórios diários oficiais. */
export const DEFAULT_DRIVE_FOLDER_ID = "1u5dYjHeg4FnRl0HDwKJPKWxyE3sEN5RY";

/** Aceita tanto o ID quanto a URL completa da pasta. */
export function extractFolderId(input: string): string {
  const m = input.match(/folders\/([-_A-Za-z0-9]+)/);
  return (m ? m[1] : input).replace(/[^-_A-Za-z0-9]/g, "");
}
