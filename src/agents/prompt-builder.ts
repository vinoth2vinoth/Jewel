import { PlanInput, PatchInput, ReviewInput } from './adapter';
import { VerificationReport } from '../verification/runner';

export function formatVerificationResult(report: VerificationReport | null, fallback = 'No test runs performed yet.'): string {
  if (!report) return fallback;
  
  let formatted = `Test run status: ${report.overallStatus}\nResults:\n`;
  for (const r of report.results) {
    formatted += `- ${r.commandKey} (${r.status}): ${r.errorMsg || ''}\n`;
    if (r.status === 'FAIL') {
      const formatLogSection = (header: string, content: string) => {
        if (!content || content.trim() === '') return '';
        const limit = 4000;
        let trimmed = content.trim();
        if (trimmed.length > limit) {
          trimmed = `[... truncated output ...]\n` + trimmed.slice(-limit);
        }
        return `  ${header}:\n  ` + trimmed.split('\n').join('\n  ') + '\n';
      };
      
      formatted += formatLogSection('STDOUT', r.stdout);
      formatted += formatLogSection('STDERR', r.stderr);
    }
  }
  return formatted.trim();
}

export function buildPlanningPrompt(input: PlanInput): string {
  const skillsStr = input.skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
  const allowedModes = 'strict | lax';
  return `You are an AI coding agent operating inside Jewel, a safety and security harness CLI.
Your goal is to analyze the user's task and generate a structured JSON planning contract.

CRITICAL SAFETY RULES:
- You must return strict JSON only. Do not include conversational text outside the JSON.
- You are not allowed to run any shell commands, terminals, or process execution directly.
- You cannot modify any files directly in the filesystem.
- All file paths you propose must be clean repo-relative paths (e.g. "src/index.ts", "math.js").
- You must NEVER use absolute paths (e.g., "/tmp/file", "C:\\file") or parent traversal paths containing ".." (e.g., "../file").
- Make surgical, minimal changes. Do not touch files outside of the planned files.
- Avoid proposing new dependencies unless absolutely necessary.
- You must estimate the scope of changes:
  - estimatedFilesChangedCount: The number of files you plan to modify or create (e.g. 1, 2, 3, etc.)
  - estimatedLinesChangedCount: The total number of lines (additions + deletions) you plan to modify or create (e.g. 50, 150, 200, etc.)

Available Skills in the harness:
${skillsStr || 'None'}

Repository Context summary:
${input.repoSummary}

Configuration:
- Mode: ${input.config.mode}
- Max files changed limit: ${input.config.maxFilesChanged}

User Task:
${input.task}

You must respond with a single valid JSON object adhering to the TaskContract schema:
{
  "task": "A concise description of the task",
  "understanding": "Detailed analysis of the requirements and codebase changes needed",
  "assumptions": ["List of key assumptions about the repository state"],
  "filesLikelyNeeded": ["Array of repo-relative paths of files that need to be edited or created"],
  "forbiddenActions": ["Actions that must not be taken, e.g., modifying auth, updating dependencies"],
  "successCriteria": ["Explicit requirements for a successful task completion"],
  "riskLevel": "low | medium | high",
  "requiresApproval": true_or_false,
  "createdAt": "Current ISO timestamp",
  "mode": "${input.config.mode}",
  "estimatedFilesChangedCount": 3,
  "estimatedLinesChangedCount": 150,
  "preserveExistingTests": true_or_false
}
`;
}

export function buildPatchProposalPrompt(input: PatchInput): string {
  const contract = input.taskContract;
  const filesList = input.allowedFiles.map(f => `- ${f}`).join('\n');
  const verificationStr = input.verificationResult
    ? `Test runner output from previous attempt:\n` + formatVerificationResult(input.verificationResult, 'No previous test runs.')
    : 'No previous test runs.';

  const failedDiffStr = input.failedDiff
    ? `\nProposed Diff that failed verification:\n\`\`\`diff\n${input.failedDiff}\n\`\`\`\n`
    : '';

  const criticFeedbackStr = input.testCriticResult
    ? `\nCritic Feedback on previous failure:\nVerdict: ${input.testCriticResult.verdict}\nExplanation: ${input.testCriticResult.explanation}\nSuggested Fix: ${input.testCriticResult.suggestedFix}\n`
    : '';

  const generalCriticFeedbackStr = input.criticResult && input.criticResult.findings.length > 0
    ? `\nLLM Critics Feedback on previous attempt:\nStatus: ${input.criticResult.status}\nFindings:\n${input.criticResult.findings.map(f => `- ${f}`).join('\n')}\n`
    : '';

  const customHintStr = input.customHint
    ? `\nUser Custom Guidance Hint:\n${input.customHint}\n`
    : '';

  const protectReminder = contract.preserveExistingTests
    ? `\nCRITICAL WARNING: The user requested to keep existing tests exactly as they are. You must NOT modify, rename, delete or refactor any existing test cases or assertions. You may only append new tests if necessary, and only add imports if required for the new tests. Violating this will block execution with an EXISTING_TEST_MODIFIED failure.\n`
    : '';

  const maxFiles = input.config?.maxFilesChanged ?? 3;
  const maxLines = input.config?.maxLinesChanged ?? 150;

  return `You are an AI coding agent operating inside Jewel, a safety and security harness CLI.
Your task is to generate a patch proposal to solve the user's coding goal.

CRITICAL SAFETY RULES:
- You must return strict JSON only. Do not include conversational text outside the JSON.
- You are not allowed to run any shell commands, terminals, or process execution directly.
- You cannot modify any files directly in the filesystem.
- All file paths you propose must be clean repo-relative paths (e.g. "src/index.ts", "math.js").
- You must NEVER use absolute paths (e.g., "/tmp/file", "C:\\file") or parent traversal paths containing ".." (e.g., "../file").
- Make surgical, minimal changes. Only modify or create files that are listed in the task contract filesLikelyNeeded.
- Avoid introducing new dependencies.
- You must write a clear reason for each file modified or created.
- Scope limits: You must modify or create no more than ${maxFiles} files, and the total lines changed (additions + deletions) must not exceed ${maxLines} lines.
- Prefer targeted "edits" (search/replace hunks) over full-file rewrites when changing small sections of existing files.
${protectReminder}
Task Contract:
- Task: ${contract.task}
- Understanding: ${contract.understanding}
- Allowed files to change:
${filesList}
- Success criteria:
${contract.successCriteria.map(c => `- ${c}`).join('\n')}

Previous Verification:
${verificationStr}
${failedDiffStr}${criticFeedbackStr}
${generalCriticFeedbackStr}
${customHintStr}

Repository Context:
${input.repoContext}

You must respond with a single valid JSON object adhering to the PatchProposal schema:
{
  "summary": "High-level explanation of the changes made",
  "files": [
    {
      "filePath": "repo-relative/path/to/file",
      "content": "Full new content of the file (optional if using edits)",
      "edits": [
        { "search": "exact string to find", "replace": "replacement string" }
      ],
      "reason": "Detailed justification of why this change is necessary"
    }
  ],
  "notes": ["Important considerations, design choices, or warnings"],
  "riskLevel": "${contract.riskLevel}"
}
`;
}

export function buildDiffReviewPrompt(input: ReviewInput): string {
  const contract = input.taskContract;
  const verificationStr = input.verificationResult 
    ? `Test run status: ${input.verificationResult.overallStatus}\nResults:\n${input.verificationResult.results.map(r => `- ${r.commandKey} (${r.status}): ${r.errorMsg || ''}`).join('\n')}`
    : 'No test runs performed yet.';

  const criticType = input.criticType || 'security';
  let criticRoleStr = 'AI security critic and safety review gate';
  let focusInstructions = 'Review the proposed diff and verification outcomes below to ensure they are safe, surgical, correct, and do not violate security constraints.';

  if (criticType === 'linter') {
    criticRoleStr = 'code quality and linting auditor';
    focusInstructions = 'Review the proposed diff for syntax errors, typing discrepancies, code formatting issues, and dead code.';
  } else if (criticType === 'architect') {
    criticRoleStr = 'software architect';
    focusInstructions = 'Review the proposed diff for pattern compliance, file organization, coupling, scalability, and code readability.';
  }

  return `You are an ${criticRoleStr} operating inside Jewel.
${focusInstructions}

CRITICAL SAFETY RULES:
- You must return strict JSON only. Do not include conversational text outside the JSON.
- You must NEVER allow commands to execute.
- Check that the changes do not escape the repository boundary or access unauthorized paths.
- Check that no forbidden actions were performed.

Task Contract constraints:
- Task: ${contract.task}
- Forbidden Actions:
${contract.forbiddenActions.map(a => `- ${a}`).join('\n')}

Verification Output:
${verificationStr}

Proposed Diff:
\`\`\`diff
${input.diff}
\`\`\`

You must respond with a single valid JSON object adhering to the ReviewResult schema:
{
  "status": "PASS | WARN | BLOCK",
  "findings": ["List of safety, security, and verification findings"]
}
`;
}

export function buildTestCriticPrompt(input: ReviewInput): string {
  const contract = input.taskContract;
  const verificationStr = formatVerificationResult(input.verificationResult, 'No test runs performed yet.');

  return `You are a test correctness critic operating inside Jewel.
Your task is to analyze the test failures resulting from the proposed changes and determine if they are due to:
1. BAD_GENERATED_TEST: The generated test case contains incorrect expectations, invalid logic, or wrong domain rules (for example, expecting a valid matrix multiplication to throw a dimension mismatch error).
2. BAD_IMPLEMENTATION: The implementation code contains bugs or doesn't satisfy correct tests.
3. UNKNOWN: The failure root cause is unclear, or you are unsure.

Other valid verdicts (use only if appropriate):
- FLAKY_TEST_SUSPECT: The test fails intermittently.
- ENVIRONMENT_FAILURE: Infrastructure, network, or file system errors.
- INSUFFICIENT_CONTEXT: Not enough info to diagnose.

CRITICAL DOMAIN RULES CHECK:
- Verify mathematical, data structure, or algorithm constraints carefully.
- For Matrix Multiplication: Matrix A (m x n) multiplied by Matrix B (p x q) is valid if and only if n === p. The resulting matrix will have size m x q. Any test asserting that a valid multiplication (like 2x2 * 2x3) should fail is logically incorrect!
- Examine all assertions and verify if their assumptions match standard domain specifications and task requirements.

Task Contract:
- Task: ${contract.task}
- Success criteria:
${contract.successCriteria.map(c => `- ${c}`).join('\n')}

Proposed Diff:
\`\`\`diff
${input.diff}
\`\`\`

Verification Failure details:
${verificationStr}

You must respond with a single valid JSON object adhering to the TestCriticResult schema:
{
  "verdict": "BAD_GENERATED_TEST | BAD_IMPLEMENTATION | FLAKY_TEST_SUSPECT | ENVIRONMENT_FAILURE | INSUFFICIENT_CONTEXT | UNKNOWN",
  "confidence": "high | medium | low",
  "explanation": "Detailed explanation of your analysis, outlining if the test logic or the implementation is at fault, and why.",
  "suspectedRootCause": "The suspected root cause of the verification failure.",
  "suggestedFix": "Detailed description of what needs to be changed in the code/test to resolve the error",
  "canAutoRetry": true_or_false,
  "requiresHumanReview": true_or_false
}

Instructions:
- Only set "canAutoRetry" to true if confidence is high and the verdict allows auto-fixing.
- If confidence is low or medium, or if verdict is UNKNOWN, you must set "requiresHumanReview" to true and "canAutoRetry" to false.
- Do not claim to be always correct; default to UNKNOWN if unsure.
`;
}
