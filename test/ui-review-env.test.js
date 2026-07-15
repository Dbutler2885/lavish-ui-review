import assert from "node:assert/strict";
import test from "node:test";

import { configureUiReviewEnvironment } from "../src/ui-review-env.js";

test("UI review runtime has an identity, port, state directory, and telemetry policy separate from Lavish", () => {
  const env = {};

  configureUiReviewEnvironment(env, "/Users/example");

  assert.equal(env.LAVISH_AXI_APP_ID, "lavish-ui-review");
  assert.equal(env.LAVISH_AXI_COMMAND, "lavish-ui-review");
  assert.equal(env.LAVISH_AXI_PORT, "4391");
  assert.equal(env.LAVISH_AXI_STATE_DIR, "/Users/example/.lavish-ui-review");
  assert.equal(env.LAVISH_AXI_TELEMETRY, "0");
});

test("UI review runtime preserves explicit environment overrides", () => {
  const env = {
    LAVISH_AXI_PORT: "5000",
    LAVISH_AXI_STATE_DIR: "/tmp/review-state",
    LAVISH_AXI_TELEMETRY: "1",
  };

  configureUiReviewEnvironment(env, "/Users/example");

  assert.equal(env.LAVISH_AXI_PORT, "5000");
  assert.equal(env.LAVISH_AXI_STATE_DIR, "/tmp/review-state");
  assert.equal(env.LAVISH_AXI_TELEMETRY, "1");
});
