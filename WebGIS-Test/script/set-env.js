const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envFile = process.argv[2] || process.env.ENV_FILE || ".env.local";

dotenv.config({
  path: path.resolve(__dirname, "..", envFile)
});

const apiBaseUrl = process.env.NG_APP_API_BASE_URL || "/api";
const defaultProxyTarget = /^https?:\/\//.test(apiBaseUrl)
  ? apiBaseUrl.replace(/\/api\/?$/, "")
  : undefined;
const proxyTarget = process.env.NG_APP_PROXY_TARGET || defaultProxyTarget;

if (!proxyTarget) {
  throw new Error(
    "NG_APP_PROXY_TARGET is required when NG_APP_API_BASE_URL is relative."
  );
}

const environmentContent = `
export const environment = {
  production: false,
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)}
};
`;

const targetPath = path.resolve(
  __dirname,
  "../src/environments/environment.ts"
);

fs.mkdirSync(path.dirname(targetPath), {
  recursive: true
});

fs.writeFileSync(targetPath, environmentContent);

const proxyConfig = {
  "/api": {
    target: proxyTarget,
    secure: false,
    changeOrigin: true,
    logLevel: "debug"
  }
};

const proxyPath = path.resolve(__dirname, "../proxy.conf.json");
fs.writeFileSync(proxyPath, `${JSON.stringify(proxyConfig, null, 2)}\n`);

console.log("Generated Angular environment:");
console.log(environmentContent);
console.log(`Generated proxy config at ${proxyPath}`);
