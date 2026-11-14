import { GoogleGenAI } from '@google/genai';
import { analyze } from '@/lib/air/analyze';
import { sourceLines, checkSource, fingerprint } from '@/lib/air/normalize';
import {
  array,
  record,
  string,
  validateContext,
  validateDataset,
  validateNarrative,
  validateSnapshot,
} from '@/lib/air/validation';
import { BRIEF, NORMALIZE, briefSchema, normalizeSchema } from '@/lib/air/prompts';
import { GUIDANCE } from '@/lib/air/types';
export const maxDuration = 60;
function constrainedSchema(schema: unknown, ids: string[]): unknown {
  if (Array.isArray(schema)) return schema.map((item) => constrainedSchema(item, ids));
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      key === 'evidence'
        ? { type: 'array', items: { type: 'string', enum: ids } }
        : constrainedSchema(value, ids),
    ]),
  );
}

function boundedNotes(value: unknown) {
  if (value === undefined) return {};
  const entries = Object.entries(record(value));
  if (entries.length > 30) throw new Error('Too many action records.');
  return Object.fromEntries(
    entries.map(([key, value]) => [string(key, 100), string(value, 1000)]),
  );
}
const headers = { 'Cache-Control': 'private, no-store' };
class RequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
async function readBody(request: Request) {
  if (!request.body) throw new RequestError('INVALID_INPUT', 'Missing request body.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1048576) {
      await reader.cancel();
      throw new RequestError('OVERSIZED_INPUT', 'Request exceeds 1 MB.', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return record(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    throw new RequestError('INVALID_INPUT', 'Expected a JSON object.');
  }
}
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      {
        error: {
          code: 'INVALID_ORIGIN',
          message: 'Use the VayuManak application to generate a brief.',
        },
      },
      { status: 403, headers },
    );
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let operation = 'unknown';
  try {
    const body = await readBody(request);
    operation = string(body.operation, 20);
    const context = validateContext(body.context);
    if (!['normalize', 'brief'].includes(operation))
      throw new RequestError('INVALID_INPUT', 'Unknown operation.');
    let payload: unknown;
    let dataset;
    let metrics;
    let comparisonBaseline;
    if (operation === 'normalize') {
      const text = string(body.text, 102400);
      checkSource(text);
      payload = { context, lines: sourceLines(text) };
    } else {
      dataset = validateDataset(body.dataset);
      if (dataset.unaccounted?.length)
        throw new RequestError(
          'UNRESOLVED_DATA',
          'Account for all source rows before generation.',
        );
      const requested = array(record(body.dataset).observations, 2000).filter(
        (o) => record(o).included,
      ).length;
      if (requested !== dataset.observations.filter((o) => o.included).length)
        throw new RequestError(
          'UNRESOLVED_DATA',
          'Selected rows still contain unresolved fields or duplicates. Correct or exclude them before generating.',
        );
      if (!dataset.observations.some((o) => o.included))
        throw new RequestError(
          'UNRESOLVED_DATA',
          'Include at least one valid observation. Repair missing fields or exclude unresolved rows.',
        );
      const baseline = body.baseline ? validateSnapshot(body.baseline) : undefined;
      if (baseline) {
        baseline.metrics = analyze(baseline.dataset, baseline.context);
        comparisonBaseline = { context: baseline.context, dataset: baseline.dataset };
      }
      metrics = analyze(dataset, context, baseline);
      payload = {
        context,
        metrics,
        coverage: 'Expected coverage unknown',
        quality: dataset.observations
          .filter((o) => !o.included || o.flags.length)
          .map((o) => ({ id: o.id, site: o.site, flags: o.flags, decision: o.reason })),
        priorActions: baseline
          ? validateNarrative(
              record(body.baseline).narrative,
              baseline.metrics,
              baseline.context,
            )
          : undefined,
        priorStatuses: body.baseline
          ? boundedNotes(record(body.baseline).statuses)
          : undefined,
        priorNotes: body.baseline ? boundedNotes(record(body.baseline).notes) : undefined,
        guidance: GUIDANCE,
      };
    }
    if (!process.env.GEMINI_API_KEY)
      throw new RequestError(
        'MISSING_KEY',
        'Gemini is not configured. Load Sample Data to explore the full workflow.',
        503,
      );
    if (!process.env.GEMINI_MODEL)
      throw new RequestError(
        'UNAVAILABLE_MODEL',
        'Set GEMINI_MODEL to a structured-output model available to your Gemini project.',
        503,
      );
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { timeout: 45000, retryOptions: { attempts: 1 } },
    });
    let response;
    try {
      response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL,
        contents: JSON.stringify(payload),
        config: {
          systemInstruction: operation === 'normalize' ? NORMALIZE : BRIEF,
          responseMimeType: 'application/json',
          responseJsonSchema:
            operation === 'normalize'
              ? normalizeSchema
              : constrainedSchema(
                  briefSchema,
                  metrics!.map((m) => m.id),
                ),
          maxOutputTokens: 12000,
          abortSignal: request.signal,
        },
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) throw error;
      throw new RequestError(
        'TIMEOUT',
        'Provider request did not finish. Your previous workspace is preserved.',
        504,
      );
    }
    let output: unknown;
    try {
      output = JSON.parse(response.text || '');
    } catch (validationError) {
      console.info(
        JSON.stringify({
          requestId,
          operation,
          code: 'OUTPUT_CHECK',
          reason:
            validationError instanceof Error ? validationError.message : 'Invalid output',
        }),
      );
      throw new RequestError(
        'INVALID_OUTPUT',
        'Gemini returned an unreadable response. Your previous brief is preserved.',
        502,
      );
    }
    try {
      if (operation === 'normalize') {
        const out = record(output);
        const lines = sourceLines(string(body.text, 102400));
        const observations = array(out.observations, 2000).map((raw, i) => {
          const o = record(raw);
          const line = lines.find((l) => l.line === o.line);
          if (!line) throw new Error('Unknown source line.');
          const numbers = (line.source.match(/[+-]?\d+(?:[.,]\d+)?/g) || []).map((n) =>
            Number(n.replace(',', '.')),
          );
          const verified =
            o.value === null ||
            (typeof o.value === 'number' && numbers.includes(o.value));
          if (!verified)
            throw new Error('Measurement not present in original source line.');
          return {
            ...o,
            line: line.line,
            id: `row-${line.line}-${i}`,
            source: line.source,
            included: true,
            reason: '',
            status: typeof o.status === 'string' ? o.status : '',
            flags: [],
          };
        });
        const accounted = new Set(observations.map((o) => o.line));
        const unaccounted = lines
          .slice(1)
          .filter(
            (l) => !accounted.has(l.line) && l.source.trim() !== lines[0].source.trim(),
          )
          .map((l) => l.line);
        return Response.json(
          {
            dataset: validateDataset({
              label: string(body.label || 'Uploaded readings', 200),
              observations,
              notes: out.notes,
              fingerprint: fingerprint(string(body.text, 102400)),
              unaccounted,
            }),
            requestId,
          },
          { headers },
        );
      }
      const narrative = validateNarrative(output, metrics!, context);
      return Response.json(
        {
          dataset,
          metrics,
          narrative,
          baseline: comparisonBaseline,
          model: process.env.GEMINI_MODEL,
          promptVersion: 'vayumanak-2',
          requestId,
        },
        { headers },
      );
    } catch (validationError) {
      console.info(
        JSON.stringify({
          requestId,
          operation,
          code: 'OUTPUT_CHECK',
          reason:
            validationError instanceof Error ? validationError.message : 'Invalid output',
        }),
      );
      throw new RequestError(
        'INVALID_OUTPUT',
        'Generated output failed evidence or data checks. Review your data and retry explicitly.',
        502,
      );
    }
  } catch (error) {
    let code = 'INVALID_INPUT',
      message = error instanceof Error ? error.message : 'Invalid request.',
      status = 400;
    if (error instanceof RequestError) {
      code = error.code;
      status = error.status;
    } else if (error && typeof error === 'object' && 'status' in error) {
      const upstream = Number(error.status);
      status = 502;
      if (upstream === 429) {
        code = 'QUOTA';
        status = 429;
        message =
          'Gemini quota is unavailable. Wait before retrying, or use the labeled sample workflow.';
      } else if ([401, 403, 404].includes(upstream)) {
        code = 'UNAVAILABLE_MODEL';
        message =
          'The configured Gemini key or model is unavailable. Check project access and GEMINI_MODEL.';
      } else {
        code = 'UPSTREAM_FAILURE';
        const providerMessage =
          error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : '';
        message = providerMessage
          ? `Gemini request failed: ${providerMessage.slice(0, 240)}. Your workspace is preserved.`
          : 'Gemini could not complete this request. Your workspace is preserved.';
      }
    } else if (/timeout|abort|fetch failed/i.test(message)) {
      code = /timeout|abort/i.test(message) ? 'TIMEOUT' : 'UPSTREAM_FAILURE';
      status = 504;
      message =
        'Generation did not finish. Your workspace is preserved; retry when ready.';
    }
    console.info(
      JSON.stringify({ requestId, operation, duration: Date.now() - start, code }),
    );
    return Response.json(
      { error: { code, message }, requestId },
      {
        status,
        headers: { ...headers, ...(status === 429 ? { 'Retry-After': '60' } : {}) },
      },
    );
  }
}
