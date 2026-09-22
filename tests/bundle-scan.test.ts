import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { getLevelDefs } from "../src/lib/levels";

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe("Static Client Bundle Security Scan", () => {
  it("ensures no secret passphrases or system prompts leak into .next/static client bundles", () => {
    const staticDir = path.join(process.cwd(), ".next", "static");
    expect(
      fs.existsSync(staticDir),
      ".next/static directory not found. Run 'npm run build' before running bundle-scan test."
    ).toBe(true);

    const files = getAllFiles(staticDir);
    const levels = getLevelDefs();
    const secretsToScan = [
      ...levels.map((l) => l.passphrase),
      ...levels.map((l) => l.decoy).filter((d): d is string => !!d),
      "You are VAULT-9",
    ];

    for (const filePath of files) {
      // Only scan text/js files
      if (!filePath.endsWith(".js") && !filePath.endsWith(".css") && !filePath.endsWith(".html")) {
        continue;
      }
      const content = fs.readFileSync(filePath, "utf8").toLowerCase();

      for (const secret of secretsToScan) {
        const secretLower = secret.toLowerCase();
        // Secrets should NEVER be statically bundled into client-side code
        expect(content.includes(secretLower)).toBe(false);
      }
    }
  });
});
