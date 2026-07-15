import crypto from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeMermaidNodeTarget } from "./mermaid-node.js";
import { renderComposite } from "./visual-composite.js";

export class SessionStore {
  /**
   * @param {string} file
   * @param {{ assetDir?: string }} [options]
   */
  constructor(file, options = {}) {
    this.file = file;
    const { assetDir } = options;
    this.assetDir = assetDir || path.join(path.dirname(file), "feedback-assets");
  }

  async listSessions() {
    const state = await this.readState();
    return Object.values(state.sessions).sort((a, b) => a.file.localeCompare(b.file));
  }

  async findByFile(file) {
    const absolute = await canonicalFile(file);
    const state = await this.readState();
    return state.sessions[sessionKey(absolute)] || null;
  }

  async findByKey(key) {
    const state = await this.readState();
    return state.sessions[key] || null;
  }

  async upsertSession(file, url) {
    const absolute = await canonicalFile(file);
    const key = sessionKey(absolute);
    const state = await this.readState();
    const existing = state.sessions[key] || {};
    const existingPrompts = existing.prompts || [];
    const existingStatus = existing.status === "ended" ? "open" : existing.status || "open";
    const session = {
      key,
      file: absolute,
      url,
      status: existingStatus === "feedback" && existingPrompts.length === 0 ? "open" : existingStatus,
      pending_prompts: existing.pending_prompts || 0,
      prompts: existingPrompts,
      layout_warnings: [],
      delivered_layout_warning_keys: existing.delivered_layout_warning_keys || [],
      dom_snapshot: existing.dom_snapshot || "",
      chat: existing.chat || [],
      updated_at: new Date().toISOString(),
    };
    state.sessions[key] = session;
    await this.writeState(state);
    return session;
  }

  async queuePrompts(key, payload) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];
    const shouldEndSession = Boolean(payload.endSession || payload.end_session);
    const alreadyEnded = session.status === "ended";
    const normalizedPrompts = [];
    for (const prompt of prompts) {
      normalizedPrompts.push(await this.normalizePromptForSession(prompt, key, session.file));
    }
    const userMessages = normalizedPrompts
      .filter((prompt) => prompt.tag === "message" && prompt.prompt)
      .map((prompt) => ({ role: "user", text: prompt.prompt, at: new Date().toISOString() }));
    session.prompts = [...(session.prompts || []), ...normalizedPrompts];
    session.chat = [...(session.chat || []), ...userMessages];
    session.pending_prompts = session.prompts.length;
    session.dom_snapshot = String(payload.domSnapshot || payload.dom_snapshot || "");
    session.status = shouldEndSession || alreadyEnded ? "ended" : "feedback";
    if (shouldEndSession) session.ended_by = "user";
    session.updated_at = new Date().toISOString();
    await this.writeState(state);
    return session;
  }

  async recordLayoutWarnings(key, payload) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    const deliveredWarningKeys = session.delivered_layout_warning_keys || [];
    const deliveredKeys = new Set(deliveredWarningKeys);
    const layoutWarnings = normalizeLayoutWarnings(
      payload.layout_warnings || payload.layoutWarnings || [],
      deliveredKeys,
    );
    const activeWarningKeys = new Set(layoutWarnings.map(layoutWarningKey));
    const nextDeliveredWarningKeys = deliveredWarningKeys.filter((key) => activeWarningKeys.has(key)).slice(-200);
    const deliveredKeysChanged =
      nextDeliveredWarningKeys.length !== deliveredWarningKeys.length ||
      nextDeliveredWarningKeys.some((key, index) => key !== deliveredWarningKeys[index]);
    const previousSignature = JSON.stringify(session.layout_warnings || []);
    const nextSignature = JSON.stringify(layoutWarnings);
    const warningsChanged = previousSignature !== nextSignature;
    if (!warningsChanged && !deliveredKeysChanged) {
      return { session, changed: false, hasWarnings: layoutWarnings.length > 0 };
    }
    session.layout_warnings = layoutWarnings;
    session.delivered_layout_warning_keys = nextDeliveredWarningKeys;
    if (layoutWarnings.length > 0 && session.status !== "ended") {
      session.status = "feedback";
    } else if ((session.prompts || []).length === 0 && session.status !== "ended") {
      session.status = "open";
    }
    session.updated_at = new Date().toISOString();
    await this.writeState(state);
    return { session, changed: warningsChanged, hasWarnings: layoutWarnings.length > 0 };
  }

  async takeFeedback(key) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return { status: "missing" };
    }
    // Prompts queued before the session ended (e.g. "Send & end session") must still reach the
    // agent, so deliver them before reporting the ended state; the next poll then sees ended.
    const prompts = session.prompts || [];
    const layoutWarnings = session.layout_warnings || [];
    const alreadyEnded = session.status === "ended";
    if (prompts.length === 0 && layoutWarnings.length === 0) {
      return alreadyEnded ? { status: "ended", ended_by: session.ended_by } : { status: "waiting" };
    }
    const result = {
      status: "feedback",
      dom_snapshot: session.dom_snapshot || "",
      prompts,
      ...(layoutWarnings.length > 0 ? { layout_warnings: layoutWarnings } : {}),
      // This is the final delivery before the session shows as ended - flag it so the agent
      // knows not to expect (or force) a reopened browser afterward.
      ...(alreadyEnded ? { session_ended: true, ended_by: session.ended_by } : {}),
    };
    session.prompts = [];
    session.layout_warnings = [];
    session.pending_prompts = 0;
    session.dom_snapshot = "";
    if (layoutWarnings.length > 0) {
      const deliveredKeys = new Set(session.delivered_layout_warning_keys || []);
      for (const warning of layoutWarnings) deliveredKeys.add(layoutWarningKey(warning));
      session.delivered_layout_warning_keys = [...deliveredKeys].slice(-200);
    }
    if (!alreadyEnded) {
      session.status = "open";
    }
    session.updated_at = new Date().toISOString();
    await this.writeState(state);
    return result;
  }

  // `endedBy` distinguishes a human ending review from the browser chrome ("user") from an
  // agent explicitly closing the loop via `lavish-axi end` ("agent"). Only a user-initiated end
  // blocks a plain reopen - see `SessionStore` callers in server.js.
  async endSession(key, endedBy = "agent") {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    const existingEndedBy = session.status === "ended" ? session.ended_by : undefined;
    const nextEndedBy = endedBy === "user" || existingEndedBy === "user" ? "user" : "agent";
    session.status = "ended";
    session.ended_by = nextEndedBy;
    session.updated_at = new Date().toISOString();
    await this.writeState(state);
    return session;
  }

  async addAgentReply(key, text) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    session.chat = [...(session.chat || []), { role: "agent", text: String(text || ""), at: new Date().toISOString() }];
    session.updated_at = new Date().toISOString();
    await this.writeState(state);
    return session;
  }

  async readState() {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      return { sessions: parsed.sessions || {} };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { sessions: {} };
      }
      throw error;
    }
  }

  async writeState(state) {
    await writeFile(this.file, `${JSON.stringify(state, null, 2)}\n`);
  }

  async normalizePromptForSession(prompt, key, artifactFile) {
    const normalized = normalizePrompt(prompt);
    if (normalized.target?.type !== "visual-feedback-unit") return normalized;
    await persistVisualFeedbackAssets(normalized.target.feedback, {
      dir: path.join(this.assetDir, key),
      artifactFile,
    });
    return normalized;
  }
}

export async function canonicalFile(file) {
  const absolute = path.resolve(file);
  return realpath(absolute);
}

export function sessionKey(file) {
  return crypto.createHash("sha256").update(file).digest("hex").slice(0, 16);
}

function normalizePrompt(prompt) {
  const normalized = {
    uid: String(prompt.uid || ""),
    prompt: String(prompt.prompt || ""),
    selector: String(prompt.selector || ""),
    tag: String(prompt.tag || ""),
    text: String(prompt.text || ""),
  };
  const target = normalizeTarget(prompt.target);
  if (target) normalized.target = target;
  return normalized;
}

function layoutWarningKey(warning) {
  return `${warning.kind}:${warning.selector}`;
}

// A finding whose key was already delivered to the agent in a prior poll is marked persistent
// so the agent can tell a fix attempt didn't clear it, instead of treating a reload's re-report
// of the identical warning as fresh.
function normalizeLayoutWarnings(layoutWarnings, deliveredKeys = new Set()) {
  if (!Array.isArray(layoutWarnings)) return [];
  return layoutWarnings
    .filter((warning) => warning && typeof warning === "object" && !Array.isArray(warning))
    .map((warning) => {
      const selector = String(warning.selector || "");
      const kind = String(warning.kind || "layout-warning");
      return {
        selector,
        kind,
        overflowPx: normalizeFiniteNumber(warning.overflowPx),
        viewportWidth: normalizeFiniteNumber(warning.viewportWidth),
        severity: warning.severity === "warning" ? "warning" : "error",
        persistent: deliveredKeys.has(layoutWarningKey({ kind, selector })),
      };
    });
}

function normalizeFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeTarget(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;
  if (target.type === "mermaid-node") return normalizeMermaidNodeTarget(target);
  if (target.type === "visual-feedback-unit") return normalizeVisualFeedbackTarget(target);
  if (target.type === "guidance-unit" && target.unit) {
    return { type: "visual-feedback-unit", feedback: publicFeedbackFromLegacyUnit(target.unit) };
  }
  // text-range and any other/legacy target shapes pass through unchanged.
  return JSON.parse(JSON.stringify(target));
}

function normalizeVisualFeedbackTarget(target) {
  const feedback = target.feedback && typeof target.feedback === "object" ? target.feedback : {};
  return {
    type: "visual-feedback-unit",
    feedback: {
      v: 1,
      id: String(feedback.id || ""),
      state: String(feedback.state || "default"),
      drawingGroups: normalizeDrawingGroups(feedback.drawingGroups),
      htmlRefs: normalizeHtmlRefs(feedback.htmlRefs),
      notes: normalizeFeedbackNotes(feedback.notes),
      images: normalizeFeedbackImages(feedback.images),
    },
  };
}

function publicFeedbackFromLegacyUnit(unit) {
  const marks = Array.isArray(unit.marks) ? unit.marks : [];
  const drawingGroups = normalizeDrawingGroupsFromMarks(marks);
  const groupIds = drawingGroups.map((group) => group.id);
  const refs = Array.isArray(unit.refs) ? unit.refs : [];
  const htmlRefs = refs.map((ref, index) => ({
    id: "html-" + (index + 1),
    type: String(ref?.type || "dom"),
    selector: String(ref?.selector || ""),
    boundTo: groupIds,
  }));
  const markToGroup = new Map();
  for (const group of drawingGroups) for (const markId of group.markIds) markToGroup.set(markId, group.id);
  const bindTargets = (binds = []) => {
    const out = [];
    for (const bind of binds) {
      const text = String(bind || "");
      if (text.startsWith("ref:")) {
        const index = Number(text.slice(4));
        if (htmlRefs[index]) out.push(htmlRefs[index].id);
      } else if (groupIds.includes(text)) {
        out.push(text);
      } else if (markToGroup.has(text)) {
        out.push(markToGroup.get(text));
      }
    }
    return [...new Set(out)];
  };
  return {
    v: 1,
    id: String(unit.id || ""),
    state: String(unit.state || "default"),
    drawingGroups,
    htmlRefs,
    notes: (Array.isArray(unit.notes) ? unit.notes : []).map((note) => ({
      text: String(note?.text || ""),
      boundTo: bindTargets(note?.binds || []),
    })),
    images: drawingGroups.length
      ? { annotatedDrawings: "generate-from-drawings" }
      : { cleanScreenshot: "generate-on-send" },
  };
}

function normalizeDrawingGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.map((group, index) => ({
    id: String(group?.id || "draw-" + (index + 1)),
    label: String(group?.label || String.fromCharCode(65 + index)),
    markIds: Array.isArray(group?.markIds) ? group.markIds.map(String) : [],
    markTypes: Array.isArray(group?.markTypes) ? group.markTypes.map(String) : [],
    tags: Array.isArray(group?.tags) ? group.tags.map(String) : [],
  }));
}

function normalizeDrawingGroupsFromMarks(marks) {
  const groups = new Map();
  for (const mark of marks) {
    const key = String(mark?.group || mark?.id || "");
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, { id: key, label: String.fromCharCode(65 + groups.size), markIds: [], markTypes: [], tags: [] });
    }
    const group = groups.get(key);
    if (mark?.id) group.markIds.push(String(mark.id));
    if (mark?.type && !group.markTypes.includes(String(mark.type))) group.markTypes.push(String(mark.type));
    if (mark?.tag && !group.tags.includes(String(mark.tag))) group.tags.push(String(mark.tag));
  }
  return [...groups.values()];
}

function normalizeHtmlRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs.map((ref, index) => ({
    id: String(ref?.id || "html-" + (index + 1)),
    uid: String(ref?.uid || ""),
    type: String(ref?.type || "dom"),
    selector: String(ref?.selector || ""),
    text: String(ref?.text || ""),
    boundTo: Array.isArray(ref?.boundTo) ? ref.boundTo.map(String) : [],
  }));
}

function normalizeFeedbackNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map((note) => ({
    text: String(note?.text || ""),
    boundTo: Array.isArray(note?.boundTo) ? note.boundTo.map(String) : [],
  }));
}

function normalizeFeedbackImages(images) {
  if (!images || typeof images !== "object" || Array.isArray(images)) return {};
  const out = {};
  if (typeof images.drawingOverlayPng === "string" && images.drawingOverlayPng.startsWith("data:image/png")) {
    out.drawingOverlayPng = images.drawingOverlayPng;
  }
  if (typeof images.annotatedDrawings === "string") out.annotatedDrawings = images.annotatedDrawings;
  if (typeof images.cleanScreenshot === "string") out.cleanScreenshot = images.cleanScreenshot;
  return out;
}

async function persistVisualFeedbackAssets(feedback, { dir, artifactFile }) {
  if (!feedback || typeof feedback !== "object") return;
  const images = feedback.images && typeof feedback.images === "object" ? feedback.images : {};
  const dataUrl = typeof images.drawingOverlayPng === "string" ? images.drawingOverlayPng : "";
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return;

  const unitDir = path.join(dir, sanitizePathPart(feedback.id));
  await mkdir(unitDir, { recursive: true });
  const imagePath = path.join(unitDir, "drawing-overlay.png");
  const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  await writeFile(imagePath, buffer);

  delete images.drawingOverlayPng;
  images.drawingOverlayPngPath = imagePath;
  const assets = [
    {
      id: "drawing-overlay",
      kind: "drawing-overlay-png",
      path: imagePath,
      bytes: buffer.length,
    },
  ];

  // Composite the marks onto a screenshot of the artifact so the agent
  // inspects the marks-on-the-page image, not the transparent overlay.
  // Best-effort: on any failure the transparent overlay stays the visualPath.
  let visualPath = imagePath;
  if (artifactFile) {
    const compositePath = await renderComposite({
      artifactFile,
      overlayPngPath: imagePath,
      outPath: path.join(unitDir, "annotated.png"),
      state: String(feedback.state || "default"),
    });
    if (compositePath) {
      visualPath = compositePath;
      const compositeStats = await stat(compositePath);
      assets.unshift({
        id: "annotated",
        kind: "annotated-composite-png",
        path: compositePath,
        bytes: compositeStats.size,
      });
    }
  }

  images.visualPath = visualPath;
  images.assets = assets;
  feedback.visualPath = visualPath;
}

function sanitizePathPart(value) {
  const text = String(value || "").trim();
  const safe = text.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || crypto.randomUUID();
}
