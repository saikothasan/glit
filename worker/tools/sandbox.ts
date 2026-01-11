import { getSandbox } from "@cloudflare/sandbox";

export async function executeCode(env: Env, code: string) {
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

export async function listFiles(env: Env, path: string = ".") {
  const sandbox = getSandbox(env.CODE_SANDBOX);
  try {
    const files = await sandbox.fs.readdir(path);
    return files.map(f => f.name).join("\n");
  } catch (e: any) {
    return `Error listing files: ${e.message}`;
  }
}

export async function readFile(env: Env, path: string) {
  const sandbox = getSandbox(env.CODE_SANDBOX);
  try {
    // Read text file. For images, you'd handle encoding differently or stream.
    const content = await sandbox.fs.readFile(path, "utf-8");
    return content;
  } catch (e: any) {
    return `Error reading file: ${e.message}`;
  }
}
