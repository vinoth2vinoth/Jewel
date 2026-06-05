"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertNoForbiddenExecutionFields = assertNoForbiddenExecutionFields;
exports.extractJsonObject = extractJsonObject;
exports.validateTaskContractJson = validateTaskContractJson;
exports.validatePatchProposalJson = validatePatchProposalJson;
exports.validateReviewResultJson = validateReviewResultJson;
exports.validateTestCriticResultJson = validateTestCriticResultJson;
function assertNoForbiddenExecutionFields(input) {
    const forbidden = [
        'command', 'commands', 'shell', 'terminal', 'run', 'runs', 'exec',
        'execute', 'script', 'scripts', 'tool', 'tools', 'function_call', 'tool_calls'
    ];
    function check(obj) {
        if (!obj || typeof obj !== 'object')
            return;
        for (const key of Object.keys(obj)) {
            if (forbidden.includes(key.toLowerCase())) {
                throw new Error(`Forbidden execution field "${key}" detected.`);
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                check(obj[key]);
            }
        }
    }
    check(input);
}
function extractJsonObject(raw) {
    if (typeof raw !== 'string') {
        throw new Error('Raw input must be a string.');
    }
    let text = raw.trim();
    // Find markdown code blocks
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    const matches = [...text.matchAll(codeBlockRegex)];
    if (matches.length > 1) {
        throw new Error('Multiple JSON objects/code blocks detected. Expected exactly one JSON object.');
    }
    if (matches.length === 1) {
        text = matches[0][1].trim();
    }
    const firstBracket = text.indexOf('[');
    const firstBraceIndex = text.indexOf('{');
    if (firstBracket !== -1 && (firstBraceIndex === -1 || firstBracket < firstBraceIndex)) {
        throw new Error('JSON response cannot be an array.');
    }
    if (!text.startsWith('{') || !text.endsWith('}')) {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
            throw new Error('No JSON object found in the response.');
        }
        text = text.substring(firstBrace, lastBrace + 1);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (err) {
        throw new Error(`Malformed JSON: ${err.message}`);
    }
    if (parsed === null || typeof parsed !== 'object') {
        throw new Error('JSON response must be a single object.');
    }
    if (Array.isArray(parsed)) {
        throw new Error('JSON response cannot be an array.');
    }
    // Reject unknown execution fields
    assertNoForbiddenExecutionFields(parsed);
    return parsed;
}
function validateTaskContractJson(input) {
    assertNoForbiddenExecutionFields(input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Invalid TaskContract: must be an object.');
    }
    const obj = input;
    if (typeof obj.task !== 'string' || obj.task.trim() === '') {
        throw new Error('Invalid TaskContract: "task" is required and must be a non-empty string.');
    }
    if (typeof obj.understanding !== 'string') {
        throw new Error('Invalid TaskContract: "understanding" is required and must be a string.');
    }
    if (!Array.isArray(obj.assumptions) || obj.assumptions.some((x) => typeof x !== 'string')) {
        throw new Error('Invalid TaskContract: "assumptions" must be an array of strings.');
    }
    if (!Array.isArray(obj.filesLikelyNeeded) || obj.filesLikelyNeeded.some((x) => typeof x !== 'string')) {
        throw new Error('Invalid TaskContract: "filesLikelyNeeded" must be an array of strings.');
    }
    if (!Array.isArray(obj.forbiddenActions) || obj.forbiddenActions.some((x) => typeof x !== 'string')) {
        throw new Error('Invalid TaskContract: "forbiddenActions" must be an array of strings.');
    }
    if (!Array.isArray(obj.successCriteria) || obj.successCriteria.length === 0 || obj.successCriteria.some((x) => typeof x !== 'string')) {
        throw new Error('Invalid TaskContract: "successCriteria" must be a non-empty array of strings.');
    }
    if (obj.riskLevel !== 'low' && obj.riskLevel !== 'medium' && obj.riskLevel !== 'high') {
        throw new Error('Invalid TaskContract: "riskLevel" must be "low", "medium", or "high".');
    }
    if (typeof obj.requiresApproval !== 'boolean') {
        throw new Error('Invalid TaskContract: "requiresApproval" must be a boolean.');
    }
    if (typeof obj.createdAt !== 'string') {
        throw new Error('Invalid TaskContract: "createdAt" is required and must be a string.');
    }
    if (obj.mode !== 'strict' && obj.mode !== 'lax') {
        throw new Error('Invalid TaskContract: "mode" must be "strict" or "lax".');
    }
    if (obj.estimatedFilesChangedCount !== undefined && typeof obj.estimatedFilesChangedCount !== 'number') {
        throw new Error('Invalid TaskContract: "estimatedFilesChangedCount" must be a number.');
    }
    if (obj.estimatedLinesChangedCount !== undefined && typeof obj.estimatedLinesChangedCount !== 'number') {
        throw new Error('Invalid TaskContract: "estimatedLinesChangedCount" must be a number.');
    }
    if (obj.preserveExistingTests !== undefined && typeof obj.preserveExistingTests !== 'boolean') {
        throw new Error('Invalid TaskContract: "preserveExistingTests" must be a boolean.');
    }
    return obj;
}
function validatePatchProposalJson(input) {
    assertNoForbiddenExecutionFields(input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Invalid PatchProposal: must be an object.');
    }
    const obj = input;
    if (typeof obj.summary !== 'string' || obj.summary.trim() === '') {
        throw new Error('Invalid PatchProposal: "summary" is required and must be a non-empty string.');
    }
    if (!Array.isArray(obj.files)) {
        throw new Error('Invalid PatchProposal: "files" is required and must be an array.');
    }
    if (obj.files.length === 0) {
        if (obj.noChangeNeeded !== true) {
            throw new Error('Invalid PatchProposal: empty files array is blocked unless "noChangeNeeded" is true.');
        }
        if (typeof obj.noChangeReason !== 'string' || obj.noChangeReason.trim() === '') {
            throw new Error('Invalid PatchProposal: "noChangeReason" is required and must be a non-empty string when "noChangeNeeded" is true.');
        }
    }
    for (let i = 0; i < obj.files.length; i++) {
        const f = obj.files[i];
        if (!f || typeof f !== 'object' || Array.isArray(f)) {
            throw new Error(`Invalid PatchProposal: "files[${i}]" must be an object.`);
        }
        if (typeof f.filePath !== 'string' || f.filePath.trim() === '') {
            throw new Error(`Invalid PatchProposal: "files[${i}].filePath" is required and must be a non-empty string.`);
        }
        if (typeof f.content !== 'string') {
            throw new Error(`Invalid PatchProposal: "files[${i}].content" is required and must be a string.`);
        }
        if (typeof f.reason !== 'string' || f.reason.trim() === '') {
            throw new Error(`Invalid PatchProposal: "files[${i}].reason" is required and must be a non-empty string.`);
        }
    }
    if (!Array.isArray(obj.notes) || obj.notes.some((x) => typeof x !== 'string')) {
        throw new Error('Invalid PatchProposal: "notes" must be an array of strings.');
    }
    if (obj.riskLevel !== 'low' && obj.riskLevel !== 'medium' && obj.riskLevel !== 'high') {
        throw new Error('Invalid PatchProposal: "riskLevel" must be "low", "medium", or "high".');
    }
    if (obj.noChangeNeeded !== undefined && typeof obj.noChangeNeeded !== 'boolean') {
        throw new Error('Invalid PatchProposal: "noChangeNeeded" must be a boolean.');
    }
    if (obj.noChangeReason !== undefined && typeof obj.noChangeReason !== 'string') {
        throw new Error('Invalid PatchProposal: "noChangeReason" must be a string.');
    }
    return obj;
}
function validateReviewResultJson(input) {
    assertNoForbiddenExecutionFields(input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Invalid ReviewResult: must be an object.');
    }
    const obj = input;
    if (obj.status !== 'PASS' && obj.status !== 'WARN' && obj.status !== 'BLOCK') {
        throw new Error('Invalid ReviewResult: "status" must be "PASS", "WARN", or "BLOCK".');
    }
    if (!Array.isArray(obj.findings) || obj.findings.some((x) => typeof x !== 'string')) {
        throw new Error('Invalid ReviewResult: "findings" must be an array of strings.');
    }
    return obj;
}
function validateTestCriticResultJson(input) {
    assertNoForbiddenExecutionFields(input);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Invalid TestCriticResult: must be an object.');
    }
    const obj = input;
    const validVerdicts = ['BAD_GENERATED_TEST', 'BAD_IMPLEMENTATION', 'FLAKY_TEST_SUSPECT', 'ENVIRONMENT_FAILURE', 'INSUFFICIENT_CONTEXT', 'UNKNOWN'];
    if (!validVerdicts.includes(obj.verdict)) {
        throw new Error(`Invalid TestCriticResult: "verdict" must be one of: ${validVerdicts.join(', ')}`);
    }
    if (obj.confidence !== 'high' && obj.confidence !== 'medium' && obj.confidence !== 'low') {
        throw new Error('Invalid TestCriticResult: "confidence" must be "high", "medium", or "low".');
    }
    if (typeof obj.explanation !== 'string' || obj.explanation.trim() === '') {
        throw new Error('Invalid TestCriticResult: "explanation" is required and must be a non-empty string.');
    }
    if (typeof obj.suspectedRootCause !== 'string' || obj.suspectedRootCause.trim() === '') {
        throw new Error('Invalid TestCriticResult: "suspectedRootCause" is required and must be a non-empty string.');
    }
    if (typeof obj.suggestedFix !== 'string' || obj.suggestedFix.trim() === '') {
        throw new Error('Invalid TestCriticResult: "suggestedFix" is required and must be a non-empty string.');
    }
    if (typeof obj.canAutoRetry !== 'boolean') {
        throw new Error('Invalid TestCriticResult: "canAutoRetry" is required and must be a boolean.');
    }
    if (typeof obj.requiresHumanReview !== 'boolean') {
        throw new Error('Invalid TestCriticResult: "requiresHumanReview" is required and must be a boolean.');
    }
    return obj;
}
