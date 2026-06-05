# Checklist: Web UI Visual & Stress Testing

- [x] Create `scripts/visual-stress-test.js` framework and add argument validation
- [x] Implement pre-build compilation check for `dist/` and `dist/cli/ui-server.js`
- [x] Implement SIGINT and SIGTERM termination signal handlers for clean port release
- [x] Implement `--visual` slideshow mode to loop through all stages
- [x] Implement `--stress` mode to connect 50 concurrent SSE clients with abort and backpressure handling
- [x] Implement E2E REST API checks in stress mode (Payload Too Large caught, malformed payload HTTP 400, unauthorized HTTP 401, approval concurrency race checking HTTP 200/409)
- [x] Implement metrics collector and terminal audit report summary
- [ ] Verify using `--visual` slideshow mode manually
- [x] Verify using `--stress` load testing mode
- [x] Run full workspace test suite using `npm run build && npm test` to ensure no regressions
