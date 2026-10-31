import { Link } from "react-router-dom";
import { ArrowUpRight, Filter, RefreshCw } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { useAuditDetail } from "../../lib/auditData";
import {
  auditActionLabel,
  auditEntityLabel,
  auditTime,
  auditCategories,
  auditChanges,
  auditFieldLabel,
  auditValue,
  auditLinks,
  type AuditRow,
} from "../../lib/auditWorkspace";
export function AuditDetailDialog({
  id,
  onClose,
  onFilter,
}: {
  id: string;
  onClose: () => void;
  onFilter: (f: Record<string, string | null>) => void;
}) {
  const { data: d, loading, error, load } = useAuditDetail(id);
  const changes = auditChanges(d?.details),
    links = d ? auditLinks(d) : [];
  const actor =
    d?.actor?.name ||
    d?.actor?.email ||
    (d?.user_id ? "Akun tidak tersedia" : "Pelaku tidak tercatat");
  const entries =
    d?.details && typeof d.details === "object" && !Array.isArray(d.details)
      ? Object.entries(d.details)
      : [];
  return (
    <Dialog
      title="Detail aktivitas"
      onClose={onClose}
      className="audit-detail-dialog"
    >
      {loading ? (
        <p role="status">Memuat detail aktivitas…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        d && (
          <>
            <div className="audit-detail-title">
              <span className={`audit-badge audit-${d.category}`}>
                {auditCategories[d.category]}
              </span>
              <h3>{auditActionLabel(d.action)}</h3>
              <span>{auditTime(d.created_at)}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void load()}
                aria-label="Muat ulang detail audit"
              >
                <RefreshCw size={16} />
              </Button>
            </div>
            <Tabs defaultValue="summary">
              <TabsList aria-label="Bagian detail audit">
                <TabsTrigger value="summary">Ringkasan</TabsTrigger>
                <TabsTrigger value="payload">Data tercatat</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="audit-detail-section">
                <dl className="audit-facts">
                  <div>
                    <dt>Pelaku</dt>
                    <dd>{actor}</dd>
                    {d.actor?.email && d.actor.name && (
                      <small>{d.actor.email}</small>
                    )}
                  </div>
                  <div>
                    <dt>Objek</dt>
                    <dd>{auditEntityLabel(d.entity_type)}</dd>
                    {d.context.name && <small>{d.context.name}</small>}
                  </div>
                  <div>
                    <dt>Kode aktivitas</dt>
                    <dd>
                      <code>{d.action}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>ID audit</dt>
                    <dd>
                      <code>{d.id}</code>
                    </dd>
                  </div>
                </dl>
                <div className="audit-context-actions">
                  {d.actor && (
                    <Button asChild variant="outline" size="sm">
                      <Link to={"/system/pengguna?user=" + d.actor.id}>
                        Akun pelaku
                        <ArrowUpRight size={14} />
                      </Link>
                    </Button>
                  )}
                  {d.user_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onFilter({ actor: d.user_id })}
                    >
                      <Filter size={14} />
                      Aktivitas pelaku
                    </Button>
                  )}
                  {d.entity_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onFilter({ target: d.entity_id, entity: d.entity_type })
                      }
                    >
                      <Filter size={14} />
                      Riwayat objek
                    </Button>
                  )}
                </div>
                {changes.length > 0 && (
                  <section>
                    <h4>Perubahan tercatat</h4>
                    <div className="audit-change-table">
                      <div className="audit-change-head">
                        <span>Kolom</span>
                        <span>Sebelumnya</span>
                        <span>Sesudahnya</span>
                      </div>
                      {changes.map((c) => (
                        <div key={c.key}>
                          <strong>{auditFieldLabel(c.key)}</strong>
                          <pre>{c.before}</pre>
                          <pre>{c.after}</pre>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {entries.length > 0 ? (
                  <dl className="audit-payload-fields">
                    {entries
                      .filter(
                        ([key]) =>
                          !changes.length ||
                          ![
                            "previous",
                            "current",
                            "old",
                            "new",
                            "old_data",
                            "new_data",
                          ].includes(key),
                      )
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{auditFieldLabel(key)}</dt>
                          <dd>
                            <pre>{auditValue(value)}</pre>
                          </dd>
                        </div>
                      ))}
                  </dl>
                ) : d.details != null ? (
                  <pre className="audit-json">{auditValue(d.details)}</pre>
                ) : (
                  <p className="audit-muted">
                    Tidak ada detail tambahan pada catatan ini.
                  </p>
                )}
                {links.length > 0 ? (
                  <section className="audit-related">
                    <h4>Data terkait saat ini</h4>
                    <div>
                      {links.map((l) => (
                        <Button
                          key={l.href}
                          asChild
                          size="sm"
                          variant="outline"
                        >
                          <Link to={l.href}>
                            {l.label}
                            <ArrowUpRight size={14} />
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </section>
                ) : (
                  <p className="audit-muted">
                    Tautan objek saat ini tidak tersedia. Catatan audit tetap
                    tersimpan.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="payload" className="audit-detail-section">
                <p className="audit-muted">
                  Kredensial yang dikenali disamarkan. Nilai lama hanya tersedia
                  jika dicatat saat kejadian.
                </p>
                <dl className="audit-facts">
                  <div>
                    <dt>ID pelaku</dt>
                    <dd>
                      <code>{d.user_id ?? "Tidak tercatat"}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>ID objek</dt>
                    <dd>
                      <code>{d.entity_id ?? "Tidak tercatat"}</code>
                    </dd>
                  </div>
                </dl>
                <pre className="audit-json">
                  {JSON.stringify(d.details, null, 2) ??
                    "Tidak ada detail tambahan."}
                </pre>
              </TabsContent>
            </Tabs>
          </>
        )
      )}
    </Dialog>
  );
}
export function AuditActivityBadge({
  row,
}: {
  row: Pick<AuditRow, "category" | "action">;
}) {
  return (
    <span className={`audit-badge audit-${row.category}`}>
      {auditActionLabel(row.action)}
    </span>
  );
}
