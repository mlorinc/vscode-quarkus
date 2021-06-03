import { createBrowser, BrowserDistribution, OpenShiftAuthenticator, OpenShiftAuthenticatorMethod, CheTheiaFactoryRunner, createWebDriverManager } from "theia-extension-tester";
import * as path from "path";

async function main() {
    if (process.env.CHE_USERNAME === undefined) {
        console.error('CHE_USERNAME variable is missing in .env file.');
        process.exit(1);
    }

    if (process.env.CHE_PASSWORD === undefined) {
        console.error('CHE_PASSWORD variable is missing in .env file.');
        process.exit(1);
    }

    const driver = createWebDriverManager('chrome', path.join('test-resources', 'drivers'), '88.0.4324.96');
    await driver.downloadDriver();

    const browser = createBrowser('chrome', {
      distribution: BrowserDistribution.CODEREADY_WORKSPACES,
      driverLocation: await driver.getBinaryPath(),
      timeouts: {
        implicit: 40000,
        pageLoad: 250000
      }
    });

    const authenticator = new OpenShiftAuthenticator({
        inputData: [
          {
              name: 'username',
              value: process.env.CHE_USERNAME
          },
          {
              name: 'password',
              value: process.env.CHE_PASSWORD
          }
      ],
      multiStepForm: true,
      loginMethod: OpenShiftAuthenticatorMethod.DEVSANDBOX
    });

    ////https://workspaces.openshift.com/f?url=https://codeready-codeready-workspaces-operator.apps.sandbox.x8i5.p1.openshiftapps.com/devfile-registry/devfiles/03_java11-maven-quarkus/devfile.yaml&override.attributes.persistVolumes=false
    const runner = new CheTheiaFactoryRunner(browser, {
      cheUrl: 'https://workspaces.openshift.com/',
      factoryUrl: 'https://codeready-codeready-workspaces-operator.apps.sandbox.x8i5.p1.openshiftapps.com/devfile-registry/devfiles/03_java11-maven-quarkus/devfile.yaml',
      mochaOptions: {
        bail: true
      }
    }, authenticator);

    // Remove first element - program path
    const [, ...args] = process.argv;
    process.exit(await runner.runTests(args));
}

main();
