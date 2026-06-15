import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LlmConfig } from "@/stores/wiki-store"
import { isFetchNetworkError, streamChat } from "./llm-client"

/**
 * Guards for cross-webview error detection. Tauri renders the frontend
 * with WebKit on macOS/Linux and Edge WebView2 (Chromium) on Windows,
 * and each backend phrases fetch failures differently. These tests pin
 * down that every real-world error shape gets classified as a network
 * error so the user sees a helpful message instead of a raw stack.
 */
describe("isFetchNetworkError — cross-webview fetch failures", () => {
  it("recognises WebKit's 'Load failed' (macOS / Linux GTK)", () => {
    const e = new Error("Load failed")
    expect(isFetchNetworkError(e)).toBe(true)
  })

  it("recognises Chromium/Edge's TypeError: Failed to fetch (Windows)", () => {
    // Real Chromium throws a TypeError with this exact shape.
    const e = new TypeError("Failed to fetch")
    expect(isFetchNetworkError(e)).toBe(true)
  })

  it("recognises any TypeError (Chromium fetch failure class)", () => {
    // Chromium also throws TypeError with messages like "NetworkError
    // when attempting to fetch resource." — the name alone is enough.
    const e = new TypeError("NetworkError when attempting to fetch resource.")
    expect(isFetchNetworkError(e)).toBe(true)
  })

  it("recognises messages containing 'network error' (mid-stream drops)", () => {
    const e = new Error("The network error occurred while reading")
    expect(isFetchNetworkError(e)).toBe(true)
  })

  it("rejects AbortError (user cancelled)", () => {
    const e = new Error("The operation was aborted.")
    e.name = "AbortError"
    expect(isFetchNetworkError(e)).toBe(false)
  })

  it("rejects plain application errors (HTTP 4xx surfaced as Error)", () => {
    const e = new Error("HTTP 401: Unauthorized")
    expect(isFetchNetworkError(e)).toBe(false)
  })

  it("rejects non-Error values (strings, null, objects)", () => {
    expect(isFetchNetworkError("boom")).toBe(false)
    expect(isFetchNetworkError(null)).toBe(false)
    expect(isFetchNetworkError(undefined)).toBe(false)
    expect(isFetchNetworkError({ message: "Load failed" })).toBe(false)
  })
})

const fetchMock = vi.fn()

const llmConfig: LlmConfig = {
  provider: "custom",
  apiKey: "test-key",
  model: "test-model",
  ollamaUrl: "http://localhost:11434",
  customEndpoint: "http://localhost:1234/v1",
  maxContextSize: 4096,
  apiMode: "chat_completions",
}

const messages = [{ role: "user" as const, content: "Say hello." }]

function makeCallbacks() {
  return {
    onToken: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  }
}

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line))
      controller.close()
    },
  })
  return new Response(body, { status: 200, statusText: "OK" })
}

describe("streamChat — backstop timeout cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it("clears the 30-minute backstop after a successful SSE stream", async () => {
    const callbacks = makeCallbacks()
    fetchMock.mockResolvedValueOnce(sseResponse([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n',
      "data: [DONE]\n",
    ]))

    await streamChat(llmConfig, messages, callbacks)

    expect(callbacks.onToken).toHaveBeenCalledWith("hello")
    expect(callbacks.onDone).toHaveBeenCalledTimes(1)
    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("clears the backstop after an HTTP error", async () => {
    const callbacks = makeCallbacks()
    fetchMock.mockResolvedValueOnce(new Response("bad key", {
      status: 401,
      statusText: "Unauthorized",
    }))

    await streamChat(llmConfig, messages, callbacks)

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    expect(callbacks.onError.mock.calls[0]?.[0].message).toContain("HTTP 401: Unauthorized")
    expect(callbacks.onDone).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("clears the backstop after an empty response body", async () => {
    const callbacks = makeCallbacks()
    fetchMock.mockResolvedValueOnce(new Response(null, {
      status: 200,
      statusText: "OK",
    }))

    await streamChat(llmConfig, messages, callbacks)

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    expect(callbacks.onError.mock.calls[0]?.[0].message).toBe("Response body is null")
    expect(callbacks.onDone).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("clears the backstop after a stream reader failure", async () => {
    const callbacks = makeCallbacks()
    const releaseLock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader() {
          return {
            async read() {
              throw new TypeError("Failed to fetch")
            },
            releaseLock,
          }
        },
      },
    } as unknown as Response)

    await streamChat(llmConfig, messages, callbacks)

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    expect(callbacks.onError.mock.calls[0]?.[0].message).toBe("Connection lost during streaming. Try again.")
    expect(releaseLock).toHaveBeenCalledTimes(1)
    expect(callbacks.onDone).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("still reports the 30-minute request timeout and clears the fired timer", async () => {
    const callbacks = makeCallbacks()
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => (
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted.")
          error.name = "AbortError"
          reject(error)
        }, { once: true })
      })
    ))

    const pending = streamChat(llmConfig, messages, callbacks)
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    await pending

    expect(callbacks.onError).toHaveBeenCalledTimes(1)
    expect(callbacks.onError.mock.calls[0]?.[0].message).toContain("Request timed out after 30 min")
    expect(callbacks.onDone).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
