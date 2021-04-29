/**
 * Copyright 2019 Red Hat, Inc. and others.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import * as _ from 'lodash';
import * as g2js from 'gradle-to-js/lib/parser';
import * as path from 'path';
import * as pomParser from 'pom-parser';
import {
  FileType,
  IDefaultTreeSection,
  INotification,
  INotificationsCenter,
  InputBox,
  Key,
  NotificationType,
  repeat,
  SeleniumBrowser,
  WebDriver,
  Workbench
} from 'theia-extension-tester';
import { expect, use } from 'chai';
import { ProjectGenerationWizard, QuickPickItemInfo } from '../ProjectGenerationWizard';

use(require('chai-fs'));

/**
 * This file contains tests for the project generation wizard
 * from the 'Quarkus: Generate a new Quarkus project' command
 */
describe('Project generation tests', function () {
  this.bail(true);
  this.timeout(60000);

  let driver: WebDriver;
  let tempDir: string;
  let workbench: Workbench;
  let tree: IDefaultTreeSection;

  process.env['VSCODE_QUARKUS_API_URL'] = 'https://stage.code.quarkus.io/api';

  before(async () => {
    driver = SeleniumBrowser.instance.driver;
    workbench = new Workbench();
    tempDir = path.join(await workbench.getOpenFolderPath(), 'temp')
  });

  beforeEach(async () => {
    tree = await getFileTree();

    if (await tree.existsFolder(tempDir, 0)) {
      await tree.deleteFolder(tempDir);
    }
    await tree.createFolder(tempDir);
  });

  after(async () => {
    await tree?.deleteFolder(tempDir);
  });

  afterEach(async () => {
    const input = new InputBox();

    if (await input.isDisplayed()) {
      await input.cancel();
    }
  });

  /**
   * Tests if the project generation wizard opens after
   * calling the 'Quarkus: Generate a Quarkus project command'
   * in the command palette
   */
  it('should open project generation wizard', async function () {
    const wizard: ProjectGenerationWizard = await ProjectGenerationWizard.openWizard(driver);
    expect(await wizardExists(), 'wizard did not open').to.be.true;
    await wizard.cancel();
  });

  /**
   * Tests if the project generation wizard contains correct
   * default values for the groupId, artifactId etc.
   */
  it.skip('should have correct default values when going through the wizard', async function () {
    const wizard: ProjectGenerationWizard = await ProjectGenerationWizard.openWizard(driver);

    expect(await wizard.getNthQuickPickItemLabel(0), 'default should be Maven').equals('Maven');
    await wizard.next();

    const groupId = await wizard.getText();
    expect(groupId).equals('org.acme');
    await wizard.next();

    const artifactId = await wizard.getText();
    expect(artifactId).equals('quarkus-getting-started');
    await wizard.next();

    const projectVersion = await wizard.getText();
    expect(projectVersion).equals('1.0.0-SNAPSHOT');
    await wizard.next();

    const packageName = await wizard.getText();
    expect(packageName).equals('org.acme');
    await wizard.next();

    const resourceName = await wizard.getText();
    expect(resourceName).equals('GreetingResource');
    await wizard.next();

    await wizard.sendKeys(Key.DOWN, Key.UP);

    expect(await wizard.getNthQuickPickItemLabel(0)).to.have.string('1 extension selected');
    await wizard.sendKeys(Key.DOWN, Key.DOWN);
    await wizard.confirm();
    expect(await wizard.getNthQuickPickItemLabel(0)).to.have.string('2 extensions selected');
    await wizard.sendKeys(Key.DOWN, Key.DOWN, Key.DOWN);
    await wizard.confirm();
    expect(await wizard.getNthQuickPickItemLabel(0)).to.have.string('3 extensions selected');
    await wizard.sendKeys(Key.DOWN);
    await wizard.confirm();
    expect(await wizard.getNthQuickPickItemLabel(0)).to.have.string('2 extensions selected');
    await wizard.sendKeys(Key.DOWN);
    await wizard.confirm();
    expect(await wizard.getNthQuickPickItemLabel(0)).to.have.string('1 extension selected');
    await wizard.cancel();
  });

  /**
   * Tests if the project generation wizard has correct
   * step values at the wizard's title bar: (1/7), (2/7)
   */
  it('should have correct step values', async function () {
    const wizard: ProjectGenerationWizard = await ProjectGenerationWizard.openWizard(driver);
    expect(await wizard.getInputBoxTitle()).to.have.string('1/7');
    expect(await wizard.back()).to.not.be.ok;
    await wizard.next();

    expect(await wizard.getInputBoxTitle()).to.have.string('2/7');
    await wizard.next();

    expect(await wizard.getInputBoxTitle()).to.have.string('3/7');
    await wizard.next();

    expect(await wizard.getInputBoxTitle()).to.have.string('4/7');
    await wizard.next();

    expect(await wizard.getInputBoxTitle()).to.have.string('5/7');
    await wizard.next();

    expect(await wizard.getInputBoxTitle()).to.have.string('6/7');
    await wizard.next();

    expect(await wizard.getInputBoxTitle()).to.have.string('7/7');
    await wizard.prev();

    expect(await wizard.getInputBoxTitle()).to.have.string('6/7');
    await wizard.prev();

    expect(await wizard.getInputBoxTitle()).to.have.string('5/7');
    await wizard.prev();

    expect(await wizard.getInputBoxTitle()).to.have.string('4/7');
    await wizard.prev();

    expect(await wizard.getInputBoxTitle()).to.have.string('3/7');
    await wizard.prev();

    expect(await wizard.getInputBoxTitle()).to.have.string('2/7');
    await wizard.prev();

    expect(await wizard.getInputBoxTitle()).to.have.string('1/7');
    expect(await wizard.back()).to.not.be.ok;
    await wizard.next();

    expect(await wizard.getInputBoxTitle()).to.have.string('2/7');
    await wizard.prev();

    expect(await wizard.getInputBoxTitle()).to.have.string('1/7');
    expect(await wizard.back()).to.not.be.ok;

    await wizard.cancel();
  });

  /**
   * Tests if the project generation wizard correctly creates a new
   * Quarkus Maven project with some extensions added
   */
  it('should generate Maven project with extensions added', async function () {
    this.timeout(80000);

    const projectDestDir: string = path.join(tempDir, 'maven');
    const projectFolderName: string = 'quarkus-maven';

    await tree.createFolder(projectDestDir);

    expect(await ProjectGenerationWizard.generateProject(driver, {
      buildTool: 'Maven',
      artifactId: projectFolderName,
      extensions: ['Camel Core', 'Eclipse Vert.x'],
      dest: projectDestDir
    })).to.be.true;

    const pomEditor = await tree.openFile(path.join(projectDestDir, projectFolderName, 'pom.xml'));

    const pomDependencies: any[] = (await pomToJson(await pomEditor.getText())).project.dependencies.dependency;

    expect(
      _.some(pomDependencies, { groupid: 'org.apache.camel.quarkus', artifactid: 'camel-quarkus-core' }),
      'The Camel Core extension does not exist in the downloaded Maven-based Quarkus project'
    ).to.be.true;

    expect(
      _.some(pomDependencies, { groupid: 'io.quarkus', artifactid: 'quarkus-vertx' }),
      'The Eclipse Vert.x extension does not exist in the downloaded Maven-based Quarkus project'
    ).to.be.true;
  });

  /**
   * Tests if the project generation wizard correctly creates a new
   * Quarkus Gradle project with some extensions added
   */
  it('should generate Gradle project with extensions added', async function () {
    this.timeout(80000);

    const projectDestDir: string = path.join(tempDir, 'gradle');
    const projectFolderName: string = 'quarkus-gradle';

    await tree.createFolder(projectDestDir);

    await ProjectGenerationWizard.generateProject(driver, {
      buildTool: 'Gradle',
      artifactId: projectFolderName,
      extensions: ['Camel Core', 'Eclipse Vert.x'],
      dest: projectDestDir
    });

    const pathToBuildGradle: string = path.join(projectDestDir, projectFolderName, 'build.gradle');
    const gradleEditor = await tree.openFile(pathToBuildGradle);

    const dependencies: any[] = (await buildGradleToJson(await gradleEditor.getText())).dependencies;

    expect(
      _.some(dependencies, { name: '\'org.apache.camel.quarkus:camel-quarkus-core\'' }),
      'The Camel Core extension does not exist in the downloaded Gradle-based Quarkus project'
    ).to.be.true;

    expect(
      _.some(dependencies, { name: '\'io.quarkus:quarkus-vertx\'' }),
      'The Eclipse Vert.x extension does not exist in the downloaded Gradle-based Quarkus project'
    ).to.be.true;

    return new Promise(res => setTimeout(res, 6000));
  });

  /**
   * Tests if default values throughout the wizard are updated to match
   * the previously generated project's values
   */
  it('should display input values from previously generated project (with extensions)', async function () {
    this.timeout(80000);

    const projectDestDir: string = path.join(tempDir, 'previous-values-extensions');

    const buildTool: string = 'Gradle';
    const groupId: string = 'testgroupid';
    const artifactId: string = 'testartifactid';
    const projectVersion: string = 'testprojectVersion';
    const packageName: string = groupId;
    const resourceName: string = 'testresourcename';
    const extensions: string[] = ['Camel Core', 'Eclipse Vert.x'];

    await tree.createFolder(projectDestDir);

    await ProjectGenerationWizard.generateProject(driver, {
      buildTool,
      groupId,
      artifactId,
      projectVersion,
      packageName,
      resourceName,
      extensions,
      dest: projectDestDir
    });

    const wizard: ProjectGenerationWizard = await ProjectGenerationWizard.openWizard(driver);

    expect(await wizard.getNthQuickPickItemLabel(0)).equals(buildTool);
    await wizard.next();

    const actualGroupId = await wizard.getText();
    expect(actualGroupId).equals(groupId);
    await wizard.next();

    const actualArtifactId = await wizard.getText();
    expect(actualArtifactId).equals(artifactId);
    await wizard.next();

    const actualProjectVersion = await wizard.getText();
    expect(actualProjectVersion).equals(projectVersion);
    await wizard.next();

    const actualPackageName = await wizard.getText();
    expect(actualPackageName).equals(packageName);
    await wizard.next();

    const actualResourceName = await wizard.getText();
    expect(actualResourceName).equals(resourceName);
    await wizard.next();

    await wizard.sendKeys(Key.DOWN, Key.UP);
    const quickPickItemText: QuickPickItemInfo = await wizard.getNthQuickPickItemInfo(0);
    expect(quickPickItemText.label).to.have.string('Last used');
    expect(quickPickItemText.detail).to.have.string('Camel Core');
    expect(quickPickItemText.detail).to.have.string('Eclipse Vert.x');

    await wizard.cancel();
  });

  /**
   * Tests if the project generation wizard displays correct
   * validation messages
   */
  it('should have correct input validation messages', async function () {
    this.timeout(120000);
    const wizard: ProjectGenerationWizard = await ProjectGenerationWizard.openWizard(driver);
    await wizard.next();

    // groupId input validation
    const groupIdError1: string = 'Invalid groupId: A valid groupId can only contain characters from A to z, numbers, and the following symbols: ._$';
    const groupIdError2: string = 'Invalid groupId: A valid groupId must start with a character from A to z, or one of the following symbols: _$';
    const groupIdError3: string = 'Invalid groupId: A valid groupId must end with a character from A to z, a number, or one of the following symbols: _$';
    await assertValidation('groupId', wizard, [
      { text: 'org.acme' },
      { text: 'azaza' },
      { text: 'Az123aza' },
      { text: 'AzZza' },
      { text: 'azaz!a', errorMessage: groupIdError1 },
      { text: 'azaz_a', },
      { text: '$zazaz_aza$' },
      { text: '_zazaz_aza_' },
      { text: '&zazaz_aza_', errorMessage: groupIdError2 },
      { text: 'Azazaz_aza**', errorMessage: groupIdError3 },
      { text: 'Azazaz_aza_' },
      { text: 'Azaz3213az_aza*_', errorMessage: groupIdError1 },
      { text: '1z_azaz', errorMessage: groupIdError2 },
      { text: 'z_azaz1' }
    ]);
    await wizard.setText('org.acme');

    await wizard.next();

    // artifactId input validation
    const artifactIdError1: string = 'Invalid artifactId: A valid artifactId can only contain characters from a-z, numbers, and the following symbols: -._';
    const artifactIdError2: string = 'Invalid artifactId: A valid artifactId must start with a character from a-z';
    await assertValidation('artifactId', wizard, [
      { text: 'quarkus-getting-started' },
      { text: 'testing123-._' },
      { text: 'Test', errorMessage: artifactIdError2 },
      { text: '-test', errorMessage: artifactIdError2 },
      { text: '.test', errorMessage: artifactIdError2 },
      { text: '_test', errorMessage: artifactIdError2 },
      { text: 'test' },
      { text: '123test', errorMessage: artifactIdError2 },
      { text: 'test' },
      { text: 'te!*(&$&*^st', errorMessage: artifactIdError1 }
    ]);
    await wizard.setText('quarkus-getting-started');

    await wizard.next();
    await wizard.next();

    // package name input validation
    const packageNameError1: string = 'Invalid package name: A valid package name can only contain characters from A to z, numbers, and the following symbols: ._$';
    const packageNameError2: string = 'Invalid package name: A valid package name must start with a character from A to z, or one of the following symbols: _$';
    const packageNameError3: string = 'Invalid package name: A valid package name must end with characters from A to z, a number, or the following symbols: _$';
    await assertValidation('package name', wizard, [
      { text: 'org.acme' },
      { text: 'azaza' },
      { text: 'Az123aza' },
      { text: 'AzZza' },
      { text: 'azaz!a', errorMessage: packageNameError1 },
      { text: 'azaz_a', },
      { text: '$zazaz_aza$' },
      { text: '_zazaz_aza_' },
      { text: '&zazaz_aza_', errorMessage: packageNameError2 },
      { text: 'Azazaz_aza**', errorMessage: packageNameError3 },
      { text: 'Azazaz_aza_' },
      { text: 'Azaz3213az_aza*_', errorMessage: packageNameError1 },
      { text: '1z_azaz', errorMessage: packageNameError2 },
      { text: 'z_azaz1' }
    ]);
    await wizard.setText('org.acme');

    await wizard.next();

    // resource name input validation
    const resourceNameError1: string = 'Invalid resource name: A valid resource name can only contain characters from A to z, numbers, and underscores';
    const resourceNameError2: string = 'Invalid resource name: A valid resource name must start with a character from A to z';

    await assertValidation('resource name', wizard, [
      { text: 'GreetingResource' },
      { text: 'greeting' },
      { text: '!greeting', errorMessage: resourceNameError2 },
      { text: '^greeting', errorMessage: resourceNameError2 },
      { text: '3greeting', errorMessage: resourceNameError2 },
      { text: '_greeting', errorMessage: resourceNameError2 },
      { text: 'greet__^&%213ing', errorMessage: resourceNameError1 },
      { text: 'greet__213ing' },
      { text: 'greeting_' },
      { text: 'greeting7' },
      { text: 'greeting!', errorMessage: resourceNameError1 },
    ]);

    await wizard.cancel();
  });

  /**
   * Tests if the extensions picker displays extensions without duplicates.
   */
  it('should display extensions without duplicates', async function () {
    this.timeout(80000);
    const wizard: ProjectGenerationWizard = await ProjectGenerationWizard.openWizard(driver);
    await wizard.next();
    await wizard.next();
    await wizard.next();
    await wizard.next();
    await wizard.next();
    await wizard.next();
    await wizard.sendKeys(Key.DOWN, Key.UP);

    const allQuickPickInfo: QuickPickItemInfo[] = await wizard.getAllQuickPickInfo();
    const allLabels: string[] = allQuickPickInfo.map((info) => info.label);
    const uniqueLabels = new Set(allLabels);
    expect(allLabels.length).to.equal(uniqueLabels.size);
  });

  describe('Notification tests', function () {
    let center: INotificationsCenter | undefined;
    const notificationMessage = 'New project has been generated.';
    const newWindow = 'Open in new window';
    const addWorkspace = 'Add to current workspace';
    const currentWindow = 'Open in current window';
    let projectDestDir = 'generate-open-folder';
    const projectFolderName = 'quarkus-gradle';
    const duplicateNotificationMessage = `'${projectFolderName}' already exists in selected directory.`;
    const overwrite = 'Overwrite';
    const chooseAnother = 'Choose new directory';
    let alternativeLocation = 'alternative';

    before(function () {
      projectDestDir = path.join(tempDir, projectDestDir);
      alternativeLocation = path.join(tempDir, alternativeLocation);
    });

    beforeEach(async function () {
      const workbench = new Workbench();
      // clear notifications
      center = await workbench.openNotificationsCenter();
      expect(await center.isDisplayed()).to.be.true;
      // clears and closes notifications
      await center.clearAllNotifications();
      expect(await center.isDisplayed()).to.be.false;
      center = await workbench.openNotificationsCenter();
      expect(await center.isDisplayed()).to.be.true;

      // close all editors
      await workbench.getEditorView().closeAllEditors();
    });

    afterEach(async function () {
      await center?.close();
      center = undefined;
    });

    // Generate new project and give user 2 options: open in new window or add project to workspace.
    it('should show correct notification when generating project with open folder', async function () {
      await tree.createFolder(projectDestDir);

      await ProjectGenerationWizard.generateProject(driver, {
        buildTool: 'Gradle',
        artifactId: projectFolderName,
        extensions: ['Camel Core', 'Eclipse Vert.x'],
        dest: projectDestDir
      });

      await verifyNotification(notificationMessage, [newWindow, addWorkspace], center, this.timeout() - 2000, NotificationType.Info);
    });

    // Generate new project and give user 2 options: open in new window and or open in current window.
    // This test is not possible to perform on Eclipse Che.
    it.skip('should show correct notification when generating project with open editor tab', async function () {
      try {
        await tree.createFolder(projectDestDir);
        await tree.createFile(path.join(projectDestDir, 'testFile.txt'));

        await ProjectGenerationWizard.generateProject(driver, {
          buildTool: 'Gradle',
          artifactId: projectFolderName,
          extensions: ['Camel Core', 'Eclipse Vert.x'],
          dest: projectDestDir
        });

        await verifyNotification(notificationMessage, [newWindow, currentWindow], center, this.timeout() - 2000, NotificationType.Info);
      }
      finally {
        await tree.deleteFile(path.join(projectDestDir, 'testFile.txt')).catch(() => undefined);
      }
    });

    // Create 2 projects in same folder. In second attempt extension should prompt user to overwrite project or choose new directory.
    it('should not generate project into existing folder', async function () {
      await generateDuplicateProject(tempDir, projectFolderName, center);
      await verifyNotification(
        duplicateNotificationMessage,
        [overwrite, chooseAnother],
        center,
        this.timeout() - 2000,
        NotificationType.Warning
      );
    });

    // Create 2 projects in same folder. In second attempt extension should prompt user to overwrite project or choose new directory.
    // User selects overwrite option.
    it('should overwrite conflicting project', async function () {
      await generateDuplicateProject(tempDir, projectFolderName, center);
      await verifyNotification(
        duplicateNotificationMessage,
        [overwrite, chooseAnother],
        center,
        this.timeout() - 2000,
        NotificationType.Warning
      );

      const notification = await getNotification(
        `'${projectFolderName}' already exists in selected directory.`,
        center,
        this.timeout() - 2000
      );

      const projectPath = path.join(tempDir, projectFolderName);
      expect(await tree.existsFile(path.join(projectPath, 'build.gradle'))).to.be.true;
      await notification.takeAction(overwrite);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(await tree.existsFile(path.join(projectPath, 'pom.xml'))).to.be.true;
      expect(await tree.existsFile(path.join(projectPath, 'build.gradle'))).to.be.false;
    });

    // Create 2 projects in same folder. In second attempt extension should prompt user to overwrite project or choose new directory.
    // User chooses another location.
    it('should create project in another location', async function () {
      await generateDuplicateProject(tempDir, projectFolderName, center);
      await verifyNotification(
        duplicateNotificationMessage,
        [overwrite, chooseAnother],
        center,
        this.timeout() - 2000,
        NotificationType.Warning
      );

      const notification = await getNotification(
        `'${projectFolderName}' already exists in selected directory.`,
        center,
        this.timeout() - 2000
      );

      const projectPath = path.join(tempDir, projectFolderName);
      expect(await tree.existsFile(path.join(projectPath, 'build.gradle'))).to.be.true;

      await tree.createFolder(alternativeLocation);

      await notification.takeAction(chooseAnother);

      const dialog = await new Workbench().getOpenDialog(FileType.FOLDER);
      await dialog.selectPath(alternativeLocation);
      await dialog.confirm();

      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(await tree.existsFile(path.join(projectPath, 'build.gradle'))).to.be.true;
      expect(await tree.existsFile(path.join(alternativeLocation, projectFolderName, 'pom.xml'))).to.be.true;
    });
  });
});

async function wizardExists(): Promise<boolean> {
  const input: InputBox = new InputBox();
  try {
    return (await input.getTitle()).includes('Quarkus Tools');
  } catch (e) {
    return false;
  }
}

function pomToJson(pomContent: string): Promise<any> {
  return new Promise((res, rej) => {
    pomParser.parse({ xmlContent: pomContent }, (err, response) => {
      if (err) {
        rej(err);
      }
      res(response.pomObject);
    });
  });
}

function buildGradleToJson(pathToBuildGradle: string): Promise<any> {
  return new Promise((res, rej) => {
    g2js.parseText(pathToBuildGradle).then((response) => {
      res(response);
    });
  });
}

interface ExpectedValidation {
  text: string;
  errorMessage?: string;
}

async function assertValidation(type: string, input: InputBox, expectedResults: ExpectedValidation[]) {
  for (let i = 0; i < expectedResults.length; i++) {
    const expectedResult: ExpectedValidation = expectedResults[i];
    console.log(`Setting: "${expectedResult.text}"`);

    await input.setText(expectedResult.text);
    console.log(`Set: "${expectedResult.text}"`);
    if (expectedResult.errorMessage) {
      expect(await input.getDriver().wait(() => input.hasError(), 3000).catch(() => false), `Validation for ${type} at index ${i}, with text ${expectedResult.text} should be true`).to.be.true;

      const expectedMessage = expectedResult.errorMessage;
      const actualMessage = await repeat(async () => await input.getMessage() === expectedMessage ? expectedMessage : undefined, {
        timeout: 15000
      }).catch(() => input.getMessage());

      expect(actualMessage, `Validation for ${type} at index ${i}, with error message: "${expectedResult.errorMessage}" is incorrect`).to.equals(expectedMessage);
    } else {
      expect(await input.getDriver().wait(
        async () => await input.hasError() === false, 3000).then(() => false).catch(() => true),
        `Validation for ${type} at index ${i}, with text ${expectedResult.text} should be false`).to.be.false;
    }
    console.log(`Passed: "${expectedResult.text}"`);
  }
}

async function getFileTree(): Promise<IDefaultTreeSection> {
  const explorer = await new Workbench().getActivityBar().getViewControl('Explorer');
  const sideBar = await explorer.openView();
  return await sideBar.getDriver().wait(async () => {
    const sections = await sideBar.getContent().getSections();
    return sections[0];
  }, 20000, 'Could not find tree file section.') as IDefaultTreeSection;
}

async function getNotification(message: string, center: INotificationsCenter, timeout: number): Promise<INotification> {
  return await repeat(async () => {
    if (await center.isDisplayed() === false) {
      center = await new Workbench().openNotificationsCenter();
      return;
    }

    for (const notification of await center.getNotifications(NotificationType.Any)) {
      if (await notification.getMessage() === message) {
        return notification;
      }
    }
  }, {
    timeout,
    message: `Could not find notification with message: "${message}".`
  });
}

async function verifyNotification(
  notificationMessage: string,
  requiredActions: string[],
  center: INotificationsCenter,
  timeout: number,
  type: NotificationType
): Promise<void> {
  const buttons = new Set<string>();
  const notification = await getNotification(notificationMessage, center, timeout);
  expect(await notification.getType()).equals(type);

  if (await notification.getMessage() === notificationMessage) {
    const actionsTemp = await notification.getActions();
    for (const action of actionsTemp) {
      const title = await action.getTitle();
      if (requiredActions.includes(await action.getTitle())) {
        buttons.add(title);
      }
    }
  }

  if (buttons.size !== requiredActions.length) {
    throw new Error(`Could not get all notifications. Got: ${new Array(buttons.values()).join(', ')}. Expected: ${requiredActions.join(', ')}`);
  }
}

async function generateDuplicateProject(parentPath: string, projectFolderName: string, center: INotificationsCenter) {
  for (let i = 0; i < 2; i++) {
    expect(
      await ProjectGenerationWizard.generateProject(SeleniumBrowser.instance.driver, {
        buildTool: i % 2 === 0 ? 'Gradle' : 'Maven',
        artifactId: projectFolderName,
        extensions: ['Camel Core', 'Eclipse Vert.x'],
        dest: parentPath
      })
    ).to.be.true;
  }
}
