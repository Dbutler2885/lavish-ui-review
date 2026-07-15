import { createHomeOutput } from "./cli.js";
import { PLAYBOOK_ROUTER_HELP } from "./playbooks.js";

// Trigger string Claude Code (and other agents) match against to auto-load the skill.
// Kept terse and outcome-focused so it fires on "about to show something visual" intents.
export const SKILL_DESCRIPTION =
  "Turn complex or visual agent responses into rich, reviewable HTML artifacts the user can " +
  "annotate and send feedback on, using the lavish-axi CLI. Use when about to give a plan, " +
  "comparison, diagram, table, code diff, report, or anything easier to grasp visually than as prose.";

export const UI_REVIEW_SKILL_DESCRIPTION =
  "Run iterative visual UI reviews with annotated HTML or screenshot-backed surfaces, including " +
  "mobile and desktop States, drawing marks, DOM references, queued feedback, and agent code edits. " +
  "Use when refining an existing or proposed interface through a visual feedback loop. Do not use " +
  "for general non-UI visual explanations; use the original lavish skill instead.";

export const UI_REVIEW_LAUNCHER =
  "npm exec --yes --prefer-online --package=github:Dbutler2885/lavish-axi#main -- lavish-ui-review";

function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function playbookList(playbooks) {
  return playbooks.map((p) => `- \`${p.id}\` - ${p.use_when}`).join("\n");
}

function skillCommandText(text) {
  return text.replaceAll("`lavish-axi", "`npx -y lavish-axi");
}

/**
 * Render the installable SKILL.md for the lavish skill. The body mirrors what
 * `lavish-axi` prints with no arguments (minus live session state), while the
 * frontmatter adds discovery metadata for Agent Skills and Hermes Agent.
 *
 * @returns {string} full SKILL.md contents including YAML frontmatter
 */
export function createSkillMarkdown() {
  const home = createHomeOutput({ bin: "lavish-axi", sessions: [], includeSessions: false });

  return `---
name: lavish
description: ${SKILL_DESCRIPTION}
argument-hint: <what the artifact should show>
author: Kun Chen (kunchenguid)
metadata:
  hermes:
    tags: [html, review, artifacts, visualization]
    category: productivity
---

# Lavish Editor

${skillCommandText(home.description)}

You do not need lavish-axi installed globally - invoke it with \`npx -y lavish-axi <html-file>\`.
If lavish-axi output shows a follow-up command starting with \`lavish-axi\`, run it as \`npx -y lavish-axi ...\` instead.

## Request

$ARGUMENTS

If the request above is non-empty, the user invoked \`/lavish\` explicitly - build an HTML artifact for that request now, following the workflow below.
If it is empty, infer what to visualize from the conversation.

## When to use

${home.help[home.help.length - 1]}

## Workflow

1. Create the HTML artifact (default location \`.lavish/<name>.html\` in the working directory).
2. Run \`npx -y lavish-axi <html-file>\` to open or resume a review session in the browser.
3. Run \`npx -y lavish-axi poll <html-file>\` to long-poll for the user's annotations, queued prompts, and browser-reported \`layout_warnings\`.
   The poll stays silent until the user acts or the real browser reports fresh layout warnings - leave it running, never kill it.
   If your harness limits how long a foreground command may run, run the poll as a background task; if it gets killed or times out anyway, just re-run it - queued feedback is never lost.
4. If poll returns \`layout_warnings\`, follow the returned \`next_step\`: fix and re-check fresh error-severity findings, but proceed with a note instead of looping when every current warning is persistent or low-severity.
5. Apply human feedback, then poll again with \`--agent-reply "<message>"\` to reply in the browser and keep the loop going.
6. Run \`npx -y lavish-axi end <html-file>\` when the review is finished.
7. If the user ends the session from the browser instead, \`npx -y lavish-axi <html-file>\` refuses to reopen it and says so - only pass \`--reopen\` when the user asks for further review or something genuinely important needs their visual attention. Otherwise deliver remaining updates directly in this conversation.

## Visual guidance

${bullets(home.visual_guidance)}

## Playbooks

Run \`npx -y lavish-axi playbook <id>\` for focused, detailed guidance on any of these.
${PLAYBOOK_ROUTER_HELP}
For flows, architecture, state, or sequence diagrams, do not hand-build boxes-and-arrows from div/flexbox; open the diagram playbook and use Mermaid unless SVG is needed for richly annotated nodes.

${playbookList(home.playbooks)}

## Commands & rules

${bullets(home.help.map(skillCommandText))}
`;
}

export function createUiReviewSkillMarkdown() {
  return `---
name: lavish-ui-review
description: ${UI_REVIEW_SKILL_DESCRIPTION}
---

# Lavish UI Review

Use Lavish UI Review as an iterative interface-design loop.
Keep the original \`lavish\` skill for general visual explanations and rich response artifacts.

## Request

$ARGUMENTS

## Choose the review surface

1. Use the real HTML artifact when reviewing a proposed interface or a model-generated mockup.
2. Embed a screenshot in a fixed HTML surface when reviewing an existing application capture.
3. Use multiple named States when comparing variants such as current, proposed, mobile, and desktop.

When an HTML artifact has multiple States, expose one root with \`data-lavish-state-root\` and its active \`data-state\`, expose each available State through a descendant \`[data-state]\`, and implement \`window.setState(id)\` to reveal the requested State.
Lavish owns the State tabs, drawing buckets, queued-edit counts, and State-specific feedback images.

## Run the feedback loop

1. Create or identify the review HTML file.
2. Run \`${UI_REVIEW_LAUNCHER} <html-file>\`.
3. Run \`${UI_REVIEW_LAUNCHER} poll <html-file>\` and leave the long poll running while the user reviews.
4. Read every returned feedback unit's State, note, marks, DOM references, and image path before editing.
5. Apply feedback sequentially and verify the affected State in a real browser.
6. Run \`${UI_REVIEW_LAUNCHER} poll <html-file> --agent-reply "<message>"\` to continue the same session.
7. Run \`${UI_REVIEW_LAUNCHER} end <html-file>\` only when the review is genuinely finished.

Do not recreate an existing application as approximate HTML merely to annotate it.
Use a screenshot-backed surface for an existing UI and reserve HTML mockups for proposed interfaces and alternatives.
Do not collapse multiple feedback States into the default State.
Treat rough marks as intent and make precise implementation decisions in the target codebase.
`;
}
