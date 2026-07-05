import { runLspServerLoop } from '../../lsp/server-loop';

export function runLsp(cwd: string = process.cwd()): void {
  process.stderr.write('[jewel-lsp] Language server listening on stdio\n');
  runLspServerLoop(cwd);
}
