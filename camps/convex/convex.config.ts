import { defineApp } from "convex/server";
import workflow from "@convex-dev/workflow/convex.config.js";
import stripe from "@convex-dev/stripe/convex.config.js";

const app = defineApp();
app.use(workflow);
app.use(stripe);

export default app;
