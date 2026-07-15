import path from "node:path";

export const UI_REVIEW_APP_ID = "lavish-ui-review";
export const UI_REVIEW_COMMAND = "lavish-ui-review";
export const UI_REVIEW_DEFAULT_PORT = "4391";

export function configureUiReviewEnvironment(env, homeDirectory) {
  env.LAVISH_AXI_APP_ID ||= UI_REVIEW_APP_ID;
  env.LAVISH_AXI_COMMAND ||= UI_REVIEW_COMMAND;
  env.LAVISH_AXI_PORT ||= UI_REVIEW_DEFAULT_PORT;
  env.LAVISH_AXI_STATE_DIR ||= path.join(homeDirectory, ".lavish-ui-review");
  env.LAVISH_AXI_TELEMETRY ||= "0";
  return env;
}
