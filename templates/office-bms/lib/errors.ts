// RPC failures from the host bridge reject with a plain {code, message,
// method} object (see fleet-management/frontend/src/tools/websocket.ts
// handleRpcResponse), not a native Error — `err instanceof Error` is always
// false for them, so a naive `String(err)` fallback prints "[object
// Object]" instead of the actual message.
export function extractErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) {
        const message = (err as {message?: unknown}).message;
        if (typeof message === 'string' && message) return message;
    }
    return String(err);
}
