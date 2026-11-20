import { useEffect, useState } from "react";
import type { OfficerApi } from "@asaase-ani/shared";

interface Props {
  api: OfficerApi;
  token: string;
  code: string;
  photoKey: string;
  alt: string;
}

// Officer photos need the login token, which an <img src> cannot send.
// So we download the photo ourselves and show it from a temporary in-page address.
export function AuthPhoto({ api, token, code, photoKey, alt }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    api
      .getPhoto(token, code, photoKey)
      .then((blob) => {
        if (cancelled || typeof URL.createObjectURL !== "function") return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, token, code, photoKey]);

  if (failed) return <span className="photo-frame photo-missing">{alt} could not be loaded</span>;
  if (!url) return <span className="photo-frame">Loading {alt.toLowerCase()}…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="photo-frame" title={`Open ${alt.toLowerCase()} full size`}>
      <img src={url} alt={alt} />
    </a>
  );
}
