# Tasks - Jewel v0.3: Real LLM Adapter Foundation

- [x] Phase 1: Update configuration interface, defaults, and validation in `src/core/config.ts` and `src/cli/commands/doctor.ts`.
- [x] Phase 2: Define AgentAdapter types and validation rules in `src/agents/adapter.ts`.
- [x] Phase 3: Create strict prompt builder in `src/agents/prompt-builder.ts`.
- [x] Phase 4: Create JSON response extractor and validators in `src/agents/json-response.ts`.
- [x] Phase 5: Implement OpenAI Adapter using native fetch in `src/agents/providers/openai-adapter.ts`.
- [x] Phase 6: Create Provider Factory in `src/agents/provider-factory.ts`.
- [x] Phase 7: Update `src/cli/commands/run.ts` to instantiate and use the LLM adapter.
- [x] Phase 8: Create secret redactor utility in `src/safety/secret-redactor.ts` and integrate it into debug writes and error reporting.
- [x] Phase 9: Write comprehensive unit tests for all components and run build/test verification.
