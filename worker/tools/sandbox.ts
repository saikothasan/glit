import { getSandbox } from "@cloudflare/sandbox";

// Helper to access the sandbox stub
const getSb = (env: Env) => getSandbox(env.CODE_SANDBOX, "default");

type BroadcastFn = (msg: { type: string; data: any }) => void;

export async function executeCodeStream(env: Env, code: string, broadcast: BroadcastFn) {
  const sandbox = getSb(env);
  
  // 1. Write the file
  await sandbox.files.writeFile("script.py", code);

  // 2. Execute with streaming
  // We use "python3 -u" to force unbuffered output so we see print statements immediately
  const result = await sandbox.exec("python3 -u script.py", {
    stream: true,
    onOutput: (type, data) => {
      // Broadcast chunks immediately to the frontend
      broadcast({ 
        type: "terminal_chunk", 
        data: data 
      });
    }
  });

  // 3. Return final summary for the AI to analyze
  if (result.exitCode !== 0) {
    return `Execution Failed (Exit ${result.exitCode}).\nErrors:\n${result.stderr}`;
  }
  return `Execution Finished.\nOutput:\n${result.stdout}`;
}

export async function listFiles(env: Env, path: string = ".") {
  const sandbox = getSb(env);
  try {
    const files = await sandbox.files.listFiles(path);
    return files.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join("\n");
  } catch (e: any) {
    return `Error listing files: ${e.message}`;
  }
}

export async function exposePreview(env: Env, port: number = 8000) {
  const sandbox = getSb(env);
  try {
    const result = await sandbox.ports.exposePort(port, { 
      hostname: "preview.your-project.workers.dev" // Replace with your actual Worker URL if needed
    });
    return result.url;
  } catch (e: any) {
    // Fallback for local/preview
    return `http://localhost:${port} (Requires custom domain for public access)`;
  }
}
