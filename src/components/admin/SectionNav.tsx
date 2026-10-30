import type { ComponentType } from "react";

export function SectionNav<T extends string>({ items, value, onChange, label }: {
  items: Array<{ key: T; label: string; icon: ComponentType<{ className?: string }> }>;
  value: T; onChange: (value: T) => void; label: string;
}) {
  return <nav className="admin-section-nav" aria-label={label}>
    {items.map(({ key, label: title, icon: Icon }) => <button key={key} type="button"
      aria-current={value === key ? "page" : undefined} onClick={() => onChange(key)}>
      <Icon className="h-4 w-4" aria-hidden="true" />{title}
    </button>)}
  </nav>;
}
