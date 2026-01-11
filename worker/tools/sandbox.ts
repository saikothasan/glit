import { getSandbox, parseSSEStream } from "@cloudflare/sandbox";

const getSb = (env: Env) => getSandbox(env.CODE_SANDBOX, "default");

/**
 * Executes code and streams output line-by-line to the callback.
 */
export async function executeCodeStream(
  env: Env, 
  code: string, 
  onChunk: (data: string) => void
) {
  const sandbox = getSb(env);
  
  // 1. Write the code to a file
  await sandbox.files.writeFile("script.py", code);

  // 2. Start streaming execution
  // We use "python3 -u" (unbuffered) so output is sent immediately
  const stream = await sandbox.commands.execStream(["python3", "-u", "script.py"]);
  
  let fullOutput = "";

  try {
    // 3. Parse the Server-Sent Events (SSE) from the sandbox
    for await (const event of parseSSEStream(stream)) {
      if (event.type === 'stdout' || event.type === 'stderr') {
        const text = event.data + "\n";
        fullOutput += text;
        onChunk(text); // Stream to UI immediately
      } else if (event.type === 'error') {
        const errorMsg = `\n[System Error]: ${event.error}\n`;
        fullOutput += errorMsg;
        onChunk(errorMsg);
      }
    }
  } catch (e: any) {
    onChunk(`\nRuntime Exception: ${e.message}\n`);
  }

  return fullOutput;
}

export async function listFiles(env: Env, path: string = ".") {
  const sandbox = getSb(env);
  const files = await sandbox.files.listFiles(path);
  return files.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join("\n");
}

export async function exposePreview(env: Env, port: number = 8000) {
  const sandbox = getSb(env);
  const result = await sandbox.ports.exposePort(port);
  return result.url;
}
