import { ExTester, logging } from "vscode-extension-tester";
import * as path from "path";
import * as fs from "fs-extra";

async function main() {
    const extensionDir = path.join(process.cwd(), 'out', 'test', 'vscodeUiTest', 'extensions');
    const tests = 'out/test/vscodeUiTest/suite/*.js';
    const settings = path.join(process.cwd(), 'src', 'test', 'vscodeUiTest', 'vscode-settings.json');
    const openFolder = path.join(process.cwd(), 'out', 'vscode-test-workspace');

    fs.removeSync(openFolder);
    fs.mkdirpSync(openFolder);

    const tester = new ExTester(undefined, undefined, extensionDir);
    await tester.downloadCode('1.55.2');
    await tester.downloadChromeDriver('1.55.2');
    await tester.installVsix();
    await tester.runTests(tests, {
        cleanup: false,
        logLevel: logging.Level.ALL,
        settings,
        findElementTimeout: 7000,
        openFolder
    });
}

main();
