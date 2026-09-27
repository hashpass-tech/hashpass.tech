import { signalFromMergedPullRequest } from './domain.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const signal = signalFromMergedPullRequest(JSON.parse(input));
process.stdout.write(`${JSON.stringify({ accepted: Boolean(signal), signal }, null, 2)}\n`);
