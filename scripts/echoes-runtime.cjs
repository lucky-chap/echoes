// Run existing TypeScript modules without adding a runtime dependency.
const ts = require("typescript")
const fs = require("node:fs")
require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2023,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText,
    filename
  )
}
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local")
