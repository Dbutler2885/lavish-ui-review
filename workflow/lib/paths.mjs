// Shared path and project-file helpers for the lavish-frontend-workflow workspace.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECTS_DIR = path.join(ROOT, "projects");
export const STATE_DIR = path.join(ROOT, "state");

// Stage machine: intent construction -> build (with the mandatory visual
// self-review gate) -> iterate (the annotation/queue loop) -> approved
// -> handoff (bundle sent downstream, e.g. to First Mate).
export const STAGES = ["new", "intent", "build", "iterate", "approved", "handoff"];

// Job modes: how the mockup is sourced.
//   redesign - reproduce an existing frontend faithfully, then change it
//   extend   - build something new in an existing frontend's design language
//   new      - greenfield from intent alone
export const MODES = ["redesign", "extend", "new"];

export function projectDir(slug) {
  return path.join(PROJECTS_DIR, slug);
}

export function projectJsonPath(slug) {
  return path.join(projectDir(slug), "project.json");
}

export function readProject(slug) {
  return JSON.parse(fs.readFileSync(projectJsonPath(slug), "utf8"));
}

export function writeProject(slug, data) {
  fs.writeFileSync(projectJsonPath(slug), JSON.stringify(data, null, 2) + "\n");
}

export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((name) => fs.existsSync(path.join(PROJECTS_DIR, name, "project.json")))
    .sort();
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function timestamp() {
  return new Date().toISOString();
}
