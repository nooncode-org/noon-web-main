/**
 * scripts/manual/test-v0-create.js
 *
 * Manual sanity check: verify v0 SDK can create a chat (no polling).
 * Run with: node --env-file=.env scripts/manual/test-v0-create.js
 */

if (!process.env.V0_API_KEY) {
  console.error("V0_API_KEY is not set. Aborting.");
  process.exit(1);
}

const { v0 } = require("v0-sdk");

async function test() {
  try {
    console.log("Sending v0 request async...");
    const result = await v0.chats.create({
      system: "You are a helpful UI engineer",
      message: "Create a simple button component with a label",
      responseMode: "async",
    });
    console.log("Got result immediately:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
