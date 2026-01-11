import { getSandbox } from "@cloudflare/sandbox";

export async function executeCode(
  env: Env, 
  language: 'python' | 'javascript', 
  code: string, 
  dependencies: string[] = []
) {
  // 1. Initialize Sandbox
  const sandbox = getSandbox(env.CODE_SANDBOX);

  // 2. Install Dependencies (Python only for this example)
  if (language === 'python' && dependencies.length > 0) {
    await sandbox.exec(["pip", "install", ...dependencies]);
  }

  // 3. Write Source File
  const filename = language === 'python' ? 'main.py' : 'index.js';
  await sandbox.fs.writeFile(filename, code);

  // 4. Execute
  const cmd = language === 'python' ? ["python", filename] : ["node", filename];
  const result = await sandbox.exec(cmd);

  // 5. Handle Output
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "Unknown execution error");
  }

  return result.stdout;
}
