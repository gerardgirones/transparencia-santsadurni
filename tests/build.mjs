import { spawnSync } from "node:child_process";
import { existsSync, realpathSync, rmSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

// Each run must exercise the fixtures, including the simulated outage, rather
// than reusing successful responses from an earlier test build.
const projectRoot = realpathSync(process.cwd());
const cachePath = resolve(projectRoot, ".next-test/cache/fetch-cache");
if (existsSync(cachePath)) {
  const target = realpathSync(cachePath);
  const withinProject = relative(projectRoot, target);
  if (withinProject.startsWith("..") || isAbsolute(withinProject)) throw new Error("Test cache escaped the project");
  rmSync(target, {recursive:true,force:true});
}
const result = spawnSync(process.execPath, ["--import", "./tests/fixtures/mock-fetch.mjs", "node_modules/next/dist/bin/next", "build", "--webpack"], {
  stdio:"inherit", env: {...process.env, NEXT_TEST_BUILD:"1", MOCK_ANALYSIS_FAILURE:"1"},
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
