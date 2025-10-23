import { createApp } from "../_shared/app.ts";

const app = createApp();

Deno.serve(app.fetch);
