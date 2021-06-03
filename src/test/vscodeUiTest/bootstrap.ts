import * as tsPaths from "tsconfig-paths";
import * as fs from "fs";
import * as path from "path";

console.log("[BOOTSTRAP SCRIPT] Loading ui test library");

if (process.env.TESTER_LIB == null) {
  throw new Error("Specify TESTER_LIB environment variable. (vscode-extension-tester|theia-extension-tester)");
}

const tsConfig = JSON.parse(fs.readFileSync("tsconfig.json", {
  encoding: "utf-8"
}));

const baseUrl = tsConfig.compilerOptions.baseUrl || "./src";
const file = process.env.TESTER_LIB === "vscode-extension-tester" ? ["out", "extester"] : ["out", "index"];

const paths = {
  "vscode-extension-tester": [path.join("..", "node_modules", process.env.TESTER_LIB, ...file)]
};

tsPaths.register({
  baseUrl,
  paths
});

console.log(`[BOOTSTRAP SCRIPT] Loaded: ${JSON.stringify(paths)}`);

// When path registration is no longer needed
// cleanup();
