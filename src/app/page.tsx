'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Database,
  FileText,
  FlaskConical,
  History,
  Landmark,
  Leaf,
  MapPin,
  Printer,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Wind,
  X,
} from 'lucide-react';
import { useWorkspace, type Workspace, type View } from '@/hooks/use-workspace';
import { documentText, formatNumber as fmt, renderFacts } from '@/lib/air/documents';
import { GUIDANCE, type Metric, type Snapshot } from '@/lib/air/types';

import {
  explore,
  priority,
  groupKey,
  emptyConfirmation,
  actionProgress,
  type SiteConfirmation,
} from '@/lib/air/dashboard';
import { siteKey } from '@/lib/air/analyze';
import { validTimestamp } from '@/lib/air/normalize';

const roles = [
  { name: 'Ward officer' as const, icon: Landmark, caption: 'Inspect & coordinate' },
  { name: 'Housing society' as const, icon: Building2, caption: 'Act on your premises' },
  { name: 'School' as const, icon: School, caption: 'Care for your community' },
];
const navigation: { id: View; label: string; icon: typeof Leaf }[] = [
  { id: 'desk', label: 'Action desk', icon: Activity },
  { id: 'readings', label: 'Readings & evidence', icon: Database },
  { id: 'communication', label: 'Communication', icon: FileText },
  { id: 'history', label: 'Brief history', icon: History },
];
function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-title">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function Navigation({ w }: { w: Workspace }) {
  return (
    <aside className="sidebar no-print">
      <a href="#main" className="brand">
        <span>
          <Wind size={25} />
        </span>
        Vayu<span className="brand-light">Manak</span>
        <i />
      </a>
      <nav aria-label="Workspace">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-label={label}
            className={w.view === id ? 'active' : ''}
            onClick={() => w.setView(id)}
            aria-current={w.view === id ? 'page' : undefined}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === 'history' && <small>{w.history.length}</small>}
          </button>
        ))}
      </nav>
      <div className="sidebar-context">
        <span className="sidebar-context-label"><MapPin size={14} /> LOCAL WORKSPACE</span>
        <strong>{w.context.locality}</strong>
        <p>{w.context.role}</p>
      </div>
      <div className="sidebar-accent">
        <Wind size={28} aria-hidden="true" />
        <p>Evidence. An owner.<br />A next check.</p>
        <div aria-hidden="true" />
      </div>
    </aside>
  );
}
function ContextBar({ w }: { w: Workspace }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="context-bar no-print">
      <div className="role-select" aria-label="Preparing this for">
        {roles.map(({ name, icon: Icon, caption }) => (
          <button
            key={name}
            disabled={!!w.busy}
            className={w.context.role === name ? 'selected' : ''}
            onClick={() => w.changeContext({ role: name })}
          >
            <Icon size={18} />
            <span>
              {name}
              <small>{caption}</small>
            </span>
            {w.context.role === name && <Check size={13} />}
          </button>
        ))}
      </div>
      <button
        className="context-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        Local context <ChevronRight size={15} />
      </button>
      {expanded && (
        <div className="context-fields">
          <label>
            Locality
            <input
              value={w.context.locality}
              disabled={!!w.busy}
              maxLength={120}
              onChange={(e) => w.changeContext({ locality: e.target.value })}
            />
          </label>
          <label>
            Timezone
            <input
              disabled={!!w.busy}
              value={w.context.timezone}
              onChange={(e) => w.changeContext({ timezone: e.target.value })}
            />
          </label>
          <label>
            Advisory language
            <select
              value={w.context.language}
              disabled={!!w.busy}
              onChange={(e) =>
                w.changeContext({ language: e.target.value as 'English' | 'Hindi' })
              }
            >
              <option>Hindi</option>
              <option>English</option>
            </select>
          </label>
          <label>
            Reading level
            <select
              disabled={!!w.busy}
              value={w.context.level}
              onChange={(e) =>
                w.changeContext({ level: e.target.value as 'Simple' | 'Standard' })
              }
            >
              <option>Simple</option>
              <option>Standard</option>
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
function Welcome({ w }: { w: Workspace }) {
  const upload = useRef<HTMLInputElement>(null);
  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 102400 || !/\.(csv|tsv|txt)$/i.test(file.name)) {
      w.setError('Use a CSV, TSV or TXT file up to 100 KB.');
      return;
    }
    try {
      w.changeText(await file.text(), file.name);
      w.setNotice('File loaded. Review locally or ask Gemini to interpret the table.');
      w.setView('readings');
    } catch {
      w.setError('The file could not be read. Try pasting the table.');
    }
  }
  return (
    <section className="welcome">
      <div>
        <Eyebrow>
          <span className="tiny-line" /> LOCAL EVIDENCE. MEANINGFUL ACTION.
        </Eyebrow>
        <h1>
          Cleaner air starts
          <br />
          with a <em>local decision.</em>
        </h1>
        <p>
          Turn the readings you have into a plan your team can act on. Know the evidence,
          name an owner, and check what changes.
        </p>
        <div className="welcome-actions">
          <button className="primary" disabled={!!w.busy} onClick={() => upload.current?.click()}>
            <Upload size={17} /> Upload File <ArrowRight size={17} />
          </button>
          <button disabled={!!w.busy} onClick={() => w.loadSample()}>
            <FlaskConical size={17} /> Load Sample Data
          </button>
        </div>
        <input hidden ref={upload} type="file" accept=".csv,.tsv,.txt" onChange={(e) => loadFile(e.target.files?.[0])} />
        <a className="sample-download" href="/samples/vayumanak-sample-readings.csv" download>
          Download sample readings CSV
        </a>
        <div className="welcome-caption">
          One fictional Bhopal neighbourhood. Three ways to make a difference.
        </div>
      </div>
      <div
        className="neighbourhood"
        aria-label="Illustrative demo sites, not a geographic map"
      >
        <div className="sketch-label">THE NEIGHBOURHOOD, IN FOCUS</div>
        <div className="sketch-route" />
        <div className="sketch-site school-site">
          <School size={34} />
          <span>
            School gate<small>Observe arrival conditions</small>
          </span>
        </div>
        <div className="sketch-site society-site">
          <Building2 size={34} />
          <span>
            Society entrance<small>Check onsite practices</small>
          </span>
        </div>
        <div className="sketch-site market-site">
          <Landmark size={34} />
          <span>
            Market junction<small>Prioritize a local inspection</small>
          </span>
        </div>
        <div className="sketch-caption">
          <Wind size={16} /> SMALL ACTIONS. MORE BREATHING ROOM.
        </div>
      </div>
    </section>
  );
}
function Intake({ w }: { w: Workspace }) {
  return (
    <section className="panel intake no-print">
      <div className="panel-heading">
        <SectionTitle
          number="01"
          title="Bring your local readings"
          description="Paste a table. Keep the source. Make every decision traceable."
        />
      </div>
      <label className="sr-only" htmlFor="readings">
        Paste your air-quality table
      </label>
      <textarea
        id="readings"
        disabled={!!w.busy}
        value={w.text}
        onChange={(e) => w.changeText(e.target.value)}
        spellCheck={false}
        placeholder={
          'site, pollutant, value, unit, timestamp, period, status\nPaste CSV or spreadsheet rows here…'
        }
      />
      <div className="intake-bottom">
        <span>
          {w.text ? w.label : 'CSV · TSV · TXT'}
          <small>100 KB · 500 rows · PM2.5 / PM10</small>
        </span>
        <div className="button-row">
          <button disabled={!w.text || !!w.busy} onClick={w.review}>
            <Search size={15} /> Review locally
          </button>
          <button
            className="dark-button"
            disabled={!w.text || !!w.busy || !!w.cooldown}
            onClick={() => w.generate('normalize')}
          >
            <Sparkles size={15} /> Analyze with Gemini <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <p className="privacy">
        <ShieldCheck size={13} /> Gemini interpretation sends table data to Google. Use
        environmental readings without personal identifiers.{' '}
        <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">
          Data terms ↗
        </a>
      </p>
    </section>
  );
}
function Review({ w }: { w: Workspace }) {
  const [reason, setReason] = useState('');
  const d = w.dataset;
  if (!d)
    return (
      <div className="panel empty">
        <Database size={35} />
        <h2>Every good decision starts with evidence.</h2>
        <p>Paste or upload a table above, then review its interpretation.</p>
      </div>
    );
  const usable = d.observations.filter((o) => o.included).length;
  return (
    <section className="panel review">
      <div className="panel-heading">
        <SectionTitle
          number="02"
          title="Check before you conclude"
          description="Correct an issue, explain the decision, then include the repaired row."
        />
        <span className="tag">
          {usable} included · {d.observations.length - usable} excluded
        </span>
      </div>
      {d.unaccounted && d.unaccounted.length > 0 && (
        <div className="accounting">
          <h3>Source rows need a decision</h3>
          <p>
            Gemini did not interpret lines {d.unaccounted.join(', ')}. Review their text
            below. To add them, correct the source and re-interpret; to exclude them,
            record why.
          </p>
          <pre>
            {w.text
              .split(/\r?\n/)
              .filter((_, i) => d.unaccounted!.includes(i + 1))
              .join('\n')}
          </pre>
          <label>
            Exclusion rationale
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={250}
            />
          </label>
          <button
            disabled={!reason.trim() || !!w.busy}
            onClick={() => w.excludeUnaccounted(reason)}
          >
            Record exclusion of these lines
          </button>
        </div>
      )}
      <div className="quality-strip">
        <ShieldCheck size={17} />
        <span>
          Original rows stay unchanged. Review edits are recorded separately. Expected
          coverage is unknown.
        </span>
      </div>
      <fieldset disabled={!!w.busy} className="review-fieldset">
        <div className="review-rows">
          {d.observations.map((o) => (
            <article
              className={'review-row ' + (!o.included ? 'excluded' : '')}
              key={o.id}
            >
              <div className="review-row-head">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={o.included}
                    onChange={(e) => w.editRow(o.id, { included: e.target.checked })}
                  />{' '}
                  Include line {o.line}
                </label>
                <span
                  className={
                    o.flags.some((f) => !f.startsWith('Converted')) ? 'issue' : 'ready'
                  }
                >
                  {o.flags.join(' · ') || 'Valid fields'}
                </span>
              </div>
              <div className="row-fields">
                <label>
                  Site
                  <input
                    value={o.site}
                    onChange={(e) => w.editRow(o.id, { site: e.target.value })}
                  />
                </label>
                <label>
                  Pollutant
                  <select
                    value={o.pollutant}
                    onChange={(e) => w.editRow(o.id, { pollutant: e.target.value })}
                  >
                    <option>PM2.5</option>
                    <option>PM10</option>
                    {!['PM2.5', 'PM10'].includes(o.pollutant) && (
                      <option>{o.pollutant}</option>
                    )}
                  </select>
                </label>
                <label>
                  Value
                  <input
                    type="number"
                    value={o.value ?? ''}
                    onChange={(e) =>
                      w.editRow(o.id, {
                        value: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Unit
                  <input
                    value={o.unit}
                    onChange={(e) => w.editRow(o.id, { unit: e.target.value })}
                  />
                </label>
                <label>
                  Timestamp with offset
                  <input
                    value={o.timestamp}
                    onChange={(e) => w.editRow(o.id, { timestamp: e.target.value })}
                  />
                </label>
                <label>
                  Averaging period
                  <input
                    value={o.period}
                    onChange={(e) => w.editRow(o.id, { period: e.target.value })}
                  />
                </label>
                <label>
                  Sensor status
                  <input
                    value={o.status || ''}
                    onChange={(e) => w.editRow(o.id, { status: e.target.value })}
                  />
                </label>
              </div>
              <details>
                <summary>
                  Original source & review decision <ChevronRight size={14} />
                </summary>
                <pre>{o.source}</pre>
                <p>
                  Original value: {o.originalValue ?? 'Missing'} {o.originalUnit} →
                  normalized: {o.value ?? 'Missing'} {o.unit}
                </p>
                <label>
                  Reason / verification note
                  <input
                    value={o.reason}
                    maxLength={500}
                    onChange={(e) => w.editRow(o.id, { reason: e.target.value })}
                  />
                </label>
                {o.value !== null && o.value > 1000 && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={o.outlierApproved || false}
                      onChange={(e) =>
                        w.editRow(o.id, { outlierApproved: e.target.checked })
                      }
                    />{' '}
                    I verified this unusual value and recorded a reason
                  </label>
                )}
                <p className="muted">{o.correction || 'No human correction recorded.'}</p>
              </details>
            </article>
          ))}
        </div>
      </fieldset>
      {usable === 0 && (
        <div className="accounting">
          <h3>Repair the dataset first</h3>
          <p>
            Check units, timestamps, missing values and sensor status. Re-include each
            repaired row. No hotspot will be invented from unusable data.
          </p>
        </div>
      )}
      <div className="review-confirm">
        <p>{usable} selected observations · no official AQI will be calculated</p>
        <button
          className="primary"
          disabled={!usable || !!d.unaccounted?.length || !!w.busy || !!w.cooldown}
          onClick={() => w.generate('brief')}
        >
          <CheckCircle2 size={17} /> Confirm reviewed data & generate
        </button>
      </div>
    </section>
  );
}
function Actions({ w, onEvidence }: { w: Workspace; onEvidence: (m: Metric) => void }) {
  const b = w.brief!;
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [basis, setBasis] = useState('');
  const actions = b.narrative.actions.filter(
    (a) =>
      (!owner || a.owner === owner) &&
      (!status || (b.statuses[a.id] || 'To do') === status) &&
      (!basis || (a.basis || 'Review') === basis),
  );
  const progress = actionProgress(b, actions);
  return (
    <section className="panel actions">
      <SectionTitle
        number="03"
        title="Give the next step an owner"
        description="Priorities explained. Responsibilities within your remit."
      />
      <div className="filter-grid">
        <label>
          Action owner
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">All owners</option>
            {[...new Set(b.narrative.actions.map((a) => a.owner))].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          Action status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['To do', 'In progress', 'Done'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Action evidence basis
          <select value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="">All bases</option>
            {[...new Set(b.narrative.actions.map((a) => a.basis || 'Review'))].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
      </div>
      <button
        onClick={() => {
          setOwner('');
          setStatus('');
          setBasis('');
        }}
      >
        Clear action filters
      </button>
      <p>
        {actions.length}/{b.narrative.actions.length} current actions ·{' '}
        {progress.percent === null
          ? 'Not available'
          : `${fmt(progress.percent)}% complete`}{' '}
        · self-reported; no air-quality effect proven.
      </p>
      <div
        className="segmented"
        role="img"
        aria-label={progress.counts.map((c) => `${c.status} ${c.count}`).join(', ')}
      >
        {progress.counts.map((c) => (
          <span key={c.status} style={{ flex: c.count }} />
        ))}
      </div>
      <p className="fine-print">
        {progress.counts.map((c) => `${c.status}: ${c.count}`).join(' · ')}. Archived
        follow-through is separate. These filters do not affect concentrations.
      </p>
      {!actions.length && <p role="status">No actions match these filters.</p>}
      {actions.map((a, i) => (
        <article className="action-card" key={a.id}>
          <div className="action-top">
            <span className="priority">PRIORITY {String(i + 1).padStart(2, '0')}</span>
            <span className="muted">{a.horizon}</span>
          </div>
          <h3>{a.title}</h3>
          <div className="action-place">
            <MapPin size={13} />
            {a.location || 'Local follow-up'}
            <span className="tag">{a.basis || 'Review'}</span>
          </div>
          <p>{a.rationale}</p>
          <div className="owner-line">
            <span>
              {a.owner
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </span>
            <strong>{a.owner}</strong>
          </div>
          <div className="verification">
            <Eyebrow>WHAT TO VERIFY NEXT</Eyebrow>
            <p>{a.verification}</p>
            {a.escalation && <small>{a.escalation}</small>}
          </div>
          <div className="action-controls">
            <label>
              Status
              <select
                disabled={!!b.legacyLanguage}
                value={b.statuses[a.id] || 'To do'}
                onChange={(e) => w.updateAction(a.id, e.target.value, 'statuses')}
              >
                <option>To do</option>
                <option>In progress</option>
                <option>Done</option>
              </select>
            </label>
            {a.evidence.map((id) => {
              const m = b.metrics.find((m) => m.id === id);
              return m ? (
                <button key={id} className="text-button" onClick={() => onEvidence(m)}>
                  Inspect evidence <ArrowUpRight size={14} />
                </button>
              ) : null;
            })}
            {!a.evidence.length && (
              <a href={GUIDANCE.url} target="_blank" rel="noreferrer">
                Guidance ↗
              </a>
            )}
          </div>
          <label className="note-label">
            Verification note
            <textarea
              disabled={!!b.legacyLanguage}
              value={b.notes[a.id] || ''}
              maxLength={1000}
              aria-label="Verification note"
              placeholder="What did your team check?"
              onChange={(e) => w.updateAction(a.id, e.target.value, 'notes')}
            />
          </label>
        </article>
      ))}
    </section>
  );
}
function Analytics({
  brief: b,
  onEvidence,
}: {
  brief: Snapshot;
  onEvidence: (m: Metric) => void;
}) {
  const groups = [
    ...new Map(
      b.dataset.observations.map((o) => [groupKey(o), `${o.pollutant} · ${o.period}`]),
    ).entries(),
  ];
  const [group, setGroup] = useState(groups[0]?.[0] || '');
  const [sites, setSites] = useState<string[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [confirmations, setConfirmations] = useState<Record<string, SiteConfirmation>>(
    {},
  );
  const filter = useMemo(
    () => ({ group, sites, start, end }),
    [group, sites, start, end],
  );
  const view = useMemo(() => explore(b, filter), [b, filter]);
  const [secondary, setSecondary] = useState('changes');
  const filtered =
    sites.length > 0 ||
    !!start ||
    !!end ||
    view.rows.length < b.dataset.observations.length;
  const availableSites = [
    ...new Map(
      b.dataset.observations
        .filter((o) => groupKey(o) === group)
        .map((o) => [siteKey(o.site), o.site]),
    ).entries(),
  ];
  const metrics = view.metrics;
  const highest = [...metrics].sort(
    (a, c) => c.mean - a.mean || a.site.localeCompare(c.site),
  )[0];
  const changed = [...metrics]
    .filter((m) => m.delta !== null)
    .sort((a, c) => Math.abs(c.delta!) - Math.abs(a.delta!))[0];
  const max = Math.max(1, ...metrics.flatMap((m) => [m.max, m.previous ?? 0]));
  const times = [
    ...new Set(
      view.rows.filter((o) => validTimestamp(o.timestamp)).map((o) => o.timestamp),
    ),
  ].sort((a, c) => Date.parse(a) - Date.parse(c));
  const availableTimes = [
    ...new Set(
      b.dataset.observations
        .filter((o) => groupKey(o) === group && validTimestamp(o.timestamp))
        .map((o) => o.timestamp),
    ),
  ].sort((a, c) => Date.parse(a) - Date.parse(c));
  const first = times.length ? Date.parse(times[0]) : 0;
  const last = times.length ? Date.parse(times[times.length - 1]) : first;
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        timeZone: b.context.timezone,
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [b.context.timezone],
  );
  const localTime = (t: string) => timeFormatter.format(new Date(t));
  const evidence = (m: Metric) => onEvidence(m);
  const ranked = [...metrics].sort((a, c) => {
    const pa = priority(
      a,
      metrics,
      confirmations[siteKey(a.site)] || emptyConfirmation,
    ).total;
    const pc = priority(
      c,
      metrics,
      confirmations[siteKey(c.site)] || emptyConfirmation,
    ).total;
    return (pc ?? -1) - (pa ?? -1) || c.mean - a.mean || a.site.localeCompare(c.site);
  });
  const scope = `${groups.find((g) => g[0] === group)?.[1] || 'No group'}; sites: ${
    sites.length
      ? availableSites
          .filter(([key]) => sites.includes(key))
          .map(([, name]) => name)
          .join(', ')
      : 'all supplied'
  }; time: ${start ? localTime(start) : 'full start'} → ${end ? localTime(end) : 'full end'} (${b.context.timezone})`;
  function exportView() {
    download(
      'VayuManak-exploration.txt',
      [
        'VayuManak exploration — saved brief remains unchanged',
        `Brief: ${b.id}; ${b.mode}; ${b.context.role}`,
        scope,
        `Usable ${view.usable}/${view.rows.length}; unresolved source lines ${view.unaccounted}`,
        ...metrics.map(
          (m) =>
            `${m.site}: ${fmt(m.mean)} µg/m³; range ${fmt(m.min)}–${fmt(m.max)}; n=${m.count}; ${m.delta === null ? m.comparison : `delta ${fmt(m.delta)}; ${m.comparison}`}`,
        ),
        'Inspection index: product heuristic, not a health rating. Context confirmations are local to this exploration.',
        ...ranked.map(
          (m) =>
            `${m.site}: ${JSON.stringify(priority(m, metrics, confirmations[siteKey(m.site)] || emptyConfirmation))}; rationale: ${JSON.stringify(confirmations[siteKey(m.site)] || emptyConfirmation)}`,
        ),
        'Expected monitoring coverage, sensor accuracy and causal effects remain unknown.',
      ].join('\n'),
    );
  }
  return (
    <section className="analytics" aria-label="Evidence dashboard">
      <div className="panel exploration-filters">
        <SectionTitle
          number="01"
          title="Explore the supplied evidence"
          description="One compatible pollutant and averaging group at a time. Filtering runs locally without AI calls."
        />
        <p className="scope-note">
          <strong>{filtered ? 'Filtered view' : 'Full reporting window'}</strong> ·{' '}
          {b.mode} · {view.rows.length} of {b.dataset.observations.length} supplied
          observations. Saved brief recommendations below retain their full scope.
        </p>
        <div className="filter-grid">
          <label>
            Pollutant / averaging period
            <select
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setSites([]);
                setStart('');
                setEnd('');
              }}
            >
              {groups.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observed window start
            <select value={start} onChange={(e) => setStart(e.target.value)}>
              <option value="">Full start</option>
              {availableTimes.map((t) => (
                <option key={t} value={t}>
                  {localTime(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observed window end
            <select value={end} onChange={(e) => setEnd(e.target.value)}>
              <option value="">Full end</option>
              {availableTimes.map((t) => (
                <option key={t} value={t}>
                  {localTime(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="site-filters">
          <legend>Sites · select none for all</legend>
          {availableSites.map(([key, name]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={sites.includes(key)}
                onChange={(e) =>
                  setSites(
                    e.target.checked ? [...sites, key] : sites.filter((s) => s !== key),
                  )
                }
              />
              {name}
            </label>
          ))}
        </fieldset>
        <p className="fine-print">{scope}</p>
        <div className="button-row">
          <button
            onClick={() => {
              setGroup(groups[0]?.[0] || '');
              setSites([]);
              setStart('');
              setEnd('');
            }}
          >
            Clear filters
          </button>
          <button onClick={exportView}>Export exploration</button>
        </div>
      </div>
      <div className="conclusion-strip" aria-live="polite">
        <article>
          <Eyebrow>HIGHEST SUPPLIED SITE</Eyebrow>
          <h3>{highest?.site || 'Not available'}</h3>
          <p>
            {highest
              ? `${fmt(highest.mean)} µg/m³ · n=${highest.count}`
              : 'No usable observations in scope'}
          </p>
          <small>Within selected group only</small>
        </article>
        <article>
          <Eyebrow>LARGEST MATCHED CHANGE</Eyebrow>
          <h3>
            {changed
              ? `${changed.delta! > 0 ? '+' : ''}${fmt(changed.delta!)} µg/m³`
              : 'Not comparable'}
          </h3>
          <p>
            {changed
              ? `${changed.site} · prior ${fmt(changed.previous!)} → current ${fmt(changed.mean)}; n=${changed.count} each`
              : start || end
                ? 'Partial window: reset time filters to compare'
                : 'No matched baseline in scope'}
          </p>
        </article>
        <article>
          <Eyebrow>DATA USABILITY</Eyebrow>
          <h3>{view.usability === null ? 'Not available' : `${fmt(view.usability)}%`}</h3>
          <p>
            {view.usable}/{view.rows.length} candidate observations
          </p>
          <small>
            Bookkeeping ratio; source accuracy unknown. {view.unaccounted} unaccounted
            source lines in full brief.
          </small>
        </article>
        <article>
          <Eyebrow>VERIFY NEXT</Eyebrow>
          <h3>{view.verificationSites} sites</h3>
          <p>Excluded/missing readings or unavailable comparison</p>
          <small>Counted once per site in selected scope</small>
        </article>
      </div>
      {!metrics.length && (
        <p className="panel" role="status">
          No usable observations match these filters. Clear filters or review the source;
          missing data is not zero pollution.
        </p>
      )}
      <div className="results-grid chart-grid">
        <section className="panel">
          <h2>Which site needs a closer look?</h2>
          <p>
            Observation means and ranges · {groups.find((g) => g[0] === group)?.[1]} ·
            µg/m³. Axis starts at zero.
          </p>
          {metrics.map((m, index) => (
            <button className={`metric-row site-metric-row site-color-${index % 5}`} key={m.id} onClick={() => evidence(m)}>
              <div className="metric-title">
                <strong>{m.site}</strong>
                <span>{fmt(m.mean)} µg/m³</span>
              </div>
              <svg
                viewBox="0 0 400 36"
                role="img"
                aria-label={`${m.site}: mean ${fmt(m.mean)}, range ${fmt(m.min)} to ${fmt(m.max)}, n ${m.count}`}
              >
                <rect
                  x="0"
                  y="9"
                  height="18"
                  width={(m.mean / max) * 390}
                  fill={`var(--site-color-${index % 5})`}
                />
                <line
                  x1={(m.min / max) * 390}
                  x2={(m.max / max) * 390}
                  y1="18"
                  y2="18"
                  stroke={`var(--site-color-${index % 5})`}
                  strokeWidth="5"
                />
                <circle cx={(m.mean / max) * 390} cy="18" r="6" fill={`var(--site-dot-${index % 5})`} />
              </svg>
              <span className="metric-caption">
                n={m.count} · range {fmt(m.min)}–{fmt(m.max)} ·{' '}
                {m.delta === null ? 'No comparable change' : `delta ${fmt(m.delta)}`} ·
                Inspect source ↗
              </span>
            </button>
          ))}
          <p className="fine-print">
            Scale 0–{fmt(max)} µg/m³. Bar = mean; line = range; dot = mean. User-supplied
            readings, not an official AQI.
          </p>
        </section>
        <section className="panel">
          <h2>When were readings supplied?</h2>
          <p>
            Disconnected points · {b.context.timezone}. Cadence unknown; no continuous
            monitoring implied.
          </p>
          <svg
            viewBox="0 0 500 230"
            role="img"
            aria-label="Observation timeline. Exact values and timestamps are in the expandable table below."
          >
            <line x1="35" x2="480" y1="200" y2="200" stroke="currentColor" />
            <text x="0" y="200" fontSize="11">
              0
            </text>
            <text x="0" y="18" fontSize="11">
              {fmt(max)}
            </text>
            {view.rows
              .filter((o) => o.included && o.value !== null)
              .map((o, index) => (
                <circle
                  key={o.id}
                  cx={
                    35 +
                    (last === first
                      ? 0.5
                      : (Date.parse(o.timestamp) - first) / (last - first)) *
                      440
                  }
                  cy={200 - (o.value! / max) * 180}
                  r="4"
                  fill={`var(--site-color-${index % 5})`}
                  stroke="#fffefa"
                  strokeWidth="1.5"
                >
                  <title>
                    {o.site}: {o.value} µg/m³ · {localTime(o.timestamp)}
                  </title>
                </circle>
              ))}
          </svg>
          <p className="fine-print">
            {times.length
              ? `${localTime(times[0])} → ${localTime(times[times.length - 1])}`
              : 'No timestamped readings'}
          </p>
          <details>
            <summary>Exact timeline values and source links</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Local time</th>
                    <th>µg/m³</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows
                    .filter((o) => o.included)
                    .map((o) => (
                      <tr key={o.id}>
                        <td>{o.site}</td>
                        <td>{localTime(o.timestamp)}</td>
                        <td>{o.value ?? 'Missing'}</td>
                        <td>
                          <button
                            onClick={() => {
                              const m = metrics.find((m) =>
                                m.observationIds.includes(o.id),
                              );
                              if (m) evidence(m);
                            }}
                          >
                            Line {o.line}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </div>
      <details className="panel secondary-charts">
        <summary>More evidence views: change, time matrix and quality</summary>
        <label>
          Evidence view
          <select value={secondary} onChange={(e) => setSecondary(e.target.value)}>
            <option value="changes">Matched changes</option>
            <option value="matrix">Site / observed day matrix</option>
            <option value="quality">Data quality</option>
          </select>
        </label>
        {secondary === 'changes' && (
          <>
            <h3>Prior → current · µg/m³</h3>
            {metrics.map((m) => (
              <div key={m.id}>
                <button className="metric-row" onClick={() => evidence(m)}>
                  <strong>{m.site}</strong>
                  {m.previous !== undefined && (
                    <svg
                      viewBox="0 0 400 32"
                      role="img"
                      aria-label={`Prior ${fmt(m.previous)}, current ${fmt(m.mean)}`}
                    >
                      <line
                        x1={(m.previous / max) * 390}
                        x2={(m.mean / max) * 390}
                        y1="16"
                        y2="16"
                        stroke="var(--chart-range)"
                        strokeWidth="3"
                      />
                      <circle
                        cx={(m.previous / max) * 390}
                        cy="16"
                        r="5"
                        fill="var(--chart-prior)"
                      />
                      <circle
                        cx={(m.mean / max) * 390}
                        cy="16"
                        r="5"
                        fill="var(--chart-current)"
                      />
                    </svg>
                  )}
                  <p>
                    {m.delta === null
                      ? 'No comparable change'
                      : `Prior ${fmt(m.previous!)} → current ${fmt(m.mean)}; delta ${m.delta > 0 ? '+' : ''}${fmt(m.delta)}; n=${m.count} each`}
                  </p>
                  <small>{m.comparison}</small>
                </button>
              </div>
            ))}
            <p>
              Scale 0–{fmt(max)}. Teal left/prior and forest current markers; labels state
              values. Observational change does not establish causation.
            </p>
          </>
        )}
        {secondary === 'matrix' && (
          <EvidenceMatrix rows={view.rows} timezone={b.context.timezone} />
        )}
        {secondary === 'quality' && (
          <>
            <h3>Supplied observation composition</h3>
            <div
              className="segmented"
              role="img"
              aria-label={`Usable ${view.usable}, excluded ${view.excluded}, unresolved ${view.unresolved} of ${view.rows.length}`}
            >
              {[view.usable, view.excluded, view.unresolved].map((n, i) => (
                <span key={i} style={{ flex: n }} />
              ))}
            </div>
            <p>
              Usable {view.usable} · Excluded {view.excluded} · Unresolved/missing value{' '}
              {view.unresolved} / {view.rows.length}. Expected coverage unknown.
            </p>
            <p>
              {view.unaccounted} unaccounted original source lines in full brief; these
              prevent review completion regardless of usability score.
            </p>
            <details>
              <summary>Inspect excluded / unresolved records</summary>
              {view.rows
                .filter((o) => !o.included || o.value === null)
                .map((o) => (
                  <article key={o.id} className="source-card">
                    <strong>
                      {o.site} · line {o.line}
                    </strong>
                    <pre>{o.source}</pre>
                    <p>
                      {o.reason || 'Review needed'} · {o.flags.join('; ')}
                    </p>
                  </article>
                ))}
            </details>
            <p className="fine-print">
              Reasons may overlap; reason counts are not added to the observation
              denominator.
            </p>
          </>
        )}
      </details>
      <section className="panel">
        <SectionTitle
          number="02"
          title="Why this inspection priority?"
          description="60 concentration rank + 20 confirmed sensitive context + 20 confirmed remit. Transparent product heuristics, not a validated health model."
        />
        <p>
          No total until context, remit and a written rationale are confirmed.
          Confirmation fields are temporary exploration notes; export this view to retain
          them. Ties use average rank, then site name; incomplete scores follow complete
          scores.
        </p>
        {ranked.map((m) => {
          const key = siteKey(m.site);
          const c = confirmations[key] || emptyConfirmation;
          const p = priority(m, metrics, c);
          const update = (patch: Partial<SiteConfirmation>) =>
            setConfirmations((prev) => ({
              ...prev,
              [key]: { ...(prev[key] || emptyConfirmation), ...patch },
            }));
          return (
            <details key={m.id} className={`priority-detail priority-tone-${ranked.indexOf(m) % 5}`}>
              <summary>
                <span className="priority-site"><i />{m.site}</span>
                <span className="priority-score">{p.total === null ? 'Context needed' : `${fmt(p.total)} / 100`}</span>
                <small>{p.concentration === null ? 'Single site · relative rank unavailable' : `Concentration rank ${fmt(p.concentration)} / 60`}</small>
              </summary>
              <div className="filter-grid">
                <label>
                  Confirmed sensitive-site context
                  <select
                    value={c.sensitive}
                    onChange={(e) =>
                      update({
                        sensitive: e.target.value as SiteConfirmation['sensitive'],
                      })
                    }
                  >
                    <option value="">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Action within requester remit
                  <select
                    value={c.remit}
                    onChange={(e) =>
                      update({ remit: e.target.value as SiteConfirmation['remit'] })
                    }
                  >
                    <option value="">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Site type
                  <input
                    value={c.siteType}
                    maxLength={200}
                    onChange={(e) => update({ siteType: e.target.value })}
                  />
                </label>
                <label>
                  Affected groups
                  <input
                    value={c.affectedGroups}
                    maxLength={300}
                    onChange={(e) => update({ affectedGroups: e.target.value })}
                  />
                </label>
                <label>
                  Observed local conditions
                  <input
                    value={c.conditions}
                    maxLength={500}
                    onChange={(e) => update({ conditions: e.target.value })}
                  />
                </label>
                <label>
                  Confirmation rationale
                  <textarea
                    value={c.rationale}
                    maxLength={1000}
                    onChange={(e) => update({ rationale: e.target.value })}
                  />
                </label>
              </div>
              <p>
                Rank {fmt(p.rank)} of {metrics.length}: 60 × (N − average descending rank)
                / (N − 1). Context: {c.sensitive ? p.sensitive : 'Unknown'}/20; remit:{' '}
                {c.remit ? p.remit : 'Unknown'}/20. Data usability remains a separate
                constraint.
              </p>
              <button onClick={() => evidence(m)}>Inspect {m.site} evidence</button>
            </details>
          );
        })}
        <p className="fine-print">
          This inspection queue does not measure health risk, emissions, legal urgency or
          expected benefit. Missing data requires review/repair and never receives zero
          priority.
        </p>
      </section>
      <section className="panel decision-brief">
        <div className="exploration-decision-head"><span className="decision-icon"><CheckCircle2 size={20} /></span><div><h2>Decision for this exploration</h2><p>Suggested next step from the selected evidence.</p></div></div>
        <div className="exploration-decision-list"><article className="decision-item decision-next">
          <strong>Suggested next inspection:</strong>{' '}
          {highest
            ? `${highest.site}, the highest supplied mean (${fmt(highest.mean)} µg/m³, n=${highest.count}) in this compatible group. Confirm context and remit before acting.`
            : 'Review or repair the source before ranking sites.'}
        </article><article className="decision-item decision-verify">
          <strong>Verify next:</strong> {view.verificationSites} sites have
          excluded/missing observations or no matched comparison. Review original records
          and confirm local conditions.
        </article><article className="decision-item decision-unknown">
          <strong>Unknown:</strong> expected monitoring coverage, sensor accuracy,
          exposure and intervention effects. No wardwide mean is inferred from uneven spot
          readings.
        </article></div>
      </section>
    </section>
  );
}

function EvidenceMatrix({
  rows,
  timezone,
}: {
  rows: Snapshot['dataset']['observations'];
  timezone: string;
}) {
  const day = (t: string) =>
    validTimestamp(t)
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(t))
      : 'Unknown time';
  const days = [...new Set(rows.map((o) => day(o.timestamp)))].sort();
  const sites = [...new Set(rows.map((o) => o.site))].sort();
  return (
    <>
      <h3>Observed day bins · {timezone}</h3>
      <p>
        Counts of supplied observations, including excluded records. No expected cadence
        is assumed.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Site</th>
              {days.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s}>
                <th>{s}</th>
                {days.map((d) => {
                  const cell = rows.filter((o) => o.site === s && day(o.timestamp) === d);
                  return (
                    <td key={d}>
                      {cell.length ? (
                        <details>
                          <summary>
                            {cell.length} supplied ·{' '}
                            {cell.filter((o) => !o.included).length} excluded
                          </summary>
                          {cell.map((o) => (
                            <p key={o.id}>
                              Line {o.line}: {o.value ?? 'Missing'} {o.unit} ·{' '}
                              {o.reason || o.flags.join('; ') || 'Included'}
                            </p>
                          ))}
                        </details>
                      ) : (
                        'No supplied observation'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Desk({ w, onEvidence }: { w: Workspace; onEvidence: (m: Metric) => void }) {
  const b = w.brief;
  if (!b)
    return (
      <>
        <Welcome w={w} />
        <div className="promise-row">
          <span>
            <Search size={17} /> Every finding has a source
          </span>
          <span>
            <CheckCircle2 size={17} /> Every action has an owner
          </span>
          <span>
            <History size={17} /> Every brief has a next check
          </span>
        </div>
        <Intake w={w} />
      </>
    );
  const primary = b.narrative.actions[0],
    completed = b.narrative.actions.filter((a) => b.statuses[a.id] === 'Done').length;
  return (
    <>
      <div className="brief-toolbar">
        <div>
          <Eyebrow>
            {b.mode === 'sample' ? 'FICTIONAL BHOPAL SCENARIO' : 'LOCAL ACTION BRIEF'}
          </Eyebrow>
          <h1>{b.context.locality}</h1>
          <p>
            {b.context.role} ·{' '}
            {new Date(b.created).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}{' '}
            · {b.context.timezone}
          </p>
        </div>
        <div className="button-row">
          {w.sample && (
            <button
              disabled={!!w.busy}
              onClick={() => w.loadSample(w.period === 1 ? 2 : 1)}
            >
              Explore period {w.period === 1 ? 2 : 1} <ArrowRight size={15} />
            </button>
          )}
          <button onClick={() => w.save(b)}>
            <ArrowDownToLine size={15} /> Save brief
          </button>
        </div>
      </div>
      <section className="decision-hero">
        <div className="decision-copy">
          <Eyebrow>
            <span className="pulse-dot" /> WHERE SHOULD WE ACT NEXT?
          </Eyebrow>
          <h2>{primary?.title || 'Review the preserved brief'}</h2>
          <div className="action-pills">
            {primary && <><span className="action-pill"><strong>Owner</strong>{primary.owner}</span><span className="action-pill"><strong>When</strong>{primary.horizon}</span></>}
            <span className="action-pill"><strong>Progress</strong>{completed}/{b.narrative.actions.length} done</span>
          </div>
          <p>{renderFacts(b.narrative.summary, b.metrics)}</p>
          <div className="decision-facts">
            <span>
              <MapPin size={15} />
              {primary?.location || 'Local review'}
            </span>
            <span>
              <ShieldCheck size={15} />
              Source unverified · inspection needed
            </span>
          </div>
          <button
            onClick={() => {
              const m = b.metrics.find((m) => primary?.evidence.includes(m.id));
              if (m) onEvidence(m);
              else w.setView('readings');
            }}
          >
            Follow the evidence <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="decision-aside">
          <Leaf size={34} />
          <strong>
            {completed}
            <span> / {b.narrative.actions.length}</span>
          </strong>
          <span>ACTIONS MARKED DONE</span>
          <p>
            Record the check.
            <br />
            Carry it into the next brief.
          </p>
        </div>
      </section>
      <div className="brief-at-a-glance" aria-label="Brief at a glance">
        <span className="brief-pill pill-green"><CheckCircle2 size={14} /> {b.dataset.observations.filter((o) => o.included).length} usable readings</span>
        <span className="brief-pill pill-blue"><MapPin size={14} /> {new Set(b.metrics.map((m) => m.site)).size} sites</span>
        <span className="brief-pill pill-amber"><ShieldCheck size={14} /> Coverage unknown</span>
      </div>
      <section className="brief-visual" aria-label="Reading levels by site">
        <div className="brief-visual-heading"><div><h2>Readings by site</h2><p>Mean PM2.5 · µg/m³ · observational snapshot</p></div><span className="chart-legend"><i /> Current mean</span></div>
        {b.metrics.slice().sort((a, c) => c.mean - a.mean).slice(0, 5).map((m, i) => {
          const peak = Math.max(1, ...b.metrics.map((item) => item.mean));
          return <button className="brief-bar-row" key={m.id} onClick={() => onEvidence(m)} aria-label={`Review evidence for ${m.site}`}><span>{m.site}</span><span className="brief-bar-track"><i className={`bar-tone-${i % 5}`} style={{ width: `${Math.max(4, (m.mean / peak) * 100)}%` }} /></span><strong>{fmt(m.mean)}</strong></button>;
        })}
      </section>
      <div className="brief-chart-grid">
        <section className="brief-chart-card" aria-label="Reading range by site">
          <div className="brief-visual-heading"><div><h2>Reading ranges</h2><p>Minimum to maximum · µg/m³</p></div></div>
          {b.metrics.slice(0, 5).map((m, i) => {
            const extent = Math.max(1, ...b.metrics.map((item) => item.max));
            return <div className="range-row" key={m.id}><span>{m.site}</span><span className="range-track"><i className={`range-tone-${i % 5}`} style={{ left: `${(m.min / extent) * 100}%`, width: `${Math.max(3, ((m.max - m.min) / extent) * 100)}%` }} /></span><strong>{fmt(m.min)}–{fmt(m.max)}</strong></div>;
          })}
        </section>
        <section className="brief-chart-card" aria-label="Period change by site">
          <div className="brief-visual-heading"><div><h2>Change vs prior</h2><p>Where a compatible baseline exists</p></div></div>
          {b.metrics.filter((m) => m.delta !== null).slice(0, 5).map((m, i, list) => {
            const extent = Math.max(1, ...list.map((item) => Math.abs(item.delta || 0)));
            return <div className="change-row" key={m.id}><span>{m.site}</span><span className="change-track"><i className={m.delta! > 0 ? 'change-up' : 'change-down'} style={{ width: `${Math.max(4, (Math.abs(m.delta!) / extent) * 100)}%` }} /></span><strong className={m.delta! > 0 ? 'change-label-up' : 'change-label-down'}>{m.delta! > 0 ? '+' : ''}{fmt(m.delta!)}</strong></div>;
          })}
          {!b.metrics.some((m) => m.delta !== null) && <p className="no-change-data">No compatible prior period to compare.</p>}
        </section>
        <section className="brief-chart-card action-chart-card" aria-label="Action completion">
          <div className="brief-visual-heading"><div><h2>Action progress</h2><p>Recorded status</p></div></div>
          <div className="action-progress-track"><i style={{ width: `${b.narrative.actions.length ? (completed / b.narrative.actions.length) * 100 : 0}%` }} /></div>
          <strong>{completed} of {b.narrative.actions.length} complete</strong>
          <div className="progress-dots">{b.narrative.actions.map((a, i) => <i key={a.id} className={b.statuses[a.id] === 'Done' ? 'progress-done' : `progress-tone-${i % 5}`} title={b.statuses[a.id] || 'Not started'} />)}</div>
        </section>
      </div>
      <p className="scope-note">Saved recommendations use the full reporting window. Explore filters below do not change this brief.</p>
      <Analytics key={b.id} brief={b} onEvidence={onEvidence} />
      <div className="evidence-banner">
        <ShieldCheck size={18} />
        <p>
          <strong>
            {b.dataset.observations.filter((o) => o.included).length} usable observations
          </strong>{' '}
          across {new Set(b.metrics.map((m) => m.site)).size} supplied sites.{' '}
          <strong>
            {b.dataset.observations.filter((o) => !o.included).length} excluded.
          </strong>{' '}
          Expected coverage unknown.
        </p>
        <button className="text-button" onClick={() => w.setView('readings')}>
          Review source <ArrowRight size={14} />
        </button>
      </div>
      {b.followUp && b.followUp.length > 0 && (
        <section className="panel follow-up">
          <SectionTitle
            number="↳"
            title="Carry the previous decision forward"
            description="Recorded actions and checks from the earlier brief. Status is self-reported, not independently verified."
          />
          {b.followUp.map((task) => (
            <article key={task.id} className="follow-up-row">
              <div>
                <h3>{task.title}</h3>
                <p>
                  {task.owner} · {task.location}
                </p>
                {task.note && <p>Last check: {task.note}</p>}
              </div>
              <span className="tag">{task.status}</span>
              <span className="muted">
                {b.narrative.actions.some((a) => a.id === task.id)
                  ? 'Continues in this plan'
                  : 'Retained for review; not a current recommendation'}
              </span>
            </article>
          ))}
        </section>
      )}
      <Actions key={b.id} w={w} onEvidence={onEvidence} />
      {b.narrative.findings.length > 0 && (
        <section className="panel finding-panel">
          <SectionTitle number="05" title="What the evidence supports" />
          {b.narrative.findings.map((f) => (
            <article key={f.title}>
              <h3>{f.title}</h3>
              <p>{renderFacts(f.detail, b.metrics)}</p>
              <p className="muted">{f.limitation}</p>
              <div className="button-row">
                {f.evidence.map((id) => {
                  const m = b.metrics.find((m) => m.id === id);
                  return m ? (
                    <button key={id} onClick={() => onEvidence(m)}>
                      <Search size={13} />
                      {id}
                    </button>
                  ) : null;
                })}
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="communication-cta">
        <FileText size={27} />
        <div>
          <h2>Good evidence deserves a clear message.</h2>
          <p>
            Internal notes and citizen advisories. English and Hindi. Ready for local
            review.
          </p>
        </div>
        <button className="primary" onClick={() => w.setView('communication')}>
          Prepare a message <ArrowRight size={16} />
        </button>
      </section>
    </>
  );
}
function Communication({ w }: { w: Workspace }) {
  const [kind, setKind] = useState<'citizen' | 'internal'>('citizen'),
    [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  if (!w.brief)
    return (
      <div className="panel empty">
        <FileText size={36} />
        <h2>A message grounded in local evidence.</h2>
        <p>Load the sample or generate a brief first.</p>
      </div>
    );
  const b = w.brief,
    content = documentText(b, kind, language);
  return (
    <section className="panel communication">
      <div className="panel-heading no-print">
        <SectionTitle
          number="06"
          title="Ready to communicate"
          description="Review locally before sharing. Publication is a human decision."
        />
        <div className="button-row">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(content);
                w.setNotice(
                  'Complete document copied with context, evidence and guidance.',
                );
              } catch {
                w.setError('Clipboard unavailable. Download the text instead.');
              }
            }}
          >
            <Clipboard size={15} /> Copy
          </button>
          <button onClick={() => download(`VayuManak-${kind}-${language}.txt`, content)}>
            <ArrowDownToLine size={15} /> Download
          </button>
          <button onClick={() => window.print()}>
            <Printer size={15} /> Print
          </button>
        </div>
      </div>
      <div className="document-controls no-print">
        <div className="segmented">
          <button
            aria-pressed={kind === 'citizen'}
            className={kind === 'citizen' ? 'selected' : ''}
            onClick={() => setKind('citizen')}
          >
            Citizen advisory
          </button>
          <button
            aria-pressed={kind === 'internal'}
            className={kind === 'internal' ? 'selected' : ''}
            onClick={() => setKind('internal')}
          >
            Internal note
          </button>
        </div>
        <div className="segmented">
          <button
            aria-pressed={language === 'English'}
            className={language === 'English' ? 'selected' : ''}
            onClick={() => setLanguage('English')}
          >
            English
          </button>
          <button
            aria-pressed={language === 'Hindi'}
            className={language === 'Hindi' ? 'selected' : ''}
            onClick={() => setLanguage('Hindi')}
          >
            हिन्दी
          </button>
        </div>
        <label>
          Reading level
          <select
            disabled={!!w.busy || !!b.legacyLanguage}
            value={w.context.level}
            onChange={(e) =>
              w.changeContext({ level: e.target.value as 'Simple' | 'Standard' })
            }
          >
            <option>Simple</option>
            <option>Standard</option>
          </select>
        </label>
      </div>
      <article className="document-paper" lang={language === 'Hindi' ? 'hi' : 'en'}>
        <div className="document-brand">
          <Wind size={23} /> VayuManak{' '}
          <span>LOCAL INFORMATION · {b.mode.toUpperCase()}</span>
        </div>
        <Eyebrow>
          {b.context.level.toUpperCase()} ·{' '}
          {kind === 'citizen' ? 'COMMUNITY ADVISORY' : 'INTERNAL BRIEFING'}
        </Eyebrow>
        <h2>
          {language === 'Hindi'
            ? 'बेहतर जानकारी। सोच-समझकर अगला कदम।'
            : 'Better informed. Ready for the next step.'}
        </h2>
        <div className="document-content">
          {content.split('\n\n').map((block, i) => (
            <p key={i}>{block}</p>
          ))}
        </div>
        <div className="document-stamp">
          <ShieldCheck size={16} />{' '}
          {language === 'Hindi'
            ? 'साझा करने से पहले स्थानीय समीक्षा करें।'
            : 'Review locally before sharing.'}
        </div>
      </article>
      {b.mode === 'sample' && (
        <p className="fine-print no-print">
          Sample Hindi is a draft awaiting your review. Changing the reading level in
          sample mode updates the draft immediately; live briefs require explicit
          regeneration.
        </p>
      )}
    </section>
  );
}
function HistoryPanel({ w }: { w: Workspace }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <SectionTitle
          number="07"
          title="The local record"
          description="Up to eight briefs, saved on this device. Export to move between browsers."
        />
        <div className="button-row">
          <button
            onClick={() =>
              download(
                'VayuManak-history.json',
                JSON.stringify(w.history),
                'application/json',
              )
            }
          >
            <ArrowDownToLine size={15} /> Export
          </button>
          <button disabled={!!w.busy} onClick={() => input.current?.click()}>
            <Upload size={15} /> Import
          </button>
          <button disabled={!!w.busy} onClick={w.clearHistory}>
            Clear history
          </button>
          <input
            hidden
            ref={input}
            type="file"
            accept=".json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 3000000) {
                w.setError('History exceeds 3 MB.');
                return;
              }
              try {
                w.importHistory(await f.text());
              } catch {
                w.setError('Could not read the history file.');
              }
            }}
          />
        </div>
      </div>
      {!w.history.length ? (
        <div className="empty">
          <History size={34} />
          <h2>A decision is more useful when you can follow it.</h2>
          <p>Save a sample brief or generate a live one to begin your record.</p>
        </div>
      ) : (
        w.history.map((b) => (
          <article key={b.id} className="history-item">
            <span className="history-symbol">
              <FileText size={24} />
            </span>
            <div>
              <h3>{b.context.locality}</h3>
              <p>
                {b.context.role} · {new Date(b.created).toLocaleString()} ·{' '}
                {b.legacyLanguage
                  ? 'Legacy Marathi · read-only'
                  : b.mode === 'sample'
                    ? 'Fictional sample'
                    : 'Live Gemini'}
              </p>
            </div>
            <button disabled={!!w.busy} onClick={() => w.openSnapshot(b)}>
              Open brief <ArrowRight size={15} />
            </button>
          </article>
        ))
      )}
    </section>
  );
}
function EvidenceDialog({
  metric,
  brief,
  onClose,
}: {
  metric: Metric | null;
  brief: Snapshot | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (metric) ref.current?.showModal();
    else ref.current?.close();
  }, [metric]);
  return (
    <dialog
      ref={ref}
      className="evidence-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="evidence-title"
    >
      <div className="panel-heading">
        <div>
          <Eyebrow>THE DECISION HAS A SOURCE</Eyebrow>
          <h2 id="evidence-title">{metric?.site}</h2>
        </div>
        <button onClick={onClose} aria-label="Close evidence">
          <X size={19} />
        </button>
      </div>
      {metric && brief && (
        <>
          <div className="evidence-value">
            {fmt(metric.mean)} <small>µg/m³</small>
          </div>
          <p>
            {metric.pollutant} · {metric.period} observation mean · n={metric.count}
          </p>
          <div className="calculation">
            <strong>{metric.id} · mean-v2</strong>
            <p>
              Sum of included normalized values ÷ {metric.count}. Range: {fmt(metric.min)}
              –{fmt(metric.max)} µg/m³. Expected coverage unknown.
            </p>
            <p>{metric.comparison}</p>
          </div>
          <h3>Original source → reviewed observation</h3>
          {brief.dataset.observations
            .filter((o) => metric.observationIds.includes(o.id))
            .map((o) => (
              <article key={o.id} className="source-card">
                <Eyebrow>
                  {o.id} · LINE {o.line}
                </Eyebrow>
                <pre>{o.source}</pre>
                <strong>
                  {o.originalValue ?? 'Missing'} {o.originalUnit || o.unit} →{' '}
                  {o.value ?? 'Missing'} {o.unit}
                </strong>
                <p>
                  {o.timestamp} · {o.flags.join(' · ') || 'No conversion required'}
                </p>
                {o.correction && (
                  <p>
                    Human review: {o.correction}. {o.reason}
                  </p>
                )}
              </article>
            ))}
          <details>
            <summary>
              Excluded readings (
              {brief.dataset.observations.filter((o) => !o.included).length})
            </summary>
            {brief.dataset.observations
              .filter((o) => !o.included)
              .map((o) => (
                <article className="source-card" key={o.id}>
                  <pre>{o.source}</pre>
                  <p>
                    {o.flags.join(' · ')} · {o.reason || 'Excluded during review'}
                  </p>
                </article>
              ))}
          </details>
          <p className="fine-print">
            Source: {brief.dataset.label}. Fingerprint:{' '}
            {brief.dataset.fingerprint || 'Legacy source'}. User-supplied evidence; not
            independently certified.
          </p>
        </>
      )}
    </dialog>
  );
}
export default function Home() {
  const w = useWorkspace(),
    [metric, setMetric] = useState<Metric | null>(null);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <Navigation w={w} />
      <div className="main-shell">
        <main id="main">
          <div className="workspace-top no-print">
            <div>
              <Eyebrow>THE BHOPAL ACTION DESK</Eyebrow>
              <p>A clearer next step for your neighbourhood.</p>
            </div>
          </div>
          <ContextBar w={w} />
          <div aria-live="polite" className="messages no-print">
            {w.error && (
              <div className="message error">
                <span>{w.error}</span>
                <button aria-label="Dismiss error" onClick={() => w.setError('')}>
                  <X size={16} />
                </button>
              </div>
            )}
            {w.notice && (
              <div className="message">
                <span>{w.notice}</span>
                <button aria-label="Dismiss notice" onClick={() => w.setNotice('')}>
                  <X size={16} />
                </button>
              </div>
            )}
            {w.stale && w.brief && (
              <div className="message warning">
                <span>
                  Inputs changed. The displayed brief retains its saved context. Review
                  and regenerate before using it.
                </span>
                <button
                  disabled={!w.dataset || !!w.busy || !!w.cooldown}
                  onClick={() => w.generate('brief')}
                >
                  Regenerate <Sparkles size={14} />
                </button>
              </div>
            )}
            {w.cooldown > 0 && (
              <div className="message warning">
                Quota cooldown · retry in {w.cooldown}s. Sample mode remains available.
              </div>
            )}
          </div>
          {w.busy && (
            <section className="panel generation-loading no-print" role="status">
              <div className="panel-heading">
                <h2>
                  <Sparkles size={18} />{' '}
                  {w.busy === 'normalize'
                    ? 'Interpreting your source rows…'
                    : 'Connecting evidence, actions and messages…'}
                </h2>
                <button onClick={w.cancel}>Cancel</button>
              </div>
              <div className="skeleton long" />
              <div className="skeleton" />
              <div className="skeleton-grid">
                <div className="skeleton tall" />
                <div className="skeleton tall" />
              </div>
            </section>
          )}
          {w.view === 'desk' && <Desk w={w} onEvidence={setMetric} />}{' '}
          {w.view === 'readings' && (
            <>
              <Intake w={w} />
              {w.dataset && (
                <div className="baseline-selector">
                  <label>
                    Earlier live baseline
                    <select
                      value={w.baselineId}
                      disabled={!!w.busy}
                      onChange={(e) => w.setBaselineId(e.target.value)}
                    >
                      <option value="">
                        Latest compatible earlier period (automatic)
                      </option>
                      {w.history
                        .filter((b) => b.mode === 'live' && !b.legacyLanguage)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.context.locality} · {new Date(b.created).toLocaleString()}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p>
                    {w.baseline
                      ? `Selected: ${w.baseline.context.locality} · ${new Date(w.baseline.created).toLocaleDateString()}`
                      : 'No compatible earlier live period selected. Sample history is isolated.'}
                  </p>
                </div>
              )}
              <Review w={w} />
            </>
          )}
          {w.view === 'communication' && <Communication w={w} />}{' '}
          {w.view === 'history' && <HistoryPanel w={w} />}
        </main>
      </div>
      <EvidenceDialog metric={metric} brief={w.brief} onClose={() => setMetric(null)} />
    </div>
  );
}
