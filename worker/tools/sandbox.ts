import { getSandbox } from "@cloudflare/sandbox";

export async function executeCode(env: Env, code: string, dependencies: string[] = []) {
  // Connect to the sandbox defined in wrangler.jsonc
  const sandbox = getSandbox(env.CODE_SANDBOX);

  // Write the code to a file
  await sandbox.fs.writeFile("script.py", code);

  // Install dependencies if provided
  if (dependencies.length > 0) {
      await sandbox.exec(["pip", "install", ...dependencies]);
  }

  // Execute using the pre-installed python environment
  const result = await sandbox.exec(["python3", "script.py"]);

  if (result.exitCode !== 0) {
    throw new Error(`Execution failed with code ${result.exitCode}:\n${result.stderr}`);
  }
  return result.stdout;
}
