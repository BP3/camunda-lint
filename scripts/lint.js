/*================================================================================
 =
 = Licensed Materials - Property of BP3 Global
 =
 =  bpmnlint-plugin-bpmn-rules
 =
 = Copyright © BP3 Global Inc. 2026. All Rights Reserved.
 = This software is subject to copyright protection under
 = the laws of the United States, United Kingdom and other countries.
 =
 =================================================================================*/

// Dependencies
const fs = require('fs');
const path = require('path');
const process = require('process');
const { execSync } = require('child_process');
const { logger } = require('../lib/logger');

// Constants
const modeLint = 'lint';
const modeBpmnlint = 'bpmnlint';
const modeDmnlint = 'dmnlint';
const modeSBOM = 'sbom';
const modeHelp = 'help';

const BPMN = 'BPMN';
const DMN = 'DMN';

const LINTRC_REVISED_SUFFIX = 'Revised';
// TODO : const LINTRC_DEFAULT_SUFFIX = 'Default';

const PACKAGE_JSON = 'package.json';
const LINT_RUNNER_PATH = `/sandbox/bp3/camunda-lint-github/lint-runner/`;
const SBOM_JSON_FILE = `/sandbox/bp3/camunda-lint-github/camunda-lint-sbom.json`;

const emptyLintConfig = {
  extends: [],
  rules: {},
};
const defaultLintConfig = {
  BPMN: {
    extends: ['bpmnlint:recommended', 'plugin:@BP3/bpmnlint-plugin-bpmn-rules/recommended'],
    rules: {},
    moddleExtensions: {
      zeebe: 'zeebe-bpmn-moddle/resources/zeebe.json',
    },
  },
  DMN: {
    extends: ['dmnlint:recommended'],
    rules: {},
  },
};

const argumentType = 'type';
const argumentConfig = 'config';
const argumentFilesToLint = 'files';
const argumentOutputPath = 'output';
const argumentFormat = 'format';
const argumentRulesPath = 'rulespath';
const argumentRulesSeverity = 'rulesseverity';
const argumentConsoleTable = 'consoletable';
const argumentVerbose = 'verbose';

const helpMessage = `
A CI/CD automation wrapper for linting a Camunda 8 Web Modeler project.

Usage: [COMMAND]

Available Commands:
  lint               Apply lint to BPMN + DMN file
  bpmnlint           Apply lint to just the BPMN files
  dmnlint            Apply lint to just the DMN files
  sbom               Output the SBOM

The configuration options for the commands are defined in environment variables
as this is intended to run as part of a CI/CD pipeline.
See https://github.com/BP3/camunda-lint for more details.
`;

// variables
let isModeBpmn = false;
let isModeDmn = false;
let isModeSbom = false;
let isShowHelp = false;

let bpmnPath = './';
let dmnPath = './';

//helper functions
function isStringNullOrEmpty(value) {
  return value == null || value.trim() == '';
}

function showHelpMessageAndExit(modeParam) {
  if (!isStringNullOrEmpty(modeParam)) {
    logger.error(`
*******************************************************************************

Mode not recognised: ${modeParam}

*******************************************************************************
${helpMessage}
`);
    process.exit(1);
  } else {
    logger.info(`${helpMessage}`);
  }
}

function showErrorAndHelpMessageAndExit(errorMessage) {
  if (!isStringNullOrEmpty(errorMessage)) {
    logger.error(`
*******************************************************************************

${errorMessage}

*******************************************************************************
${helpMessage}
`);
    process.exit(1);
  } else {
    logger.info(`${helpMessage}`);
  }
}

/*************************************************************************/
// Extract the details from a possible plugin name in the lintrc file to setup dependencies correctly
function getPluginDetails(packageName, lintPrefix) {
  let result = null;
  // assuming the correctness of the lintrc file, the currPackageName should be something like "plugin:pluginName/ruleset" at this time
  if (packageName != null && packageName.indexOf('plugin:') == 0) {
    // transform the package name provided to be used as a dependency
    const dependencyWithoutRuleSet = packageName.substring(0, packageName.lastIndexOf('/'));
    const ruleSet = packageName.substring(packageName.lastIndexOf('/'));
    //prepare the revised config name for a new lintrc
    const configName = dependencyWithoutRuleSet
      .replace(/@|\^|~|\.|\//gim, '-')
      .replace('--', '-')
      .replace('plugin:-', 'plugin:');
    // prepare the output
    result = {
      configName: `${configName}${ruleSet}`,
      dependencyName: `${configName.indexOf(`${lintPrefix}lint-plugin-`) < 0 ? `${lintPrefix}lint-plugin-` : ''}${configName.replace('plugin:', '')}`,
      dependencyValue: dependencyWithoutRuleSet.replace('plugin:', 'npm:'),
      npmReference: dependencyWithoutRuleSet.replace('plugin:', ''),
    };
  }
  return result;
}

// TODO : Assess whether to update the whole hierarchy of package.json files!
// Prepare the config and dependencies for the bpmnlint runner
function prepareLintRunner(linterType, lintrcFullpath) {
  let revisedLintConfig;
  let additionalDependencies = [];
  let npmPackages = [];
  // read the provided config and collect the configs and dependencies
  let lintConfig = JSON.parse(fs.readFileSync(lintrcFullpath));

  // The baseline is to have whatever is on the lintrc file, otherwise use the default value
  logger.debug(`Preparing the config: ${JSON.stringify(lintConfig, null, 2)}`);
  revisedLintConfig = lintConfig || defaultLintConfig[linterType] || emptyLintConfig;
  if (revisedLintConfig.extends != null) {
    if (typeof revisedLintConfig.extends == 'string') {
      revisedLintConfig.extends = [revisedLintConfig.extends];
    } else if (revisedLintConfig.extends.length > 0) {
      for (var idx = 0; idx < revisedLintConfig.extends.length; ++idx) {
        const currentPluginDetails = getPluginDetails(revisedLintConfig.extends[idx], linterType.toLowerCase());
        // if it's a plugin, prepare the appropriate dependencies
        if (currentPluginDetails != null) {
          additionalDependencies.push(currentPluginDetails);
          npmPackages.push(currentPluginDetails.npmReference);
        }
      }
    }
  } else {
    revisedLintConfig.extends = defaultLintConfig[linterType].extends || [];
  }
  logger.debug(`Prepared the revised config: ${JSON.stringify(revisedLintConfig, null, 2)}`);

  // write the revised lintrc file
  let revisedLintrcFile = path.join(LINT_RUNNER_PATH, `${path.basename(lintrcFullpath)}${LINTRC_REVISED_SUFFIX}`);
  logger.debug(`Writing lintrc revised file: ${revisedLintrcFile}`);
  fs.writeFileSync(revisedLintrcFile, JSON.stringify(revisedLintConfig, null, 2));

  // read the package json, ensure to include any additional dependencies and write it
  if (additionalDependencies != null && additionalDependencies.length > 0) {
    logger.debug(`Found dependencies that need to be sure to be installed: ${JSON.stringify(additionalDependencies, null, 2)}`);
    let packageJsonFilepath = path.resolve(process.cwd(), LINT_RUNNER_PATH, PACKAGE_JSON);
    let currentPackageJson = JSON.parse(fs.readFileSync(packageJsonFilepath));
    for (var idx = 0; idx < additionalDependencies.length; ++idx) {
      currentPackageJson.dependencies[additionalDependencies[idx].dependencyName] = additionalDependencies[idx].dependencyValue;
    }
    fs.writeFileSync(packageJsonFilepath, JSON.stringify(currentPackageJson, null, 2));
  }

  // install any additional required packages

  // present the plugins getting installed for this
  logger.info(`Installing plugins referenced by ${lintrcFullpath}: [ ${npmPackages.join(', ')} ]`);
  try {
    logger.debug(`About to run npm install on: ${path.resolve(process.cwd(), LINT_RUNNER_PATH)}`);
    // NOTE: not storing the result of this call nor handling the stdout nor stderr
    // 		 because applying any handling to the "npm install" command won't do anything
    execSync('npm install', { cwd: path.resolve(process.cwd(), LINT_RUNNER_PATH), stdio: 'pipe' });
    logger.info('Plugins installed successfully.');
  } catch (err) {
    logger.error(err);
    logger.error('Plugin installation failed!\n');
  }
}
/*************************************************************************/

function lint(linterType, projectPath) {
  let linterArgs = {};
  let lintExtension = linterType.toLowerCase();
  let lintrcFilename = `.${lintExtension}lintrc`;
  let lintrcRevisedFilename = `${lintrcFilename}${LINTRC_REVISED_SUFFIX}`;
  let lintrcFullpath = path.join(projectPath, lintrcFilename);

  // initialize the lintrc file if needed
  logger.info(`Initializing the ${linterType} rules for linting (if needed)`);
  logger.info('---------------------------------------------------');
  logger.debug(`Checking if ${lintrcFullpath} exists...`);
  if (!fs.existsSync(lintrcFullpath)) {
    lintrcFullpath = path.join(LINT_RUNNER_PATH, lintrcFilename);
    const configContent = JSON.stringify(defaultLintConfig[linterType], null, 2);
    logger.debug(`Linter Type: ${linterType}, Config Path: ${lintrcFullpath}, Config Content: ${configContent}`);
    fs.writeFileSync(lintrcFullpath, configContent);
  }

  // retrieve and install any plugins that were provided as part of .bpmnlintrc and generates a .bpmnlintrcRevised under the runner path
  logger.info('Installing the BPMN lint runner dependencies');
  logger.info('---------------------------------------------------');
  prepareLintRunner(linterType, lintrcFullpath);

  logger.info('Running the BPMN linter');
  logger.info('---------------------------------------------------');
  // prepare runner arguments
  linterArgs[argumentType] = linterType;
  linterArgs[argumentVerbose] = String(process.env.VERBOSE || 'false').toLowerCase() != 'false';

  // use the revised file that should have been generated
  linterArgs[argumentConfig] = path.join(LINT_RUNNER_PATH, lintrcRevisedFilename);
  linterArgs[argumentFilesToLint] = `${projectPath}/**/*.${lintExtension}`;

  if (!isStringNullOrEmpty(process.env.BPMN_REPORT_FILEPATH)) {
    linterArgs[argumentOutputPath] = process.env.BPMN_REPORT_FILEPATH;
  }

  linterArgs[argumentFormat] = process.env.REPORT_FORMAT || 'json';

  if (!isStringNullOrEmpty(process.env.BPMN_RULES_PATH)) {
    linterArgs[argumentRulesPath] = process.env.BPMN_RULES_PATH;
    linterArgs[argumentRulesSeverity] = 'warn';
  }

  if (!isStringNullOrEmpty(process.env.CONSOLE_TABLE)) {
    linterArgs[argumentConsoleTable] = process.env.CONSOLE_TABLE;
  }

  if (linterArgs[argumentFilesToLint] == null) {
    exitWithErrorAndHelp(`Please provide files to be linted.`);
  }

  logger.debug(`Running linter with params: ${JSON.stringify(linterArgs, null, 2)}`);
  // runLinter(linterArgs);

  // Resolve the lint runner path
  //const lintRunnerDir = path.resolve(__dirname, '..', LINT_RUNNER_PATH);
  const lintRunnerPath = path.resolve(LINT_RUNNER_PATH, 'index.js');

  // TODO : Review this: + (linterArgs[argumentRulesPath] && linterArgs[argumentInstallCustomDeps] ? ` --install-custom-deps` : ``)
  // TODO : This also requires further validation : + (linterArgs[argumentRulesPath]? ` --install-custom-deps` : ``)
  let cliCommand =
    ` --type=${linterArgs[argumentType].toLowerCase()}` +
    ` --config=${linterArgs[argumentConfig]}` +
    (linterArgs[argumentVerbose] && linterArgs[argumentVerbose] == 'false' ? `` : ` --verbose`) +
    (linterArgs[argumentConsoleTable] && linterArgs[argumentConsoleTable] == 'false' ? ` --show-console-table=false` : ` --show-console-table`) +
    (linterArgs[argumentOutputPath] ? ` --output=${path.resolve(process.cwd(), linterArgs[argumentOutputPath])}` : ``) +
    ` --format=${linterArgs[argumentFormat]}` +
    (linterArgs[argumentRulesPath] ? ` --custom-rules-path=${linterArgs[argumentRulesPath]} --install-custom-deps` : ``) +
    (linterArgs[argumentRulesSeverity] ? ` --custom-rules-severity=${linterArgs[argumentRulesSeverity]}` : ``);

  // set the command to run if a valid type was provided
  cliCommand = `node ${lintRunnerPath} "${linterArgs[argumentFilesToLint]}" ${cliCommand}`;

  try {
    logger.debug(`Running '${cliCommand}' from '${process.cwd()}'`);
    execSync(cliCommand, { cwd: path.resolve(process.cwd(), LINT_RUNNER_PATH), stdio: 'inherit' });
  } catch (err) {
    showErrorAndHelpMessageAndExit(`
There was an error while running the linter.
${err}
    `);
  }
}

// main run
let modeArgument = null;
if (process.argv.length < 3) {
  showHelpMessageAndExit('No parameter provided');
} else {
  modeArgument = process.argv[2];
  switch (modeArgument.toLowerCase()) {
    case modeLint:
      isModeBpmn = true;
      isModeDmn = true;
      break;
    case modeBpmnlint:
      isModeBpmn = true;
      break;
    case modeDmnlint:
      isModeDmn = true;
      break;
    case modeSBOM:
      isModeSbom = true;
      break;
    case modeHelp:
      isShowHelp = true;
      break;
    default:
      break;
  }
}

if (!isModeBpmn && !isModeDmn && !isModeSbom) {
  showHelpMessageAndExit(isShowHelp ? null : modeArgument);
}

if (isModeSbom) {
  if (fs.existsSync(SBOM_JSON_FILE)) {
    // stream the file to the output
    let sbomFile = fs.createReadStream(SBOM_JSON_FILE);
    sbomFile.on('open', () => {
      sbomFile.pipe(process.stdout);
    });
  } else {
    logger.info(`SBOM file not found: ${SBOM_JSON_FILE}`);
  }
}

if (isModeBpmn) {
  logger.debug(`Running linter for ${BPMN} with path: ${process.env.BPMN_PATH || process.env.PROJECT_PATH || bpmnPath}`);
  lint(BPMN, process.env.BPMN_PATH || process.env.PROJECT_PATH || bpmnPath);
}

if (isModeDmn) {
  logger.debug(`Running linter for ${DMN} with path: ${process.env.DMN_PATH || process.env.PROJECT_PATH || bpmnPath}`);
  lint(DMN, process.env.DMN_PATH || process.env.PROJECT_PATH || dmnPath);
}
