import { CheBrowser, CheDistribution, OpenShiftAuthenticator, OpenShiftAuthenticatorMethod, WorkspaceTestRunner } from "theia-extension-tester";

async function main() {
    if (process.env.CHE_USERNAME === undefined) {
        console.error('CHE_USERNAME variable is missing in .env file.');
        process.exit(1);
    }

    if (process.env.CHE_PASSWORD === undefined) {
        console.error('CHE_PASSWORD variable is missing in .env file.');
        process.exit(1);
    }

    const browser = new CheBrowser({
        // Test browser
        browserName: "chrome",
        distribution: CheDistribution.CODEREADY_WORKSPACES,
        // Eclipse Che URL
        location: "https://workspaces.openshift.com/",
        // Authenticator object logs in user into Eclipse Che
        authenticator: new OpenShiftAuthenticator({
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
        }),
        // Selenium implicit timeouts
        timeouts: {
            implicit: 30000,
            pageLoad: 150000
        },
    });

    const runner = new WorkspaceTestRunner(browser, {
        // Eclipse Che workspace name - does not need to be exact
        workspaceName: 'Quarkus',
        // Use running workspace instead - changes workspace name to 'apache-camel-k'
        useExistingWorkspace: true,
        // Mocha test options
        mochaOptions: {
            bail: true
        }
    });

    // Remove first element - program path
    const [, ...args] = process.argv;
    process.exit(await runner.runTests(args));
}

main();
