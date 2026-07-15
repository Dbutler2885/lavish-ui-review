import assert from "node:assert/strict";
import test from "node:test";

import { reviewToolbar } from "../lib/review-wrap.mjs";

test("review toolbar leaves state navigation to the Lavish chrome", () => {
  const toolbar = reviewToolbar({ title: "Dashboard", screenName: "dashboard.html", width: 1280, height: 800 });

  assert.match(toolbar, /Dashboard/);
  assert.match(toolbar, /dashboard\.html/);
  assert.doesNotMatch(toolbar, /states:/i);
  assert.doesNotMatch(toolbar, /rv-state/);
});
