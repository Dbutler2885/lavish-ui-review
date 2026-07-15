#!/usr/bin/env node
import os from "node:os";

import { configureUiReviewEnvironment } from "../src/ui-review-env.js";

configureUiReviewEnvironment(process.env, os.homedir());

const { run } = await import("../src/cli.js");
await run(process.argv.slice(2));
