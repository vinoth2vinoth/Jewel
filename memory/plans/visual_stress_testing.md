# Design Plan: Web UI Visual & Stress Testing

We will implement an automated end-to-end (E2E) visual and stress testing suite for the Jewel Web UI Dashboard. The suite will run programmatically using core Node.js modules, verifying dashboard behaviors under stress conditions and enabling live visual testing.

---

## 1. Affected Files

1. **`scripts/visual-stress-test.js`** *(New File)*:
   - A standalone executable JavaScript tool that loads the `UIServer` library.
   - Includes two mutually exclusive modes:
     - **Visual mode** (`--visual`): Runs a slideshow-like simulation. It starts the server, opens the local browser pointing to the authenticated URL, and sequentially updates the stage (`init` -> `planning` -> `review` -> `verification` -> `critic` -> `finalizing` -> `completed` / `failed`) with artificial delays so the user can visually verify transitions and modal overlays.
     - **Stress mode** (`--stress`): Simulates high-load and stress conditions. It opens 50 concurrent SSE event stream clients, sends 50 sequential and concurrent POST requests to `/api/action` (both valid and malformed), hammers `/api/state` to check latency, verifies payload size limits, and closes connections abruptly to test backpressure and socket safety.
   - Generates a neat terminal audit report on completion.

---

## 2. Expected Changes

### Implementation details of `scripts/visual-stress-test.js`

- **Pre-build Compilation Check**:
  - The script checks if `dist/` and `dist/cli/ui-server.js` exist.
  - If missing, it prints a clear error message: `"Error: Compiled CLI files not found. Please run 'npm run build' first."` and exits with code `1`.

- **Imports & Path Resolution**:
  - Imports `http`, `fs`, `path`, and `crypto` (all native Node modules).
  - Imports `UIServer` using absolute resolution via relative calculations:
    ```javascript
    const { UIServer } = require(path.join(__dirname, '../dist/cli/ui-server.js'));
    ```

- **CLI Argument Validation**:
  - Validates argv options:
    - If neither `--visual` nor `--stress` is provided, or if both are provided, it prints a usage guide:
      ```
      Usage: node scripts/visual-stress-test.js [options]
      Options:
        --visual   Run visual slideshow demo in local browser.
        --stress   Run high-load concurrency and resilience tests.
      ```
      and exits with code `1`.

- **Visual Demo Loop**:
  - Starts server on port `3000` (allowing port hunting to fallback if in use).
  - Triggers default browser launch using `autoOpenBrowser = true`.
  - Sequentially calls `uiServer.updateState(...)` with 3-second delays to transition through the complete state cycle:
    1. `init`
    2. `planning`
    3. `review` (updating state with a mock code diff and `awaitingApproval: true`)
    4. `verification`
    5. `critic`
    6. `finalizing`
    7. `completed` (displaying success screen)
  - Keeps the server alive after completion, printing: `"Visual demo completed. Press [ENTER] or Ctrl+C to terminate the server."`
  - Listens to terminal input to allow clean manual exits.

- **Stress Testing Engine**:
  - **Error-Resilient HTTP Client**:
    - Wraps all fetch/HTTP request calls in robust try-catch blocks.
    - Adds `.on('error', ...)` handlers to every socket connection, SSE stream, and request instance to prevent uncaught exceptions (like `ECONNRESET` or `EPIPE`) from crashing the test runner.
  - **SSE Concurrency Test**:
    - Spawns 50 concurrent HTTP requests to `/api/events?token=<token>`.
    - Verifies that all 50 clients establish a connection and receive the initial state payload.
    - Abruptly aborts/closes 25 clients midway to verify the server handles client disconnection backpressure without resource leaks or crashes.
  - **Payload Size Limits & Socket Handling**:
    - Sends POST requests to `/api/action` with JSON payloads exceeding 10KB.
    - Because the server destroys the socket immediately (without returning response headers), the client must catch the connection reset / socket hang-up error and classify it as a successful blocking event (along with any HTTP 413 responses).
  - **Malformed & Unauthorized Requests**:
    - Sends malformed JSON payloads, asserting the server returns `400 Bad Request` cleanly.
    - Sends requests missing authorization headers or using incorrect tokens, asserting `401 Unauthorized`.
  - **Awaiting-Approval Concurrency**:
    - Puts the server into the `awaitingApproval` state.
    - Spawns 10 concurrent POST requests to approve/reject the action.
    - Asserts that exactly one request succeeds with `200 OK`, while all other 9 concurrent requests fail with `409 Conflict` ("No active approval request.").
  - **Clean Shutdown**:
    - Closes all active clients and closes the server cleanly.

- **Clean Signal Handling**:
  - Registers listeners for `SIGINT` (Ctrl+C) and `SIGTERM`.
  - On signal, calls `await uiServer.close()` to release the port, then exits.

- **Terminal Audit Report**:
  - Prints a summary table at the end of `--stress` runs containing:
    - **Total SSE Clients Connected**: (Goal: 50)
    - **SSE Disconnection Resiliency**: (Successful clean disconnects: 25)
    - **Payload Limit Blocks**: (Connection resets caught: 100% success)
    - **Malformed/Auth Rejections**: (Successful HTTP 400/401 checks)
    - **Approval Race Checks**: (Exactly one HTTP 200, others HTTP 409: verified)
    - **Response Latency**: Average and max response times for `/api/state` requests.

---

## 3. Testing and Verification Strategy

1. **Manual Visual Walkthrough**:
   - Run `node scripts/visual-stress-test.js --visual`.
   - Verify that the default browser opens the correct URL, displays the dashboard, and goes through the stages with proper animation.
2. **Stress & Stability Verification**:
   - Run `node scripts/visual-stress-test.js --stress`.
   - Ensure that the server remains up, no unhandled exceptions/rejections are printed, all test requests succeed/fail with expected HTTP statuses, and the summary displays 100% success.
3. **TypeScript Integration**:
   - Run `npm run build` and `npm test` to ensure no workspace regressions.
