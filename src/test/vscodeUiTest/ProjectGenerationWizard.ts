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

import { InputBox, Workbench, WebDriver, WebElement, By, Key, IOpenDialog, IQuickPickItem, repeat, until, FileType } from 'theia-extension-tester';

/**
 * This class represents the project generation wizard visible
 * when the 'Quarkus: Generate a Quarkus project' VS Code command
 * is called.
 */
export class ProjectGenerationWizard extends InputBox {

  private currStep: number = 1;

  /**
   * The number of steps the wizard has
   */
  private lastStep: number = 7;

  /**
   * Opens the project generation wizard
   * @param driver
   */
  public static async openWizard(driver: WebDriver): Promise<ProjectGenerationWizard> {
    await (new Workbench()).executeCommand('Quarkus: Generate a Quarkus project');
    return (new ProjectGenerationWizard().wait(60000));
  }

  /**
   * Opens the project generation wizard and creates a new project
   * according to `options`
   * @param driver
   * @param options
   */
  public static async generateProject(driver: WebDriver, options: {
    buildTool?: string,
    groupId?: string,
    artifactId?: string,
    projectVersion?: string,
    packageName?: string,
    resourceName?: string,
    extensions?: string[],
    dest: string
  }): Promise<boolean> {
    const wizard: ProjectGenerationWizard = await this.openWizard(driver);
    try {
    if (options.buildTool) await wizard.setText(options.buildTool);
    await wizard.next();
    if (options.groupId) await wizard.setText(options.groupId);
    await wizard.next();
    if (options.artifactId) await wizard.setText(options.artifactId);
    await wizard.next();
    if (options.projectVersion) await wizard.setText(options.projectVersion);
    await wizard.next();
    if (options.packageName) await wizard.setText(options.packageName);
    await wizard.next();
    if (options.resourceName) await wizard.setText(options.resourceName);
    await wizard.next();

    if (options.extensions) {
      for (const extensionName of options.extensions) {
        await wizard.setText(extensionName);
        await wizard.confirm();
      }
    }
    await wizard.next();

    const dialog: IOpenDialog = await new Workbench().getOpenDialog(FileType.FOLDER);
    await dialog.selectPath(options.dest);
    await dialog.confirm();
    } catch (e) {
      console.error(e);
      return false;
    }

    // wait until project finishes downloading
    await new Promise(res => setTimeout(res, 4000));
    return true;
  }

  public async setText(newText: string) {
    await this.sendKeys(Key.ARROW_RIGHT);
    await super.setText(newText);
  }

  public async sendKeys(...var_args: (string | number | Promise<string | number>)[]) {
    await this.getDriver().wait(until.elementIsVisible(this), 10000);
    await super.sendKeys(...var_args);
  }

  /**
   * Goes to the next step in the wizard
   */
  public async next(): Promise<void> {
    await this.confirm();
    this.currStep++;
    if (this.currStep > this.lastStep) {
      return; // we don't expect another step after the last one
    }
    await this.getDriver().wait(async () => {
      const title = await this.getTitle();
      return title?.includes(`Quarkus Tools (${this.currStep}/`)
    }, 15000, 'Could not find next step.');
  }

  /**
   * Goes to the previous step in the wizard by
   * clicking the back button
   */
  public async prev(): Promise<void> {
    if (this.currStep === 1) {
      return;
    }

    await this.getDriver().wait(() => this.back(), 10000, 'Could not go back.');
    this.currStep--;

    await this.getDriver().wait(async () => {
      const title = await this.getTitle();
      return title?.includes(`Quarkus Tools (${this.currStep}/`)
    }, 15000, 'Could not find previous step.');
  }

  public async getInputBoxTitle(): Promise<string> {
    return this.getTitle();
  }

  /**
   * Returns `QuickPickItemInfo` of all quick picks including quick picks
   * that are not currently visible
   */
  public async getAllQuickPickInfo(): Promise<QuickPickItemInfo[]> {
    const all: QuickPickItemInfo[] = [];
    const maxVisible: number = (await this.getQuickPicks()).length;
    const idSet = new Set();
    await this.sendKeys(..._.times(maxVisible - 1, _.constant(Key.DOWN)));

    let toAdd: QuickPickItemInfo[] = await this.getVisibleQuickPickItemInfo();
    while (!toAdd.some((info) => idSet.has(info.id))) {
      all.push(...toAdd);
      toAdd.forEach((info: QuickPickItemInfo) => idSet.add(info.id));

      await this.sendKeys(..._.times(maxVisible, _.constant(Key.DOWN)));
      toAdd = await this.getVisibleQuickPickItemInfo();
    }

    const goUp: number = toAdd.filter((info: QuickPickItemInfo) => idSet.has(info.id)).length;
    await this.sendKeys(..._.times(goUp, _.constant(Key.UP)));

    toAdd = await this.getVisibleQuickPickItemInfo();
    for (const info of toAdd) {
      if (!idSet.has(info.id)) {
        all.push(info);
      }
    }
    return all;
  }

  /**
   * Returns `QuickPickItemInfo` of all visible quick picks
   */
  private async getVisibleQuickPickItemInfo(): Promise<QuickPickItemInfo[]> {
    const quickPicks: IQuickPickItem[] = await this.getQuickPicks();
    const all: QuickPickItemInfo[] = [];

    for (const quickPickItem of quickPicks) {
      all.push(await this.getQuickPickItemInfo(quickPickItem));
    }
    return all;
  }

  /**
   * Returns the `n`th quick pick item's label string
   * @param n
   */
  public async getNthQuickPickItemLabel(n: number): Promise<string> {
    return (await this.getNthQuickPickItemInfo(n)).label;
  }

  /**
   * Returns the `n`th quick pick item's `QuickPickItemInfo`
   * @param n
   */
  public async getNthQuickPickItemInfo(n: number): Promise<QuickPickItemInfo> {
    const quickPicks: IQuickPickItem[] = await repeat(async () => {
      const quickPicks: IQuickPickItem[] = await this.getQuickPicks();
      return quickPicks.length > 0 ? quickPicks : undefined;
    }, {
      timeout: 10000,
      message: 'Could not find quick picks'
    }) as IQuickPickItem[];

    if (n < 0 || n >= quickPicks.length) {
      throw `The index n is out of bounds. The number of quickpicks found were ${quickPicks.length}`;
    }

    const quickPickItem: IQuickPickItem = quickPicks[n];
    return this.getQuickPickItemInfo(quickPickItem);
  }

  /**
   * Returns `QuickPickItemInfo` for the provided `quickPickItem`
   * @param quickPickItem
   */
  private async getQuickPickItemInfo(quickPickItem: IQuickPickItem): Promise<QuickPickItemInfo> {
    const result: QuickPickItemInfo = {
      id: await quickPickItem.getAttribute('id'),
      label: await quickPickItem.getText()
    };

    try {
      result.detail = await this.getStringFromChildElementByClassName(quickPickItem, 'quick-open-entry-meta');
    } catch (e) {
      // there is no vscode.QuickPickItem.detail for this quick pick item
    }

    try {
      result.description = await this.getStringFromChildElementByClassName(quickPickItem, 'label-description');
    } catch (e) {
      // there is no vscode.QuickPickItem.description for this quick pick item
    }
    return result;
  }
  async getStringFromChildElementByClassName(element: WebElement, className: string): Promise<string> {
    const childElements = await element.findElements(By.className(className));

    if (childElements.length === 0) {
      throw new Error(`Quick pick does not have element with class "${className}".`);
    }

    return childElements[0].getText();
  }
}

export interface QuickPickItemInfo {
  id: string;
  label: string;
  description?: string;
  detail?: string;
}
