import "highlight.js/styles/github-dark.css";
import "./markdown.css";

import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { fetchResourceBlob, type ResourceKind, type ResourceListItem } from "../api";

/** Extract a YouTube video id from common URL shapes, or null. */
function youtubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface Props {
  resource: ResourceListItem;
  className?: string;
}

/** Unified, theme-aware renderer for every resource kind. */
export function ResourceViewer({ resource, className }: Props) {
  const fileKinds: ResourceKind[] = ["PDF", "IMAGE", "MARKDOWN", "TEXT", "OFFICE"];
  const isFile = fileKinds.includes(resource.kind);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isFile);

  useEffect(() => {
    if (!isFile) return;
    let revoked: string | null = null;
    let active = true;
    setLoading(true);
    setError(null);
    fetchResourceBlob(resource.id)
      .then(async ({ url, blob }) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setObjectUrl(url);
        if (resource.kind === "MARKDOWN" || resource.kind === "TEXT") {
          setText(await blob.text());
        }
      })
      .catch(() => active && setError("No se pudo cargar el recurso."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [resource.id, resource.kind, isFile]);

  const ytId = useMemo(
    () => (resource.kind === "LINK" && resource.external_url ? youtubeId(resource.external_url) : null),
    [resource.kind, resource.external_url],
  );

  if (resource.kind === "LINK") {
    if (ytId) {
      return (
        <div className={cn("aspect-video w-full overflow-hidden rounded-xl border border-border", className)}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={resource.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <a
        href={resource.external_url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/50 hover:bg-accent",
          className,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
          <ExternalLink className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{resource.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{resource.external_url}</span>
        </span>
      </a>
    );
  }

  if (loading) {
    return (
      <div className={cn("grid min-h-40 place-items-center rounded-xl border border-border bg-card/40", className)}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div className={cn("grid min-h-40 place-items-center rounded-xl border border-border bg-card/40 text-sm text-muted-foreground", className)}>
        {error ?? "Sin vista previa."}
      </div>
    );
  }

  const download = () =>
    triggerDownload(objectUrl, resource.original_filename ?? resource.title);

  if (resource.kind === "IMAGE") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <img src={objectUrl} alt={resource.title} className="mx-auto max-h-[70vh] w-auto max-w-full" />
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" /> Descargar
        </Button>
      </div>
    );
  }

  if (resource.kind === "PDF") {
    return (
      <div className={cn("space-y-2", className)}>
        <iframe
          src={objectUrl}
          title={resource.title}
          className="h-[75vh] w-full rounded-xl border border-border bg-card"
        />
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" /> Descargar
        </Button>
      </div>
    );
  }

  if (resource.kind === "MARKDOWN") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="md-body rounded-xl border border-border bg-card/40 p-5">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {text ?? ""}
          </Markdown>
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" /> Descargar
        </Button>
      </div>
    );
  }

  if (resource.kind === "TEXT") {
    return (
      <div className={cn("space-y-2", className)}>
        <pre className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-card/40 p-4 text-xs leading-5">
          <code>{text}</code>
        </pre>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4" /> Descargar
        </Button>
      </div>
    );
  }

  // OFFICE and anything else: no inline preview.
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-xl border border-border bg-card/40 p-8 text-center", className)}>
      <FileText className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Este tipo de documento no tiene vista previa. Descárgalo para abrirlo.
      </p>
      <Button variant="outline" size="sm" onClick={download}>
        <Download className="size-4" /> Descargar {resource.original_filename}
      </Button>
    </div>
  );
}
