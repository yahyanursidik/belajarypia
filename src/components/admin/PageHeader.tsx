import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, actions }: { title: string; eyebrow?: string; actions?: ReactNode }) {
  return <header className="admin-page-header">
    <div>{eyebrow && <p className="admin-page-eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>
    {actions && <div className="admin-page-actions">{actions}</div>}
  </header>;
}
