import { createBrowser, BrowserDistribution, TheiaBrowserRunner, createWebDriverManager } from "theia-extension-tester";
import * as fs from "fs-extra";
import * as path from "path";

async function main() {
  const driver = createWebDriverManager('chrome', path.join('test-resources', 'drivers'), '88.0.4324.96');
  await driver.downloadDriver();

  const browser = createBrowser('chrome', {
    distribution: BrowserDistribution.THEIA_BROWSER,
    driverLocation: await driver.getBinaryPath(),
    timeouts: {
      implicit: 30000,
      pageLoad: 250000
    }
  });

  const openFolder = path.join(process.cwd(), 'out', 'vscode-test-workspace');
  fs.removeSync(openFolder);
  fs.mkdirpSync(openFolder);

  const runner = new TheiaBrowserRunner(browser, {
    theiaUrl: 'http://localhost:3000/',
    openFolder,
    mochaOptions: {
      bail: true
    }
  });

  // Remove first element - program path
  const [, ...args] = process.argv;
  process.exit(await runner.runTests(args));
}

main();
