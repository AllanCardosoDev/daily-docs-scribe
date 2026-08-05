import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileText,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
} from "lucide-react";
import type { SheetsData } from "@/lib/sheets.types";
import type { PdfQuality } from "@/lib/export-pdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: SheetsData | undefined;
  reportDate: Date | null;
  quality?: PdfQuality;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/**
 * WYSIWYG report preview. We render the exact same jsPDF document with
 * pdfjs-dist onto a canvas per page, so the modal previews render even
 * when the browser can't (or the sandbox iframe won't) show a PDF via
 * an <iframe src="blob:...">. Includes page navigation and zoom.
 */
export function ReportPreviewDialog({
  open,
  onOpenChange,
  data,
  reportDate,
  quality = "standard",
}: Props) {
  const [status, setStatus] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(2); // 1.0
  const [filename, setFilename] = useState("relatorio.pdf");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const docRef = useRef<any>(null);
  const pdfRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const key = useMemo(() => {
    if (!open || !data) return "";
    // Hash do conteúdo (não apenas o tamanho): duas edições de mesmo
    // comprimento também invalidam a pré-visualização.
    const json = JSON.stringify(data);
    let h = 0;
    for (let i = 0; i < json.length; i++) h = (Math.imul(31, h) + json.charCodeAt(i)) | 0;
    return `${reportDate?.toISOString() ?? "none"}-${quality}-${json.length}-${h}`;
  }, [open, data, reportDate, quality]);

  // Build the PDF and load it into pdf.js when the dialog opens or inputs change.
  useEffect(() => {
    if (!open || !data) return;
    let cancelled = false;
    let currentUrl: string | null = null;

    setStatus("building");
    setError(null);
    setPageCount(0);
    setPageIndex(1);

    (async () => {
      try {
        const [{ buildSheetsPdfDoc, reportFilename }, pdfjs] = await Promise.all([
          import("@/lib/export-pdf"),
          import("pdfjs-dist"),
        ]);

        // Point pdf.js at its bundled worker (Vite-compatible URL import).
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

        const doc = buildSheetsPdfDoc(data, reportDate, quality);
        docRef.current = doc;
        const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
        // Keep a blob url for "open in new tab" fallback / download.
        currentUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: "application/pdf" }));

        const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          (pdf as any).destroy?.();
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return;
        }
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setPageIndex(1);
        setFilename(reportFilename(reportDate));
        setBlobUrl(currentUrl);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error)?.message ?? "Falha ao gerar a pré-visualização.");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      renderTaskRef.current = null;
      pdfRef.current?.destroy?.();
      pdfRef.current = null;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Reset when closed.
  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setError(null);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      docRef.current = null;
      pdfRef.current?.destroy?.();
      pdfRef.current = null;
    }
  }, [open]);

  // Render current page whenever page/zoom changes.
  useEffect(() => {
    if (status !== "ready" || !pdfRef.current || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        renderTaskRef.current?.cancel?.();
        const page = await pdfRef.current.getPage(pageIndex);
        if (cancelled) return;

        const scale = ZOOM_STEPS[zoomIdx] ?? 1;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        const task = page.render({ canvasContext: ctx, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException" && !cancelled) {
          console.error("[ReportPreview] render error", e);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [status, pageIndex, zoomIdx, pageCount]);

  const handleDownload = useCallback(() => {
    if (!docRef.current) return;
    docRef.current.save(filename);
  }, [filename]);

  const openInNewTab = useCallback(() => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }, [blobUrl]);

  const canPrev = pageIndex > 1;
  const canNext = pageIndex < pageCount;
  const canZoomIn = zoomIdx < ZOOM_STEPS.length - 1;
  const canZoomOut = zoomIdx > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-[100dvh] sm:max-w-[96vw] sm:w-[96vw] sm:h-[92dvh] p-0 gap-0 flex flex-col overflow-hidden rounded-none sm:rounded-2xl">
        <DialogHeader className="px-3 sm:px-5 py-3 border-b bg-card/95 backdrop-blur flex flex-col items-start gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2 font-display">
              <FileText className="w-4 h-4 shrink-0 text-primary" />
              Pré-visualização do relatório
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Fidelidade WYSIWYG — o que você vê é exatamente o PDF que será baixado.
            </DialogDescription>
          </div>
          <div className="flex w-full items-center gap-2 shrink-0 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button
              variant="outline"
              onClick={openInNewTab}
              disabled={status !== "ready" || !blobUrl}
              className="h-9"
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-4 h-4 mr-2 shrink-0" /> Abrir
            </Button>
            <Button
              onClick={handleDownload}
              disabled={status !== "ready"}
              className="h-9 hover-lift shadow-elevated"
            >
              <Download className="w-4 h-4 mr-2 shrink-0" /> Baixar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Toolbar: pagination + zoom */}
        <div className="px-3 sm:px-5 py-2 border-b bg-muted/50 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
              disabled={!canPrev || status !== "ready"}
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1 text-foreground">
              <span>Página</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, pageCount)}
                value={pageIndex}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    setPageIndex(Math.min(Math.max(1, Math.floor(n)), Math.max(1, pageCount)));
                  }
                }}
                className="w-14 h-8 rounded-md border border-border bg-background px-2 text-center text-sm"
                disabled={status !== "ready"}
              />
              <span className="text-muted-foreground">de {pageCount || "—"}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageIndex((p) => Math.min(pageCount, p + 1))}
              disabled={!canNext || status !== "ready"}
              aria-label="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
              disabled={!canZoomOut || status !== "ready"}
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="tabular-nums text-foreground w-14 text-center">
              {Math.round((ZOOM_STEPS[zoomIdx] ?? 1) * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoomIdx((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
              disabled={!canZoomIn || status !== "ready"}
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-muted relative overflow-auto">
          {status === "building" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Renderizando pré-visualização…</p>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-700 px-6 text-center">
              <AlertTriangle className="w-6 h-6" />
              <p className="text-sm font-medium">Não foi possível gerar a pré-visualização.</p>
              {error && <p className="text-xs text-red-600 max-w-md">{error}</p>}
            </div>
          )}
          {status === "ready" && (
            <div className="flex justify-center py-4 px-2 sm:py-6 sm:px-4">
              <canvas ref={canvasRef} className="bg-white shadow-elevated rounded-sm" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
