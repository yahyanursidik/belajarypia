import { useState } from "react";
import { Button } from "../ui/button";
export function LearnerReadingContent({
  body,
  format,
  title,
}: {
  body: string;
  format?: string | null;
  title: string;
}) {
  const [size, setSize] = useState(18),
    html = format === "html" || (!format && /<[a-z][\s\S]*>/i.test(body));
  return (
    <section className="student-reading-content">
      <div
        className="student-reading-controls"
        role="group"
        aria-label="Ukuran teks materi"
      >
        <span>Ukuran teks</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSize((v) => Math.max(16, v - 2))}
          disabled={size === 16}
          aria-label="Perkecil teks"
        >
          A−
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSize((v) => Math.min(24, v + 2))}
          disabled={size === 24}
          aria-label="Perbesar teks"
        >
          A+
        </Button>
      </div>
      {html ? (
        <iframe
          title={"Bacaan " + title}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={`<!doctype html><html lang="id"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'"><meta name="referrer" content="no-referrer"><style>body{font:${size}px/1.9 system-ui;color:#33443e;max-width:72ch;padding:20px;margin:0 auto;overflow-wrap:anywhere}img,table{max-width:100%;height:auto}a{color:#34765c}</style></head><body>${body}</body></html>`}
        />
      ) : (
        <div className="student-reading-text" style={{ fontSize: size }}>
          {body}
        </div>
      )}
    </section>
  );
}
