#!/usr/bin/env node

import { Command } from "commander";
import { getAuthenticatedClient, runAuthFlow } from "./auth/oauth.js";
import { generateSlides } from "./slides/generator.js";
import { ReviewData } from "./slides/types.js";
import * as fs from "fs/promises";

const program = new Command();

program
  .name("claude-slides")
  .description("Generate Google Slides from code review data")
  .version("1.0.0");

program
  .option("--auth", "Run interactive OAuth authentication flow")
  .option("-i, --input <file>", "Input JSON file (default: stdin)")
  .option("-o, --output <format>", "Output format: url, json", "url")
  .action(async (options) => {
    try {
      if (options.auth) {
        await runAuthFlow();
        process.exit(0);
      }

      const auth = await getAuthenticatedClient();

      let inputJson: string;

      if (options.input) {
        inputJson = await fs.readFile(options.input, "utf-8");
      } else {
        inputJson = await readStdin();
      }

      const reviewData: ReviewData = JSON.parse(inputJson);

      const result = await generateSlides(auth, reviewData);

      if (options.output === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.presentationUrl);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error:", message);
      process.exit(1);
    }
  });

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(
        new Error(
          "No input received. Provide JSON via stdin or --input flag."
        )
      );
      return;
    }

    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf-8"))
    );
    process.stdin.on("error", reject);
  });
}

program.parse();
