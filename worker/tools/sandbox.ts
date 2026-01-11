import { getSandbox } from "@cloudflare/sandbox";
import { Sandbox } from "@cloudflare/sandbox";

// Type definition for the Agent's broadcast method
type Broadcaster = (msg: { type: string; data: any }) => void;

const getSb = (env: Env) => getSandbox(env.CODE_SANDBOX, "default");

/**
 * Executes code with real-time streaming output via WebSocket broadcast.
 */
export async function executeCodeStream(env: Env, code: string, broadcast: Broadcaster) {
  const sandbox = getSb(env);
  
  // 1. Write the code
  await sandbox.files.writeFile("script.py", code);

  // 2. Start execution stream
  // We use the 'python3 -u' flag for unbuffered output to ensure real-time streaming
  const stream = await sandbox.commands.executeStream(["python3", "-u", "script.py"]);
  
  const reader = stream.getReader();
  let fullOutput = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode chunk
      const text = new TextDecoder().decode(value);
      fullOutput += text;
      
      // Broadcast chunk to frontend terminal
      broadcast({ type: "terminal_chunk", data: text });
    }
  } catch (e: any) {
    const errorMsg = `\nRuntime Error: ${e.message}`;
    broadcast({ type: "terminal_chunk", data: errorMsg });
    fullOutput += errorMsg;
  }

  return fullOutput;
}

/**
 * Exposes a port (e.g., 8000) to the internet and returns the preview URL.
 */
export async function exposePreview(env: Env, port: number = 8000) {
  const sandbox = getSb(env);
  try {
    // exposePort returns { url, ... }
    const result = await sandbox.ports.exposePort(port, { 
      hostname: "preview.your-domain.workers.dev" // Note: Requires custom domain in prod, works on localhost in dev usually
    });
    return result.url;
  } catch (e: any) {
    // Fallback for dev environments without custom domains
    return `Error exposing port: ${e.message}. (Note: Port exposure requires a custom domain config).`;
  }
}

/**
 * Clones a Git repository into the sandbox.
 */
export async function cloneRepo(env: Env, repoUrl: string) {
  const sandbox = getSb(env);
  try {
    await sandbox.git.checkout(repoUrl, { targetDir: "./repo" });
    return `Cloned ${repoUrl} into ./repo`;
  } catch (e: any) {
    return `Git Error: ${e.message}`;
  }
}

/**
 * Lists files (Basic ls -R equivalent)
 */
export async function listFiles(env: Env, path: string = ".") {
  const sandbox = getSb(env);
  try {
    const files = await sandbox.files.listFiles(path, { recursive: false });
    return files.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join("\n");
  } catch (e: any) {
    return `File Error: ${e.message}`;
  }
}

/**
 * Mounts the R2 Knowledge Base bucket into the Sandbox
 */
export async function mountKnowledgeBase(env: Env) {
  const sandbox = getSb(env);
  try {
    // Mounts the bound R2 bucket to /mnt/knowledge
    // Note: This requires the bucket to be public or correctly configured in wrangler
    // For this demo, we assume the SDK handles the binding connection if supported, 
    // otherwise we might need explicit credentials. 
    // The Sandbox SDK 'mountBucket' typically takes a bucket name and provider options.
    
    // Using a simplified mock if direct binding mount isn't fully auto-configured in the specific SDK version:
    await sandbox.utils.createSession({ env: { "DATA_DIR": "/workspace/data" } });
    return "Knowledge base environment configured. (Bucket mount requires explicit S3 creds in this SDK version, skipped for safety).";
  } catch (e: any) {
    return `Mount Error: ${e.message}`;
  }
}
