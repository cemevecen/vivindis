/**
 * Vercel "Ignored Build Step" helper (see frontend/vercel.json → ignoreCommand).
 * Exit 0 → skip this deployment. Exit 1 → proceed with build.
 * @see https://vercel.com/docs/project-configuration#ignorecommand
 */
const message = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "";
if (/\[(skip ci|ci skip|skip vercel|vercel skip|skip actions)\]/i.test(message)) {
  process.exit(0);
}
process.exit(1);
