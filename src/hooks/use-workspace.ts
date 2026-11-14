'use client';
import { useEffect, useRef, useState } from 'react';
import { analyze, selectBaseline } from '@/lib/air/analyze';
import { finalizeDataset, parseTable } from '@/lib/air/normalize';
import { sampleNarrative } from '@/lib/air/narrative';
import { SAMPLE_ONE, SAMPLE_TWO, sampleDataset } from '@/lib/air/sample';
import { HISTORY_KEY, readHistory } from '@/lib/air/history';
import {
  DEFAULT_CONTEXT,
  type Context,
  type Dataset,
  type Observation,
  type Snapshot,
} from '@/lib/air/types';

function carryForward(previous?: Snapshot | null) {
  if (!previous) return [];
  const tasks = previous.narrative.actions.map((action) => ({
    id: action.id,
    title: action.title,
    owner: action.owner,
    location: action.location || '',
    status: previous.statuses[action.id] || 'To do',
    note: previous.notes[action.id] || '',
  }));
  return [
    ...tasks,
    ...(previous.followUp || []).filter((old) => !tasks.some((t) => t.id === old.id)),
  ].slice(0, 12);
}

export type View = 'desk' | 'readings' | 'communication' | 'history';
export function useWorkspace() {
  const [context, setContext] = useState<Context>(DEFAULT_CONTEXT);
  const [text, setText] = useState('');
  const [label, setLabel] = useState('Pasted readings');
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [brief, setBrief] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [view, setView] = useState<View>('desk');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stale, setStale] = useState(false);
  const [sample, setSample] = useState(false);
  const [period, setPeriod] = useState(1);
  const [baselineId, setBaselineId] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inflight = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const cache = useRef(new Map<string, Snapshot>());
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(HISTORY_KEY);
        if (saved) setHistory(readHistory(saved));
      } catch {
        setError(
          'History could not be restored. Export a valid backup or clear the stored history.',
        );
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      inflight.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function persist(items: Snapshot[]) {
    const bounded = items.slice(0, 8);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(bounded));
    setHistory(bounded);
  }
  function save(snapshot: Snapshot) {
    try {
      persist([snapshot, ...history.filter((h) => h.id !== snapshot.id)]);
      setNotice('Saved on this device. Export history to move it to another browser.');
    } catch {
      setError(
        'The brief is open, but browser storage failed. Download/export a copy before closing this page.',
      );
    }
  }
  function sampleBrief(ctx: Context, p: number, previous?: Snapshot | null): Snapshot {
    const data = sampleDataset(p),
      first = sampleDataset(1);
    const baseline = p === 2 ? { context: ctx, dataset: first } : undefined;
    const metrics = analyze(
      data,
      ctx,
      baseline ? { ...baseline, metrics: analyze(first, ctx) } : undefined,
    );
    const narrative = sampleNarrative(ctx, metrics);
    return {
      version: 2,
      id: `sample-${ctx.role}-${p}-${ctx.level}`,
      created: `2026-11-${p === 1 ? '10' : '11'}T10:00:00+05:30`,
      context: ctx,
      dataset: data,
      metrics,
      narrative,
      baseline,
      mode: 'sample',
      statuses: previous?.statuses || {},
      notes: previous?.notes || {},
      followUp:
        previous && previous.context.role === ctx.role ? carryForward(previous) : [],
    };
  }
  function loadSample(p = 1, ctx = context) {
    if (inflight.current) return;
    const snapshot = sampleBrief(ctx, p, brief);
    setContext(ctx);
    setText(p === 1 ? SAMPLE_ONE : SAMPLE_TWO);
    setLabel(snapshot.dataset.label);
    setDataset(snapshot.dataset);
    setBrief(snapshot);
    setPeriod(p);
    setSample(true);
    setStale(false);
    setView('desk');
    setError('');
    setNotice(
      'Fictional Bhopal demonstration · precomputed, not a live response. Hindi drafts await your review.',
    );
  }
  function changeContext(patch: Partial<Context>) {
    if (inflight.current) return;
    const next = { ...context, ...patch };
    if (sample && !patch.locality && !patch.timezone) {
      loadSample(period, next);
      if (patch.level || patch.language) setView(view);
    } else {
      setContext(next);
      setStale(true);
      revision.current++;
    }
  }
  function changeText(value: string, name = label) {
    if (inflight.current) return;
    revision.current++;
    setText(value);
    setLabel(name);
    setDataset(null);
    setSample(false);
    setStale(true);
  }
  function review() {
    try {
      setDataset(parseTable(text, label));
      setView('readings');
      setSample(false);
      setStale(true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse the table.');
    }
  }
  function editRow(id: string, patch: Partial<Observation>) {
    if (!dataset || inflight.current) return;
    const observations = dataset.observations.map((o) =>
      o.id === id
        ? { ...o, ...patch, correction: patch.correction ?? 'Edited during human review' }
        : o,
    );
    setDataset(finalizeDataset({ ...dataset, observations }));
    setSample(false);
    setStale(true);
    revision.current++;
  }
  const baseline = dataset
    ? selectBaseline(history, context, dataset, baselineId)
    : undefined;
  async function generate(operation: 'normalize' | 'brief', force = false) {
    if (inflight.current || cooldown) return;
    if (brief?.legacyLanguage) {
      setError(
        'Legacy Marathi brief is read-only. Load a new source to create an English/Hindi brief.',
      );
      return;
    }
    const key = JSON.stringify({
      context,
      dataset,
      baseline: baseline?.id,
      statuses: baseline?.statuses,
      notes: baseline?.notes,
    });
    if (operation === 'brief' && !force && cache.current.has(key)) {
      setBrief(cache.current.get(key)!);
      setView('desk');
      setStale(false);
      setNotice(
        'Reused a validated brief for the same reviewed data, context and baseline.',
      );
      return;
    }
    const controller = new AbortController(),
      current = ++revision.current;
    inflight.current = controller;
    setBusy(operation);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ operation, context, text, label, dataset, baseline }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429)
          setCooldown(
            Math.min(
              3600,
              Math.max(1, Number(response.headers.get('Retry-After')) || 60),
            ),
          );
        throw new Error(result.error?.message || 'Generation failed.');
      }
      if (controller.signal.aborted || current !== revision.current) return;
      if (operation === 'normalize') {
        setDataset(result.dataset);
        setView('readings');
        setSample(false);
        setStale(true);
        setNotice(
          'Check the interpretation, resolve issues and explicitly confirm the selected rows.',
        );
      } else {
        const snapshot: Snapshot = {
          version: 2,
          id: crypto.randomUUID(),
          created: new Date().toISOString(),
          context: { ...context },
          dataset: result.dataset,
          metrics: result.metrics,
          narrative: result.narrative,
          baseline: result.baseline,
          mode: 'live',
          statuses: { ...baseline?.statuses },
          notes: { ...baseline?.notes },
          model: result.model,
          promptVersion: result.promptVersion,
          followUp: carryForward(baseline),
        };
        cache.current.set(key, snapshot);
        if (cache.current.size > 4)
          cache.current.delete(cache.current.keys().next().value!);
        setBrief(snapshot);
        setStale(false);
        setSample(false);
        setView('desk');
        save(snapshot);
      }
    } catch (e) {
      setError(
        controller.signal.aborted
          ? 'Cancelled. The previous successful brief remains available.'
          : e instanceof Error
            ? e.message
            : 'The request failed. Your work is preserved.',
      );
    } finally {
      if (inflight.current === controller) {
        inflight.current = null;
        setBusy('');
      }
    }
  }
  function updateAction(id: string, value: string, field: 'statuses' | 'notes') {
    if (!brief || brief.legacyLanguage) return;
    const updated = { ...brief, [field]: { ...brief[field], [id]: value } };
    setBrief(updated);
    if (history.some((h) => h.id === brief.id)) {
      try {
        persist(history.map((h) => (h.id === brief.id ? updated : h)));
      } catch {
        setError(
          'Action is updated on screen but could not be saved. Export before closing.',
        );
      }
    }
  }
  function openSnapshot(snapshot: Snapshot) {
    if (inflight.current) return;
    revision.current++;
    setBrief(snapshot);
    setContext(snapshot.context);
    setDataset(snapshot.dataset);
    setText('');
    setLabel(snapshot.dataset.label);
    setSample(false);
    setStale(false);
    setView('desk');
    setNotice(
      snapshot.legacyLanguage
        ? 'Read-only legacy Marathi content. Original text is preserved; it has not been translated or relabeled.'
        : 'Saved evidence restored. Intake is empty; reviewed data can be reused explicitly.',
    );
  }
  function importHistory(value: string) {
    if (inflight.current) return;
    try {
      const items = readHistory(value);
      persist([...items, ...history.filter((h) => !items.some((i) => i.id === h.id))]);
      setNotice('Validated history imported.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'History import failed.');
    }
  }
  function clearHistory() {
    if (inflight.current) return;
    try {
      localStorage.removeItem(HISTORY_KEY);
      setHistory([]);
      setBaselineId('');
      setNotice('History removed from this browser.');
    } catch {
      setError('Browser history could not be cleared.');
    }
  }
  function excludeUnaccounted(reason: string) {
    if (dataset && reason.trim()) {
      setDataset({
        ...dataset,
        unaccounted: [],
        notes: [
          ...dataset.notes,
          `User excluded unaccounted source lines ${dataset.unaccounted?.join(', ')}: ${reason}`,
        ].slice(-20),
      });
      setStale(true);
    }
  }
  return {
    context,
    text,
    label,
    dataset,
    brief,
    history,
    view,
    busy,
    error,
    notice,
    stale,
    sample,
    period,
    baseline,
    baselineId,
    cooldown,
    setView,
    setBaselineId,
    setError,
    setNotice,
    loadSample,
    changeContext,
    changeText,
    review,
    editRow,
    generate,
    updateAction,
    openSnapshot,
    importHistory,
    clearHistory,
    excludeUnaccounted,
    save,
    cancel: () => inflight.current?.abort(),
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;
