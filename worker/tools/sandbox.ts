import { getSandbox } from "@cloudflare/sandbox";

export async function executeCode(env: Env, code: string) {
  // Connect to the sandbox defined in wrangler.jsonc
  const sandbox = getSandbox(env.CODE_SANDBOX);

  // Write the code to a file
  await sandbox.fs.writeFile("script.py", code);

  // Execute using the pre-installed python environment
  const result = await sandbox.exec(["python3", "script.py"]);

  if (result.exitCode !== 0) {
    return `Error: ${result.stderr}`;
  }
  return `Output:\n${result.stdout}`;
}
