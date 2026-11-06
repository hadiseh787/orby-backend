import { spawn } from "node:child_process";
// Schannel/curl transport for large uploads on Windows hosts that reset Node TLS uploads.
// Signed transactions are passed on stdin; no key or request body enters the command line.
export function enableLargeUploadTransport() {
  if (process.platform !== "win32") return;
  const native = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    if (typeof init?.body !== "string" || init.body.length < 8192)
      return native(input, init);
    const text = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        "curl.exe",
        [
          "--silent",
          "--show-error",
          "--fail",
          "--http1.1",
          "--retry",
          "2",
          "--retry-all-errors",
          "--retry-delay",
          "1",
          "--max-time",
          "120",
          "-X",
          "POST",
          "-H",
          "Content-Type: application/json",
          "--data-binary",
          "@-",
          String(input),
        ],
        { windowsHide: true },
      );
      let out = "",
        error = "";
      child.stdout.on("data", (b) => (out += b));
      child.stderr.on("data", (b) => (error += b));
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0
          ? resolve(out)
          : reject(Error("RPC upload transport failed: " + error)),
      );
      child.stdin.end(init.body);
    });
    return new Response(text, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
