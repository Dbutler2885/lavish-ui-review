/* global EventSource, document, location, window */

const sessionDataElement = document.getElementById("lavish-session");
const sessionData = JSON.parse(sessionDataElement?.textContent || "{}");
const key = String(sessionData.key || "");
const filePath = String(sessionData.file || "");
const queueStorageKey = "lavish-axi:queued:" + key;
const internalQueueKeyField = "_lavishQueueKey";
const initialChat = Array.isArray(sessionData.initialChat) ? sessionData.initialChat : [];
const MODE_TOGGLE_HOTKEY_KEY = String(sessionData.modeToggleHotkeyKey || "").toLowerCase();

function isModeToggleHotkeyEvent(event) {
  if (event.shiftKey || event.altKey) return false;
  return Boolean(event.metaKey || event.ctrlKey) && String(event.key || "").toLowerCase() === MODE_TOGGLE_HOTKEY_KEY;
}

const frame = /** @type {HTMLIFrameElement} */ (document.getElementById("artifact"));
const annotationPills = /** @type {HTMLDivElement} */ (document.getElementById("annotationPills"));
const chatLog = /** @type {HTMLDivElement} */ (document.getElementById("chatLog"));
const chatInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("chatInput"));
const sendButton = /** @type {HTMLButtonElement} */ (document.getElementById("send"));
const sendCaret = /** @type {HTMLButtonElement} */ (document.getElementById("sendCaret"));
const sendActions = /** @type {HTMLDivElement} */ (document.getElementById("sendActions"));
const sendMenu = /** @type {HTMLDivElement} */ (document.getElementById("sendMenu"));
const sendFromMenuButton = /** @type {HTMLButtonElement} */ (document.getElementById("sendFromMenu"));
const sendAndEndButton = /** @type {HTMLButtonElement} */ (document.getElementById("sendAndEnd"));
const annotationSwitch = /** @type {HTMLButtonElement} */ (document.getElementById("annotation"));
const drawToolbar = /** @type {HTMLDivElement} */ (document.getElementById("drawToolbar"));
const drawToggle = /** @type {HTMLButtonElement} */ (document.getElementById("drawToggle"));
const drawStatus = /** @type {HTMLSpanElement} */ (document.getElementById("drawStatus"));
const drawToolButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("[data-draw-tool]")]);
const drawStrokeButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("[data-draw-stroke]")]);
const drawActionButtons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("[data-draw-action]")]);
const queueEditor = /** @type {HTMLDivElement} */ (document.getElementById("queueEditor"));
const queueEditorTitle = /** @type {HTMLDivElement} */ (document.getElementById("queueEditorTitle"));
const queueEditorInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("queueEditorInput"));
const queueEditorQueue = /** @type {HTMLButtonElement} */ (document.getElementById("queueEditorQueue"));
const queueEditorCancel = /** @type {HTMLButtonElement} */ (document.getElementById("queueEditorCancel"));
const panel = /** @type {HTMLElement} */ (document.getElementById("panel"));
const panelToggle = /** @type {HTMLButtonElement} */ (document.getElementById("panelToggle"));
const panelReopen = /** @type {HTMLButtonElement} */ (document.getElementById("panelReopen"));
const panelReopenCount = /** @type {HTMLSpanElement} */ (document.getElementById("panelReopenCount"));
const moreWrap = /** @type {HTMLDivElement} */ (document.getElementById("moreWrap"));
const moreButton = /** @type {HTMLButtonElement} */ (document.getElementById("moreButton"));
const moreMenu = /** @type {HTMLDivElement} */ (document.getElementById("moreMenu"));
const reloadArtifactButton = /** @type {HTMLButtonElement} */ (document.getElementById("reloadArtifact"));
const copySnapshotButton = /** @type {HTMLButtonElement} */ (document.getElementById("copySnapshot"));
const exportArtifactButton = /** @type {HTMLButtonElement} */ (document.getElementById("exportArtifact"));
const shareArtifactButton = /** @type {HTMLButtonElement} */ (document.getElementById("shareArtifact"));
const shareDialog = /** @type {HTMLDivElement} */ (document.getElementById("shareDialog"));
const shareForm = /** @type {HTMLFormElement} */ (document.getElementById("shareForm"));
const shareCloseButton = /** @type {HTMLButtonElement} */ (document.getElementById("shareClose"));
const shareCancelButton = /** @type {HTMLButtonElement} */ (document.getElementById("shareCancel"));
const sharePublishButton = /** @type {HTMLButtonElement} */ (document.getElementById("sharePublish"));
const sharePasswordInput = /** @type {HTMLInputElement} */ (document.getElementById("sharePassword"));
const shareStatus = /** @type {HTMLDivElement} */ (document.getElementById("shareStatus"));
const shareResult = /** @type {HTMLDivElement} */ (document.getElementById("shareResult"));
const shareUrlInput = /** @type {HTMLInputElement} */ (document.getElementById("shareUrl"));
const shareUpdateKeyInput = /** @type {HTMLInputElement} */ (document.getElementById("shareUpdateKey"));
const copyShareUrlButton = /** @type {HTMLButtonElement} */ (document.getElementById("copyShareUrl"));
const copyUpdateKeyButton = /** @type {HTMLButtonElement} */ (document.getElementById("copyUpdateKey"));
const endButton = /** @type {HTMLButtonElement} */ (document.getElementById("end"));
const copyPathButton = /** @type {HTMLButtonElement} */ (document.getElementById("copyPath"));
const copyHint = /** @type {HTMLSpanElement} */ (document.getElementById("copyHint"));
const copyHintText = /** @type {HTMLSpanElement} */ (document.getElementById("copyHintText"));
const presenceBanner = /** @type {HTMLDivElement} */ (document.getElementById("presenceBanner"));
const endedOverlay = /** @type {HTMLDivElement} */ (document.getElementById("endedOverlay"));
const layoutGateOverlay = /** @type {HTMLDivElement} */ (document.getElementById("layoutGateOverlay"));
const layoutGateTitle = /** @type {HTMLDivElement} */ (document.getElementById("layoutGateTitle"));
const layoutGateCopy = /** @type {HTMLParagraphElement} */ (document.getElementById("layoutGateCopy"));
const layoutGateAction = /** @type {HTMLButtonElement} */ (document.getElementById("layoutGateAction"));
const layoutIssueBanner = /** @type {HTMLDivElement} */ (document.getElementById("layoutIssueBanner"));
const sendHint = /** @type {HTMLSpanElement} */ (document.getElementById("sendHint"));
const stateTabs = /** @type {HTMLDivElement} */ (document.getElementById("stateTabs"));
const artifactSrc = frame.dataset.artifactSrc || frame.getAttribute?.("data-artifact-src") || frame.src || "";

const queued = loadQueuedPrompts();
let artifactStates = [];
let activeArtifactState = "";
let annotation = true;
let ended = false;
let agentPresence = "waiting";
let pendingSnapshot = "";
const layoutGateEnabled = sessionData.layoutGateEnabled !== false;
const configuredLayoutGateMaxHoldMs = Number(sessionData.layoutGateMaxHoldMs);
const layoutGateMaxHoldMs =
  Number.isFinite(configuredLayoutGateMaxHoldMs) && configuredLayoutGateMaxHoldMs > 0
    ? Math.min(configuredLayoutGateMaxHoldMs, 60_000)
    : 12_000;
let layoutGateVisible = false;
let layoutGateArmed = false;
let layoutGateManuallyBypassed = !layoutGateEnabled;
let layoutGateCycle = 0;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let layoutGateTimer;
const snapshotRequests = [];
let endAfterSubmit = false;
let workingBubble = null;
let submitQueuedPromise = null;
let submitQueuedAgain = false;
let lastScroll = { x: 0, y: 0 };
const drawState = {
  active: false,
  tool: "select",
  stroke: "#ff2d55",
  canUndo: false,
  canRedo: false,
  canGroup: false,
  summary: "Nothing selected",
  hasSelection: false,
};
/** @type {ReturnType<typeof setTimeout> | undefined} */
let copyHintTimer;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let sendHintTimer;

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function loadQueuedPrompts() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(queueStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((prompt) => prompt && typeof prompt === "object") : [];
  } catch {
    return [];
  }
}

function promptSurfaceState(prompt) {
  return String(prompt?.target?.feedback?.state || "").trim();
}

function queuedStateCounts() {
  const counts = new Map();
  for (const prompt of queued) {
    const state = promptSurfaceState(prompt);
    if (state) counts.set(state, (counts.get(state) || 0) + 1);
  }
  return counts;
}

function persistQueuedPrompts() {
  try {
    if (queued.length) {
      sessionStorage.setItem(queueStorageKey, JSON.stringify(queued));
    } else {
      sessionStorage.removeItem(queueStorageKey);
    }
  } catch {
    // The in-memory queue still works if browser storage is unavailable.
  }
}

function render() {
  annotationPills.innerHTML = queued
    .map((prompt, index) => {
      const state = promptSurfaceState(prompt);
      return (
        '<div class="pill-wrap"><div class="pill">' +
        (state ? '<span class="pill-state">' + escapeHtml(state) + "</span>" : "") +
        '<span class="pill-preview">' +
        escapeHtml(prompt.prompt) +
        '</span><button class="pill-close" type="button" aria-label="Remove queued prompt" data-index="' +
        index +
        '"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" focusable="false"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div><div class="pill-tooltip">' +
        (state ? '<div class="tooltip-label">State</div><div>' + escapeHtml(state) + "</div>" : "") +
        (prompt.selector
          ? '<div class="tooltip-label">Target</div><div class="pill-tooltip-target">' +
            escapeHtml(prompt.selector) +
            "</div>"
          : "") +
        '<div class="tooltip-label">Prompt</div><div class="pill-tooltip-prompt">' +
        escapeHtml(prompt.prompt) +
        "</div></div></div>"
      );
    })
    .join("");

  for (const button of annotationPills.querySelectorAll(".pill-close")) {
    const closeButton = /** @type {HTMLButtonElement} */ (button);
    closeButton.addEventListener("click", (event) => removeQueuedPrompt(Number(closeButton.dataset.index), event));
  }
  if (panelReopenCount) {
    panelReopenCount.hidden = queued.length === 0;
    panelReopenCount.textContent = String(queued.length);
  }
  renderStateTabs(artifactStates, activeArtifactState);
  updateSendState();
}

function updateSendState() {
  sendButton.disabled = ended || agentPresence === "working";
  sendCaret.disabled = ended || agentPresence === "working";
  sendFromMenuButton.disabled = sendButton.disabled;
}

function showSendHint() {
  sendHint.hidden = false;
  clearTimeout(sendHintTimer);
  sendHintTimer = setTimeout(() => {
    sendHint.hidden = true;
  }, 2600);
  chatInput.focus();
}

function hideSendHint() {
  clearTimeout(sendHintTimer);
  sendHint.hidden = true;
}

function setMenuOpen(button, menu, open) {
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function closeMenus() {
  setMenuOpen(moreButton, moreMenu, false);
  setMenuOpen(sendCaret, sendMenu, false);
}

function toggleMenu(button, menu) {
  const open = menu.hidden;
  closeMenus();
  setMenuOpen(button, menu, open);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea-based fallback below.
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
  return true;
}

function setPanelMinimized(minimized) {
  if (!panel || !panelReopen) return;
  panel.classList.toggle("minimized", minimized);
  panelReopen.hidden = !minimized;
  if (!minimized) {
    panelReopen.classList.remove("has-news");
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

if (panelToggle) panelToggle.addEventListener("click", () => setPanelMinimized(true));
if (panelReopen) panelReopen.addEventListener("click", () => setPanelMinimized(false));

function addChat(role, text) {
  if (!text) return;

  const el = document.createElement("div");
  el.className = "bubble " + role;
  el.innerHTML = "<small>" + (role === "agent" ? "Agent" : "You") + "</small><div>" + escapeHtml(text) + "</div>";
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  // Surface agent replies that arrive while the panel is minimized.
  if (role === "agent" && panel && panel.classList.contains("minimized") && panelReopen) {
    panelReopen.classList.add("has-news");
  }
}

function syncChat(chat) {
  for (const el of [...chatLog.querySelectorAll(".bubble.user,.bubble.agent:not(.agent-working)")]) {
    el.remove();
  }

  for (const item of chat) addChat(item.role, item.text);
  if (workingBubble) chatLog.appendChild(workingBubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setAgentPresence(state) {
  agentPresence = state === "listening" || state === "working" ? state : "waiting";
  updateSendState();
  if (presenceBanner) presenceBanner.hidden = ended || agentPresence !== "waiting";

  if (agentPresence !== "working") {
    if (workingBubble) workingBubble.remove();
    workingBubble = null;
    return;
  }

  if (!workingBubble) {
    workingBubble = document.createElement("div");
    workingBubble.className = "bubble agent agent-working";
    workingBubble.innerHTML = '<span class="spinner"></span><span>Working...</span>';
    chatLog.appendChild(workingBubble);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function removeQueuedPrompt(index, event) {
  if (event) event.stopPropagation();
  queued.splice(index, 1);
  persistQueuedPrompts();
  render();
}

function promptQueueKey(prompt) {
  return prompt && typeof prompt[internalQueueKeyField] === "string" ? prompt[internalQueueKeyField].trim() : "";
}

function removeQueuedPromptByKey(queueKey) {
  const keyValue = String(queueKey || "").trim();
  if (!keyValue) return;
  const next = queued.filter((prompt) => promptQueueKey(prompt) !== keyValue);
  if (next.length === queued.length) return;
  queued.splice(0, queued.length, ...next);
  persistQueuedPrompts();
  render();
}

function sentPromptLabel(prompt) {
  if (!prompt || typeof prompt !== "object") return "";
  const tag = String(prompt.tag || "");
  const targetType = String(prompt.target?.type || "");
  if (tag === "feedback-unit" || targetType === "visual-feedback-unit" || targetType === "guidance-unit") {
    return String(prompt.text || prompt.prompt || "Drawing feedback");
  }
  return String(prompt.prompt || "");
}

function sentPromptSummary(prompts) {
  const labels = prompts.map(sentPromptLabel).filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return labels.map((label) => "- " + label).join("\n");
}

function enqueuePrompt(prompt) {
  if (!prompt || typeof prompt !== "object") return;

  const queueKey = promptQueueKey(prompt);
  if (queueKey) {
    const index = queued.findIndex((item) => promptQueueKey(item) === queueKey);
    if (index !== -1) {
      queued[index] = prompt;
    } else {
      queued.push(prompt);
    }
  } else {
    queued.push(prompt);
  }

  persistQueuedPrompts();
  render();
}

function stripInternalPromptFields(prompt) {
  if (!prompt || typeof prompt !== "object") return prompt;
  const clean = { ...prompt };
  delete clean[internalQueueKeyField];
  return clean;
}

function postToFrame(message) {
  if (frame.contentWindow) frame.contentWindow.postMessage(message, "*");
}

function isEditableTarget(target) {
  if (!target || typeof target !== "object") return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || Boolean(target.isContentEditable);
}

function renderDrawToolbar() {
  if (!drawToolbar) return;
  drawToolbar.classList.toggle("active", drawState.active);
  drawToggle?.setAttribute("aria-pressed", String(drawState.active));
  if (drawToggle) drawToggle.title = drawState.active ? "Disable markup layer" : "Enable markup layer";
  for (const button of drawToolButtons) {
    button.classList.toggle("active", button.dataset.drawTool === drawState.tool);
  }
  for (const button of drawStrokeButtons) {
    button.classList.toggle("active", button.dataset.drawStroke === drawState.stroke);
  }
  for (const button of drawActionButtons) {
    const action = button.dataset.drawAction;
    button.disabled =
      (action === "undo" && !drawState.canUndo) ||
      (action === "redo" && !drawState.canRedo) ||
      (action === "group" && !drawState.canGroup);
  }
  if (drawStatus) drawStatus.textContent = drawState.summary || "Nothing selected";
}

// The editing card is docked at the top of the sidebar rather than floating
// over the artifact. It reveals its body when the artifact reports a selection
// and keeps its reserved slot (empty placeholder) otherwise.
function renderQueueEditor() {
  if (!queueEditor) return;
  const empty = !drawState.hasSelection;
  const wasEmpty = queueEditor.getAttribute("data-empty") === "true";
  queueEditor.setAttribute("data-empty", String(empty));
  if (queueEditorTitle) queueEditorTitle.textContent = empty ? "Queue an edit" : drawState.summary;
  if (empty) {
    if (!wasEmpty && queueEditorInput) queueEditorInput.value = "";
    return;
  }
  // Focus the composer as the selection appears so the user can type immediately.
  if (wasEmpty && queueEditorInput) queueEditorInput.focus();
}

function updateDrawState(state) {
  if (!state || typeof state !== "object") return;
  drawState.active = Boolean(state.active);
  drawState.tool = String(state.tool || drawState.tool);
  drawState.stroke = String(state.stroke || drawState.stroke);
  drawState.canUndo = Boolean(state.canUndo);
  drawState.canRedo = Boolean(state.canRedo);
  drawState.canGroup = Boolean(state.canGroup);
  drawState.summary = String(state.summary || "Nothing selected");
  drawState.hasSelection = Boolean(state.hasSelection);
  renderDrawToolbar();
  renderQueueEditor();
}

function submitQueueEditor() {
  sendDrawCommand({ command: "queue", note: queueEditorInput ? queueEditorInput.value : "" });
  if (queueEditorInput) queueEditorInput.value = "";
}

function cancelQueueEditor() {
  if (queueEditorInput) queueEditorInput.value = "";
  sendDrawCommand({ command: "clearSelection" });
}

function sendDrawCommand(command) {
  postToFrame({ type: "lavish:draw:command", ...command });
}

function renderStateTabs(states, active) {
  if (!stateTabs) return;
  const names = [...new Set((Array.isArray(states) ? states : []).map(String).filter(Boolean))];
  artifactStates = names;
  activeArtifactState = String(active || "");
  const feedbackCounts = queuedStateCounts();
  stateTabs.replaceChildren();
  const visible = names.length > 1;
  stateTabs.hidden = !visible;
  document.body.classList.toggle("has-state-tabs", visible);
  if (!visible) return;
  for (const name of names) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "state-tab";
    tab.textContent = name;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(name === active));
    tab.classList.toggle("active", name === active);
    tab.onclick = () => postToFrame({ type: "lavish:state:set", state: name });
    const feedbackCount = feedbackCounts.get(name) || 0;
    if (feedbackCount) {
      const badge = document.createElement("span");
      badge.className = "state-tab-count";
      badge.textContent = String(feedbackCount);
      badge.setAttribute("aria-label", feedbackCount === 1 ? "1 queued edit" : `${feedbackCount} queued edits`);
      tab.appendChild(badge);
    }
    stateTabs.appendChild(tab);
  }
}

function mountDrawToolbar() {
  if (!drawToolbar) return;
  postToFrame({ type: "lavish:draw:chromeMounted" });
  sendDrawCommand({ command: "requestState" });
}

function requestSnapshot(action) {
  snapshotRequests.push(action);
  postToFrame({ type: "lavish:requestSnapshot" });
}

function sendQueued(endAfter) {
  if (ended || agentPresence === "working") return;
  closeMenus();

  const text = chatInput.value.trim();
  if (text) {
    queued.push({ uid: "", prompt: text, selector: "", tag: "message", text: "Freeform message" });
    persistQueuedPrompts();
    chatInput.value = "";
    render();
  }
  if (!queued.length) {
    if (endAfter) {
      endSession();
    } else {
      showSendHint();
    }
    return;
  }
  hideSendHint();

  if (endAfter) endAfterSubmit = true;
  requestSnapshot("submit");
}

async function submitQueued() {
  if (submitQueuedPromise) {
    submitQueuedAgain = true;
    return submitQueuedPromise;
  }

  let succeeded = false;
  submitQueuedPromise = submitQueuedOnce();
  try {
    const result = await submitQueuedPromise;
    succeeded = true;
    return result;
  } finally {
    submitQueuedPromise = null;
    const shouldSubmitAgain = submitQueuedAgain;
    submitQueuedAgain = false;
    if (!succeeded) {
      endAfterSubmit = false;
    } else if (!ended && shouldSubmitAgain) {
      if (queued.length) {
        submitQueued();
      } else if (endAfterSubmit) {
        endAfterSubmit = false;
        endSession();
      }
    }
  }
}

async function submitQueuedOnce() {
  const prompts = queued.slice();
  const shouldEndSession = endAfterSubmit;
  const body = { prompts: prompts.map(stripInternalPromptFields), domSnapshot: pendingSnapshot };
  if (shouldEndSession) body.endSession = true;
  const response = await fetch("/api/" + key + "/prompts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("failed to submit queued prompts");
  addChat("user", sentPromptSummary(prompts));
  for (const prompt of prompts) {
    const index = queued.indexOf(prompt);
    if (index !== -1) queued.splice(index, 1);
  }
  persistQueuedPrompts();
  render();
  if (shouldEndSession) {
    endAfterSubmit = false;
    markSessionEnded();
    return;
  }
  if (agentPresence === "listening") setAgentPresence("working");
}

function normalizeLayoutWarningsPayload(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function isErrorLayoutWarning(warning) {
  return String(warning?.severity || "").toLowerCase() === "error";
}

function setLayoutIssueBanner(visible, text = "This surface may have layout issues. Your agent has been notified.") {
  if (!layoutIssueBanner) return;
  layoutIssueBanner.textContent = text;
  layoutIssueBanner.hidden = !visible;
}

function clearLayoutGateTimer() {
  if (layoutGateTimer) clearTimeout(layoutGateTimer);
  layoutGateTimer = undefined;
}

function setLayoutGateCard(state) {
  if (!layoutGateTitle || !layoutGateCopy) return;

  if (state === "held") {
    layoutGateTitle.innerHTML = "Fixing a layout issue...";
    layoutGateCopy.textContent =
      "The real browser found overflow or overlapping content. Your agent has been notified and this will reveal after the next clean reload.";
    return;
  }

  layoutGateTitle.innerHTML = "Checking layout.<br>One moment.";
  layoutGateCopy.textContent = "Lavish is waiting for fonts and final geometry before revealing this artifact.";
}

function setLayoutGateActive(active) {
  layoutGateVisible = active;
  if (layoutGateOverlay) layoutGateOverlay.hidden = !active;
  document.body?.classList?.toggle("layout-gate-active", active);
}

function revealLayoutGate({ showBanner = false, bannerText = undefined } = {}) {
  clearLayoutGateTimer();
  layoutGateArmed = false;
  setLayoutGateActive(false);
  setLayoutIssueBanner(showBanner, bannerText);
}

function forceRevealLayoutGate(reason) {
  if (!layoutGateEnabled || ended) return;
  if (reason === "manual") layoutGateManuallyBypassed = true;
  const bannerText =
    reason === "timeout"
      ? "This surface may have layout issues. Lavish revealed it after the safety timeout so review is never blocked."
      : "This surface may have layout issues. You chose to show it before the layout check passed.";
  revealLayoutGate({ showBanner: true, bannerText });
}

function startLayoutGateCycle() {
  if (!layoutGateEnabled || layoutGateManuallyBypassed || ended) return;

  layoutGateCycle += 1;
  layoutGateArmed = true;
  setLayoutIssueBanner(false);
  setLayoutGateCard("checking");
  setLayoutGateActive(true);
  clearLayoutGateTimer();

  const cycle = layoutGateCycle;
  layoutGateTimer = setTimeout(() => {
    if (cycle !== layoutGateCycle || !layoutGateVisible || ended) return;
    forceRevealLayoutGate("timeout");
  }, layoutGateMaxHoldMs);
  layoutGateTimer?.unref?.();
}

function handleLayoutWarningsForGate(layoutWarnings) {
  const warnings = normalizeLayoutWarningsPayload(layoutWarnings);
  const hasErrors = warnings.some(isErrorLayoutWarning);

  if (!layoutGateEnabled) return;

  if (layoutGateManuallyBypassed) {
    setLayoutIssueBanner(hasErrors);
    return;
  }

  if (!layoutGateArmed && !layoutGateVisible) return;

  if (!hasErrors) {
    revealLayoutGate();
    return;
  }

  setLayoutGateCard("held");
  setLayoutGateActive(true);
}

function initializeLayoutGate() {
  if (!layoutGateEnabled) {
    setLayoutGateActive(false);
    setLayoutIssueBanner(false);
    return;
  }

  if (layoutGateAction) layoutGateAction.onclick = () => forceRevealLayoutGate("manual");
  startLayoutGateCycle();
}

async function submitLayoutWarnings(layoutWarnings) {
  const response = await fetch("/api/" + key + "/layout-warnings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ layout_warnings: normalizeLayoutWarningsPayload(layoutWarnings) }),
  });
  if (!response.ok) throw new Error("failed to submit layout warnings");
}

async function endSession() {
  if (ended) return;
  const response = await fetch("/api/" + key + "/end", { method: "POST" });
  if (!response.ok) throw new Error("failed to end session");
  markSessionEnded();
}

function markSessionEnded() {
  if (ended) return;
  ended = true;
  closeMenus();
  annotationSwitch.disabled = true;
  moreButton.disabled = true;
  chatInput.disabled = true;
  updateSendState();
  if (presenceBanner) presenceBanner.hidden = true;
  layoutGateManuallyBypassed = true;
  revealLayoutGate();
  postToFrame({ type: "lavish:setAnnotationMode", enabled: false });
  endedOverlay.hidden = false;
}

function copyFilePath() {
  copyText(filePath);
  copyHint.classList.add("copied");
  copyHintText.textContent = "Copied";
  clearTimeout(copyHintTimer);
  copyHintTimer = setTimeout(() => {
    copyHint.classList.remove("copied");
    copyHintText.textContent = "Copy";
  }, 1600);
}

function copyDomSnapshot() {
  closeMenus();
  requestSnapshot("copy");
}

function exportFileName() {
  const base = (filePath.split(/[\\/]/).pop() || "artifact.html").replace(/\.html?$/i, "");
  return (base || "artifact") + ".export.html";
}

function setExportLabel(text) {
  const label = exportArtifactButton.querySelector("span");
  if (label) label.textContent = text;
}

function unresolvedAssetText(count) {
  return count === 1 ? "1 unresolved asset" : `${count} unresolved assets`;
}

function noticeText(count) {
  return count === 1 ? "1 notice" : `${count} notices`;
}

function exportWarningText(unresolvedCount, noticeCount) {
  if (unresolvedCount > 0 && noticeCount > 0) {
    return `${unresolvedAssetText(unresolvedCount)} and ${noticeText(noticeCount)}`;
  }
  if (unresolvedCount > 0) return unresolvedAssetText(unresolvedCount);
  return noticeText(noticeCount);
}

async function exportArtifact() {
  // The bundle inlines local assets server-side, so it can take a moment - keep the menu open
  // and narrate progress in place instead of closing it and leaving the user with no feedback.
  exportArtifactButton.disabled = true;
  setExportLabel("Exporting...");
  try {
    const response = await fetch("/api/" + key + "/export");
    if (!response.ok) throw new Error("export failed");
    const warningCount = Number(response.headers.get("x-lavish-export-warning-count") || "0");
    const noticeCount = Number(response.headers.get("x-lavish-export-notice-count") || "0");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (warningCount > 0 || noticeCount > 0) {
      setExportLabel(`Exported with ${exportWarningText(warningCount, noticeCount)}`);
    } else {
      setExportLabel("Export standalone HTML");
      closeMenus();
    }
  } catch {
    setExportLabel("Export failed - retry");
  } finally {
    exportArtifactButton.disabled = false;
  }
}

function openShareDialog() {
  closeMenus();
  shareDialog.hidden = false;
  shareStatus.textContent = "";
  shareStatus.classList.remove("error");
  shareResult.hidden = true;
  sharePasswordInput.value = "";
  sharePasswordInput.focus();
}

function closeShareDialog() {
  shareDialog.hidden = true;
}

async function copyToButton(value, button, label) {
  await copyText(value);
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

async function publishShare(event) {
  event.preventDefault();
  sharePublishButton.disabled = true;
  shareStatus.classList.remove("error");
  shareStatus.textContent = "Publishing to ht-ml.app...";
  shareResult.hidden = true;
  const password = sharePasswordInput.value.trim();
  const passwordProtected = Boolean(password);
  try {
    const response = await fetch("/api/" + key + "/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(password ? { password } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "publish failed");
    shareUrlInput.value = data.url || "";
    shareUpdateKeyInput.value = data.update_key || "";
    const unresolvedAssets = Array.isArray(data.unresolved_local_assets) ? data.unresolved_local_assets : [];
    const notices = Array.isArray(data.notices) ? data.notices : [];
    const warningCount = unresolvedAssets.length;
    const noticeCount = notices.length;
    const noticeSummary = noticeCount ? noticeText(noticeCount) : "";
    shareStatus.textContent =
      warningCount > 0
        ? `Published with ${warningCount === 1 ? "1 unresolved local asset" : `${warningCount} unresolved local assets`}${noticeSummary ? ` and ${noticeSummary}` : ""}.${passwordProtected ? " This page is PASSWORD-PROTECTED; viewers also need the password." : ""}`
        : noticeCount > 0
          ? `Published with ${noticeSummary}.${passwordProtected ? " This page is PASSWORD-PROTECTED; viewers also need the password." : ""}`
          : passwordProtected
            ? "Published. This page is PASSWORD-PROTECTED; viewers also need the password."
            : "Published. Anyone with the link can view this page.";
    shareResult.hidden = false;
    shareUrlInput.focus();
    shareUrlInput.select();
  } catch (error) {
    shareStatus.classList.add("error");
    shareStatus.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    sharePublishButton.disabled = false;
  }
}

function resetFrame() {
  startLayoutGateCycle();
  // The iframe is sandboxed, so reload by resetting the iframe URL from chrome.
  frame.src = artifactSrc || frame.src;
}

function loadFrame() {
  if (artifactSrc) frame.src = artifactSrc;
}

function reloadArtifact() {
  closeMenus();
  resetFrame();
}

async function reloadAfterServerRestart() {
  let sawOutage = false;
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch("/health", { cache: "no-store" });
      if (sawOutage && res.ok) {
        location.reload();
        return;
      }
    } catch {
      sawOutage = true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  location.reload();
}

window.addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow) return;

  const msg = event.data || {};
  if (msg.type === "lavish:queuePrompt") {
    enqueuePrompt(msg.prompt);
  }
  if (msg.type === "lavish:removeQueuedPrompt") {
    removeQueuedPromptByKey(msg.queueKey);
  }
  if (msg.type === "lavish:snapshot") {
    const snapshotAction = snapshotRequests.shift() || "submit";
    if (snapshotAction === "copy") {
      copyText(msg.snapshot || "");
    } else {
      pendingSnapshot = msg.snapshot || "";
      submitQueued();
    }
  }
  if (msg.type === "lavish:scroll") {
    lastScroll = { x: Number(msg.x) || 0, y: Number(msg.y) || 0 };
  }
  if (msg.type === "lavish:layoutWarnings") {
    handleLayoutWarningsForGate(msg.layout_warnings);
    submitLayoutWarnings(msg.layout_warnings).catch(() => {});
  }
  if (msg.type === "lavish:states") renderStateTabs(msg.states, msg.active);
  if (msg.type === "lavish:draw:state") updateDrawState(msg.state);
  if (msg.type === "lavish:sendQueuedPrompts") sendQueued();
  if (msg.type === "lavish:endSession") endSession();
  if (msg.type === "lavish:toggleAnnotationMode") toggleAnnotationMode();
});

loadFrame();

function toggleAnnotationMode() {
  if (ended) return;
  annotation = !annotation;
  annotationSwitch.setAttribute("aria-pressed", String(annotation));
  postToFrame({ type: "lavish:setAnnotationMode", enabled: annotation });
}

annotationSwitch.onclick = toggleAnnotationMode;
if (drawToggle) {
  drawToggle.onclick = () => sendDrawCommand({ command: "setActive", active: !drawState.active });
}
for (const button of drawToolButtons) {
  button.addEventListener("click", () => {
    if (!drawState.active) sendDrawCommand({ command: "setActive", active: true });
    sendDrawCommand({ command: "setTool", tool: button.dataset.drawTool });
  });
}
for (const button of drawStrokeButtons) {
  button.addEventListener("click", () => {
    if (!drawState.active) sendDrawCommand({ command: "setActive", active: true });
    sendDrawCommand({ command: "setStroke", stroke: button.dataset.drawStroke });
  });
}
for (const button of drawActionButtons) {
  button.addEventListener("click", () => sendDrawCommand({ command: "action", action: button.dataset.drawAction }));
}
renderDrawToolbar();
renderQueueEditor();

if (queueEditorQueue) queueEditorQueue.onclick = submitQueueEditor;
if (queueEditorCancel) queueEditorCancel.onclick = cancelQueueEditor;
if (queueEditorInput) {
  queueEditorInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submitQueueEditor();
    }
  });
}

sendButton.onclick = () => sendQueued(false);
sendFromMenuButton.onclick = () => sendQueued(false);
sendAndEndButton.onclick = () => sendQueued(true);
sendCaret.onclick = () => toggleMenu(sendCaret, sendMenu);
moreButton.onclick = () => toggleMenu(moreButton, moreMenu);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendQueued(false);
  }
});
chatInput.addEventListener("input", hideSendHint);
copyPathButton.onclick = copyFilePath;
reloadArtifactButton.onclick = reloadArtifact;
copySnapshotButton.onclick = copyDomSnapshot;
exportArtifactButton.onclick = exportArtifact;
shareArtifactButton.onclick = openShareDialog;
shareCloseButton.onclick = closeShareDialog;
shareCancelButton.onclick = closeShareDialog;
shareForm.addEventListener("submit", publishShare);
shareDialog.addEventListener("click", (event) => {
  if (event.target === shareDialog) closeShareDialog();
});
copyShareUrlButton.onclick = () => copyToButton(shareUrlInput.value, copyShareUrlButton, "Copy URL");
copyUpdateKeyButton.onclick = () => copyToButton(shareUpdateKeyInput.value, copyUpdateKeyButton, "Copy key");
endButton.onclick = () => {
  closeMenus();
  endSession();
};
document.addEventListener("mousedown", (event) => {
  const target = /** @type {Node} */ (event.target);
  if (!moreMenu.hidden && !moreWrap.contains(target)) setMenuOpen(moreButton, moreMenu, false);
  if (!sendMenu.hidden && !sendActions.contains(target)) setMenuOpen(sendCaret, sendMenu, false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!shareDialog.hidden) {
      closeShareDialog();
    } else {
      closeMenus();
    }
  }
});
// Capture phase so the mode hotkey fires no matter where focus is in the chrome - including
// mid-keystroke in chatInput or an annotation-card textarea - without disturbing normal typing.
document.addEventListener(
  "keydown",
  (event) => {
    if (!isModeToggleHotkeyEvent(event)) return;
    event.preventDefault();
    toggleAnnotationMode();
  },
  true,
);
// Delete/Backspace removes the current draw-layer selection. The editing card
// lives in the chrome now, and selecting a mark auto-focuses its comment box, so
// the keypress lands here rather than in the sandboxed artifact. Forward it when
// there is a selection - but stand down while the user is actually editing text:
// in the chat, or in the comment box once they've typed something. An empty,
// just-auto-focused comment box still deletes the mark, which is the whole point.
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (!drawState.hasSelection) return;
    const inEmptyComposer = event.target === queueEditorInput && !queueEditorInput.value;
    if (isEditableTarget(event.target) && !inEmptyComposer) return;
    event.preventDefault();
    sendDrawCommand({ command: "deleteSelection" });
  },
  true,
);
frame.addEventListener("load", () => {
  postToFrame({ type: "lavish:setAnnotationMode", enabled: annotation && !ended });
  mountDrawToolbar();
  // Replay the pre-reload scroll position so hot reloads don't jump the artifact to the top.
  postToFrame({ type: "lavish:restoreScroll", x: lastScroll.x, y: lastScroll.y });
});

initializeLayoutGate();

const events = new EventSource("/events/" + key);
events.addEventListener("reload", () => resetFrame());
events.addEventListener("chrome-reload", () => reloadAfterServerRestart());
events.addEventListener("agent-reply", (event) => addChat("agent", JSON.parse(event.data).text));
events.addEventListener("chat-sync", (event) => syncChat(JSON.parse(event.data).chat || []));
events.addEventListener("agent-presence", (event) => setAgentPresence(JSON.parse(event.data).state));

render();
initialChat.forEach((item) => addChat(item.role, item.text));
setAgentPresence("waiting");
