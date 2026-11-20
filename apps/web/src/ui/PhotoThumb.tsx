import { useEffect, useState } from "react";
import type { DraftPhoto } from "../core/report-draft";

// Shows a photo kept in the draft. The temporary address is released when the photo leaves the screen.
export function PhotoThumb({ photo, alt }: { photo: DraftPhoto; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return; // not available in every test environment
    const objectUrl = URL.createObjectURL(new Blob([photo.bytes], { type: photo.contentType }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  return url ? <img src={url} alt={alt} width={96} height={96} /> : <span className="thumb-placeholder">{alt}</span>;
}
