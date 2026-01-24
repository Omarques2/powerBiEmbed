const { execSync } = require("child_process");

const env = { ...process.env };
if (env.TEST_DATABASE_URL && !env.DATABASE_URL) {
  env.DATABASE_URL = env.TEST_DATABASE_URL;
}

execSync("npx prisma generate", { stdio: "inherit", env });
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("jest --config ./test/jest-e2e.json", { stdio: "inherit", env });
