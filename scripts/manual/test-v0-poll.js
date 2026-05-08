/**
 * scripts/manual/test-v0-poll.js
 *
 * Manual sanity check: verify v0 SDK getById behavior immediately after create
 * (eventual consistency check).
 * Run with: node --env-file=.env scripts/manual/test-v0-poll.js
 */

if (!process.env.V0_API_KEY) {
  console.error("V0_API_KEY is not set. Aborting.");
  process.exit(1);
}

const { v0 } = require("v0-sdk");

async function test() {
  try {
    const result = await v0.chats.create({
      system: "You are a helpful UI engineer",
      message: "Create a simple button component with a label",
      responseMode: "async",
    });
    console.log("Created:", result.id);

    // Check instantly
    try {
      await v0.chats.getById({ chatId: result.id });
      console.log("Instant GET succeeded!");
    } catch (e) {
      console.error("Instant GET failed:", e.message);
    }

    // Check after 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await v0.chats.getById({ chatId: result.id });
      console.log("2-sec GET succeeded!");
    } catch (e) {
      console.error("2-sec GET failed:", e.message);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
