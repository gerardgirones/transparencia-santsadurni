import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const candidate = specifier.startsWith("@/")
      ? new URL(`src/${specifier.slice(2)}.ts`, root)
      : specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)
        ? new URL(`${specifier}.ts`, context.parentURL)
        : null;
    return candidate && existsSync(fileURLToPath(candidate))
      ? nextResolve(candidate.href, context)
      : nextResolve(specifier, context);
  },
});
