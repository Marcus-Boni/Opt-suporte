import { useRef, useState } from 'react';
import { Paperclip, FileText, Image as ImageIcon, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtBytes, fmtDate } from '@/lib/labels';
import type { Attachment } from '@/lib/types';
import { Button, cx } from './ui';
import { toast } from '@/lib/toast';

export const MAX_MB = 5;
export const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,.csv,.xlsx,.docx';

export async function uploadFile(url: string, file: File) {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Arquivo maior que ${MAX_MB} MB.`);
  const fd = new FormData();
  fd.append('file', file);
  return api.post<Attachment>(url, fd);
}

export function AttachmentList({ items, compact }: { items: Attachment[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className={cx('grid gap-2', !compact && 'sm:grid-cols-2')}>
      {items.map((a) => {
        const isImg = a.mimeType.startsWith('image/');
        return (
          <li key={a.id}>
            <a href={`/api/v1/attachments/${a.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 hover:border-orange-300 transition-colors">
              {isImg ? <img src={`/api/v1/attachments/${a.id}`} alt="" className="size-10 rounded-sm object-cover bg-paper-3" /> : <span className="grid place-items-center size-10 rounded-sm bg-paper-3 text-ink-3">{a.mimeType === 'application/pdf' ? <FileText size={18} /> : isImg ? <ImageIcon size={18} /> : <Paperclip size={18} />}</span>}
              <span className="min-w-0"><span className="block text-sm font-semibold truncate">{a.fileName}</span><span className="block text-xs text-ink-4">{fmtBytes(a.sizeBytes)} · {a.uploadedByLabel} · {fmtDate(a.createdAt)}</span></span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function UploadButton({ url, onDone, label = 'Anexar arquivo', size = 'sm' }: { url: string; onDone: () => void; label?: string; size?: 'sm' | 'md' }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" accept={ACCEPT} className="sr-only" onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try { await uploadFile(url, file); toast.ok(`“${file.name}” anexado.`); onDone(); } catch (err) { toast.bad(err instanceof Error ? err.message : 'Falha no envio.'); } finally { setBusy(false); }
      }} />
      <Button type="button" variant="secondary" size={size} loading={busy} icon={<Upload size={15} />} onClick={() => ref.current?.click()}>{label}</Button>
    </>
  );
}
