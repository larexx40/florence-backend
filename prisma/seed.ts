import { runSeedCli } from '../src/seed/seed.runner';

runSeedCli().catch((error) => {
  console.error(error);
  process.exit(1);
});
