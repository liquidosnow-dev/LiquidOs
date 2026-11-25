import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_LOG_PATH = path.join(__dirname, 'audit.jsonl');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const BRIDGE_TOKEN = process.env.HARNESS_BRIDGE_TOKEN || 'dev-token';

const ALLOWED_MODELS = [
  'anthropic/claude-sonnet-4-5',
  'openai/gpt-4o',
  'google/gemini-2.5-pro',
  'xai/grok-3'
];

// Generate Ed25519 Cryptographic Keypair for Tamper-Evident Audit Receipts
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// In-memory approval queue: Map<taskId, TaskRecord>
const taskQueue = new Map();

function detectGatewayMode(byokKey) {
  if (byokKey && byokKey.trim().length > 0) {
    return 'BYOK_DIRECT';
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    return 'VERCEL_AI_GATEWAY';
  }
  if (process.env.OPENAI_BASE_URL || process.env.ANTHROPIC_BASE_URL || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    return 'ENVIRONMENT_AI_GATEWAY';
  }
  return 'SIMULATION_DRY_RUN';
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

/**
 * Signs audit payload with Ed25519 private key for sovereign provenance.
 */
function signAuditRecord(recordObj) {
  const payloadStr = JSON.stringify(recordObj);
  const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey).toString('hex');
  return {
    ...recordObj,
    signature,
    publicKeyPem: publicKey,
    algorithm: 'Ed25519',
  };
}

async function appendAuditRecord(record) {
  const signed = signAuditRecord(record);
  const line = JSON.stringify(signed) + '\n';
  await fs.appendFile(AUDIT_LOG_PATH, line, 'utf8');
  return signed;
}

/**
 * Dispatches inference to the resolved Managed AI Gateway or Bring-Your-Own-Key (BYOK) provider.
 */
async function invokeGateway({ prompt, model, byokKey }) {
  const gatewayMode = detectGatewayMode(byokKey);
  const startedAt = Date.now();
  const [provider, rawModel] = model.includes('/') ? model.split('/') : ['anthropic', model];

  if (gatewayMode === 'BYOK_DIRECT') {
    if (provider === 'anthropic' || model.includes('claude')) {
      const client = new Anthropic({ apiKey: byokKey });
      const msg = await client.messages.create({
        model: rawModel || 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = msg.content.find((b) => b.type === 'text');
      return {
        gatewayMode,
        provider: 'anthropic',
        model,
        output: textBlock?.text ?? '',
        usage: msg.usage ?? null,
        latencyMs: Date.now() - startedAt,
      };
    } else {
      // OpenAI or Gemini via OpenAI compatibility
      const client = new OpenAI({
        apiKey: byokKey,
        baseURL: model.includes('google') ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined,
      });
      const completion = await client.chat.completions.create({
        model: rawModel || model,
        messages: [{ role: 'user', content: prompt }],
      });
      return {
        gatewayMode,
        provider: provider || 'openai',
        model,
        output: completion.choices[0]?.message?.content ?? '',
        usage: completion.usage ?? null,
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  if (gatewayMode === 'VERCEL_AI_GATEWAY') {
    const client = new OpenAI({
      apiKey: process.env.AI_GATEWAY_API_KEY,
      baseURL: 'https://vercel.sh',
    });

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      gatewayMode,
      provider,
      model,
      output: completion.choices[0]?.message?.content ?? '',
      usage: completion.usage ?? null,
      latencyMs: Date.now() - startedAt,
    };
  }

  if (gatewayMode === 'ENVIRONMENT_AI_GATEWAY') {
    if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await anthropic.messages.create({
        model: rawModel,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = msg.content.find((b) => b.type === 'text');
      return {
        gatewayMode,
        provider,
        model,
        output: textBlock?.text ?? '',
        usage: msg.usage ?? null,
        latencyMs: Date.now() - startedAt,
      };
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: rawModel,
      messages: [{ role: 'user', content: prompt }],
    });
    return {
      gatewayMode,
      provider,
      model,
      output: completion.choices[0]?.message?.content ?? '',
      usage: completion.usage ?? null,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Deterministic Offline Simulation Mode (0 credits consumed)
  await new Promise((r) => setTimeout(r, 150));
  return {
    gatewayMode: 'SIMULATION_DRY_RUN',
    provider,
    model,
    output: `[DRY-RUN BYOK / GATEWAY RESPONSE | ${model}]\nVerified prompt receipt (${prompt.length} chars). Ed25519 provenance signed. Provide X-BYOK-Key header for direct API routing.`,
    usage: { prompt_tokens: Math.ceil(prompt.length / 4), completion_tokens: 32 },
    latencyMs: Date.now() - startedAt,
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-BYOK-Key, X-OpenAI-Key, X-Anthropic-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isAuthorized(req) {
  const auth = req.headers['authorization'] || '';
  return auth === `Bearer ${BRIDGE_TOKEN}`;
}

function getByokKey(req) {
  return (
    req.headers['x-byok-key'] ||
    req.headers['x-openai-key'] ||
    req.headers['x-anthropic-key'] ||
    process.env.BYOK_API_KEY ||
    ''
  );
}

async function executeAndAuditTask(task, byokKey) {
  const result = await invokeGateway({ prompt: task.prompt, model: task.model, byokKey });
  const requestHash = sha256(JSON.stringify({ prompt: task.prompt, model: task.model }));
  const responseHash = sha256(result.output);
  const completedAt = new Date().toISOString();

  const auditEntry = {
    taskId: task.taskId,
    status: 'EXECUTED',
    gatewayMode: result.gatewayMode,
    model: result.model,
    latencyMs: result.latencyMs,
    requestSha256: requestHash,
    responseSha256: responseHash,
    usage: result.usage,
    completedAt,
  };

  const signedAudit = await appendAuditRecord(auditEntry);

  const finalized = {
    ...task,
    status: 'EXECUTED',
    output: result.output,
    audit: signedAudit,
  };
  taskQueue.set(task.taskId, finalized);
  return finalized;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const byokKey = String(getByokKey(req)).trim();

  // Public Health Endpoint
  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      status: 'ok',
      host: HOST,
      port: PORT,
      gatewayMode: detectGatewayMode(byokKey),
      hasByokKey: Boolean(byokKey),
      allowedModels: ALLOWED_MODELS,
      ed25519PublicKeyPem: publicKey,
      pendingTasks: Array.from(taskQueue.values()).filter((t) => t.status === 'PENDING_APPROVAL').length,
      timestamp: new Date().toISOString(),
    });
  }

  // Bearer Auth Gate for all /v1/* routes
  if (url.pathname.startsWith('/v1/')) {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: 'Unauthorized: invalid or missing Bearer token' });
    }
  }

  try {
    // List tasks
    if (req.method === 'GET' && url.pathname === '/v1/harness/tasks') {
      const tasks = Array.from(taskQueue.values()).reverse();
      return sendJson(res, 200, { tasks });
    }

    // SSE Token-by-Token Streaming Endpoint with BYOK support
    if (req.method === 'GET' && url.pathname === '/v1/harness/stream') {
      const prompt = url.searchParams.get('prompt') || 'Hello AI Gateway';
      const model = ALLOWED_MODELS.includes(url.searchParams.get('model') || '')
        ? url.searchParams.get('model')!
        : ALLOWED_MODELS[0];

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      res.write(`data: ${JSON.stringify({ type: 'start', model, prompt })}\n\n`);

      const gatewayMode = detectGatewayMode(byokKey);
      let fullOutput = '';

      if (gatewayMode === 'BYOK_DIRECT') {
        const [provider, rawModel] = model.includes('/') ? model.split('/') : ['anthropic', model];
        try {
          if (provider === 'anthropic' || model.includes('claude')) {
            const client = new Anthropic({ apiKey: byokKey });
            const stream = await client.messages.stream({
              model: rawModel || 'claude-3-5-sonnet-20241022',
              max_tokens: 1024,
              messages: [{ role: 'user', content: prompt }],
            });

            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const chunk = event.delta.text;
                fullOutput += chunk;
                res.write(`data: ${JSON.stringify({ type: 'token', text: chunk })}\n\n`);
              }
            }
          } else {
            const client = new OpenAI({ apiKey: byokKey });
            const stream = await client.chat.completions.create({
              model: rawModel || model,
              messages: [{ role: 'user', content: prompt }],
              stream: true,
            });

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content || '';
              if (delta) {
                fullOutput += delta;
                res.write(`data: ${JSON.stringify({ type: 'token', text: delta })}\n\n`);
              }
            }
          }
        } catch (streamErr) {
          const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
          res.write(`data: ${JSON.stringify({ type: 'error', text: errMsg })}\n\n`);
        }
      } else {
        // Simulation / dry run streaming
        const words = `[SSE BYOK SIMULATION | ${model}] Sovereign Ed25519 signed stream operational. Provide X-BYOK-Key header for live streaming. Prompt: "${prompt.slice(0, 30)}..."`.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + words[i];
          fullOutput += chunk;
          res.write(`data: ${JSON.stringify({ type: 'token', text: chunk })}\n\n`);
          await new Promise((r) => setTimeout(r, 40));
        }
      }

      const responseHash = sha256(fullOutput);
      const auditEntry = {
        taskId: 'stream_' + crypto.randomUUID(),
        status: 'STREAMED',
        gatewayMode,
        model,
        responseSha256: responseHash,
        completedAt: new Date().toISOString(),
      };
      const signedAudit = signAuditRecord(auditEntry);
      await fs.appendFile(AUDIT_LOG_PATH, JSON.stringify(signedAudit) + '\n', 'utf8');

      res.write(`data: ${JSON.stringify({ type: 'done', audit: signedAudit })}\n\n`);
      return res.end();
    }

    // Propose a new prompt execution
    if (req.method === 'POST' && url.pathname === '/v1/harness/propose') {
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || '').trim();
      const model = ALLOWED_MODELS.includes(body.model) ? body.model : ALLOWED_MODELS[0];
      const requiresApproval = body.requiresApproval !== false;

      if (!prompt) {
        return sendJson(res, 400, { error: 'Prompt is required.' });
      }

      const taskId = crypto.randomUUID();
      const task = {
        taskId,
        prompt,
        model,
        requiresApproval,
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
        output: null,
        audit: null,
      };
      taskQueue.set(taskId, task);

      if (!requiresApproval) {
        const executed = await executeAndAuditTask(task, byokKey);
        return sendJson(res, 200, executed);
      }

      return sendJson(res, 202, task);
    }

    // Approve pending task
    const approveMatch = url.pathname.match(/^\/v1\/harness\/approve\/([a-f0-9-]+)$/i);
    if (req.method === 'POST' && approveMatch) {
      const task = taskQueue.get(approveMatch[1]);
      if (!task) return sendJson(res, 404, { error: 'Task not found.' });
      if (task.status !== 'PENDING_APPROVAL') {
        return sendJson(res, 409, { error: `Task cannot be approved in state: ${task.status}` });
      }

      const executed = await executeAndAuditTask(task, byokKey);
      return sendJson(res, 200, executed);
    }

    // Reject pending task
    const rejectMatch = url.pathname.match(/^\/v1\/harness\/reject\/([a-f0-9-]+)$/i);
    if (req.method === 'POST' && rejectMatch) {
      const task = taskQueue.get(rejectMatch[1]);
      if (!task) return sendJson(res, 404, { error: 'Task not found.' });
      if (task.status !== 'PENDING_APPROVAL') {
        return sendJson(res, 409, { error: `Task cannot be rejected in state: ${task.status}` });
      }

      task.status = 'REJECTED';
      task.rejectedAt = new Date().toISOString();
      const auditEntry = {
        taskId: task.taskId,
        status: 'REJECTED',
        model: task.model,
        rejectedAt: task.rejectedAt,
      };
      const signedAudit = await appendAuditRecord(auditEntry);
      task.audit = signedAudit;

      return sendJson(res, 200, task);
    }

    return sendJson(res, 404, { error: 'Route not found' });
  } catch (err) {
    return sendJson(res, 500, {
      error: 'Bridge execution failure',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[PocketHarness Bridge] Listening on http://${HOST}:${PORT}`);
  console.log(`[PocketHarness Bridge] BYOK & SSE Streaming Gateway Active`);
});
