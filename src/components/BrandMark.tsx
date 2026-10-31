import { useState, type ReactNode } from "react";
import { validAssetUrl } from "../lib/settingsWorkspace";
export function BrandMark({
  src,
  fallback,
  allowBlob = false,
}: {
  src?: string | null;
  fallback: ReactNode;
  allowBlob?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return src &&
    src !== failed &&
    (validAssetUrl(src) || (allowBlob && src.startsWith("blob:"))) ? (
    <img
      className="system-brand-image"
      src={src}
      alt=""
      onError={() => setFailed(src)}
    />
  ) : (
    <>{fallback}</>
  );
}
