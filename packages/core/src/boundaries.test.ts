import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../..", import.meta.url));

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

function inRepoImports(source: string): string[] {
  return [...source.matchAll(/from\s+"(@gabarito\/[^"]+)"/g)].map((match) => match[1]);
}

describe("module boundaries", () => {
  it("geometry is a leaf: it imports no other package", () => {
    for (const file of sourceFiles(join(root, "packages/geometry/src"))) {
      expect(inRepoImports(readFileSync(file, "utf8")), file).toEqual([]);
    }
  });

  it("plugin-api is a leaf: it imports no other package", () => {
    const directory = join(root, "packages/plugin-api/src");
    for (const file of sourceFiles(directory)) {
      expect(inRepoImports(readFileSync(file, "utf8")), file).toEqual([]);
    }
  });

  it("core imports geometry and nothing else", () => {
    for (const file of sourceFiles(join(root, "packages/core/src"))) {
      for (const imported of inRepoImports(readFileSync(file, "utf8"))) {
        expect(imported, file).toBe("@gabarito/geometry");
      }
    }
  });

  it("geometry and core never import three, react or the DOM", () => {
    const files = [
      ...sourceFiles(join(root, "packages/geometry/src")),
      ...sourceFiles(join(root, "packages/core/src")),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from\s+"three"/);
      expect(source, file).not.toMatch(/from\s+"react/);
      expect(source, file).not.toMatch(/\bdocument\./);
      expect(source, file).not.toMatch(/\bwindow\./);
    }
  });

  it("the ui layer never touches three or the scene package", () => {
    for (const file of sourceFiles(join(root, "packages/ui/src"))) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from\s+"three"/);
      expect(inRepoImports(source), file).not.toContain("@gabarito/scene");
      expect(inRepoImports(source), file).not.toContain("@gabarito/tools");
    }
  });

  it("tools never imports three or the scene package", () => {
    for (const file of sourceFiles(join(root, "packages/tools/src"))) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/from\s+"three"/);
      expect(inRepoImports(source), file).not.toContain("@gabarito/scene");
    }
  });

  it("feature packages import only the plugin api", () => {
    const directory = join(root, "packages/features");
    for (const file of sourceFiles(directory)) {
      for (const imported of inRepoImports(readFileSync(file, "utf8"))) {
        expect(imported, file).toBe("@gabarito/plugin-api");
      }
    }
  });
});
