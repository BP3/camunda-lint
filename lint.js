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

//*************************************************************************
// Dependencies
//*************************************************************************
const fs = require('fs');
const path = require('path');
const process = require('process');
const { execSync, execFileSync } = require('child_process');
const { logger } = require('./logger.js');

//*************************************************************************
// Constants
//*************************************************************************
const modeLint = 'lint';
const modeBpmnlint = 'bpmnlint';
const modeDmnlint = 'dmnlint';
const modeSBOM = 'sbom';
const modeHelp = 'help';

const BPMN = 'BPMN';
const DMN = 'DMN';

const LINTRC_REVISED_SUFFIX = 'Revised';

const WORKING_DIR = process.cwd();
const PACKAGE_JSON = 'package.json';
const NODE_MODULES = 'node_modules';
const LINT_RUNNER_PATH = path.resolve(fs.existsSync('/app') ? '/app' : process.cwd(), `./`); // './lint-runner/'
const SBOM_JSON_FILE = path.resolve(fs.existsSync('/app') ? '/app' : process.cwd(), `./camunda-lint-sbom.json`);
const lintRunnerPath = path.resolve(LINT_RUNNER_PATH, 'lint-runner.js');

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

const helpMessage = `
A CI/CD automation wrapper for linting a Camunda 8 Web Modeler project.

Usage: [COMMAND]

Available Commands:
  lint               Apply lint to BPMN + DMN file
  bpmnlint           Apply lint to just the BPMN files
  dmnlint            Apply lint to just the DMN files
  sbom               Generate the SBOM for the linters

The configuration options for the commands are defined in environment variables
as this is intended to run as part of a CI/CD pipeline.
See https://github.com/BP3/camunda-lint for more details.
`;

//*************************************************************************
// Variables
//*************************************************************************
let isModeBpmn = false;
let isModeDmn = false;
let isModeSbom = false;
let isShowHelp = false;

// let bpmnPath = './';
// let dmnPath = './';

let modeArgument = null;
let overallSuccess = true;

//*************************************************************************
// Helper functions
//*************************************************************************
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

// Get the npm package that a "plugin:<name>/<config>" entry in the lintrc file refers to.
// This follows the same naming rules that bpmnlint / dmnlint use to load the plugin, e.g. for bpmnlint:
//   plugin:camunda-compat/...                  => bpmnlint-plugin-camunda-compat
//   plugin:bpmnlint-plugin-camunda-compat/...  => bpmnlint-plugin-camunda-compat
//   plugin:@scope/my-rules/...                 => @scope/bpmnlint-plugin-my-rules
function getPluginPackageName(extendsEntry, linterType) {
  const match = /^plugin:(?:(@[^/]+)\/)?([^@/][^/]*)\/[^/]+$/.exec(extendsEntry);
  if (match == null) {
    return null;
  }
  const [, scope, name] = match;
  const productName = `${linterType.toLowerCase()}lint`;
  const pluginPrefix = `${productName}-plugin-`;
  const packageName = name === productName || name.startsWith(pluginPrefix) ? name : `${pluginPrefix}${name}`;
  return scope ? `${scope}/${packageName}` : packageName;
}

// Check if a package is already installed in the lint runner (e.g. bundled in the image)
function isPackageInstalled(packageName) {
  return fs.existsSync(path.join(LINT_RUNNER_PATH, NODE_MODULES, packageName, PACKAGE_JSON));
}

// Install the given packages into the lint runner without changing its package.json.
// Returns true if the installation succeeded.
function installPackages(packageNames) {
  try {
    logger.debug(`About to run npm install on: ${LINT_RUNNER_PATH}`);
    // execFileSync (no shell) because the package names come from the user's lintrc file
    execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', ...packageNames], { cwd: LINT_RUNNER_PATH, stdio: 'pipe' });
    return true;
  } catch (err) {
    // keep the npm error lines (e.g. "npm error code E404"), as they explain why the installation failed
    const npmErrors = `${err.stderr || ''}`
      .split('\n')
      .filter((line) => line.startsWith('npm error'))
      .join('\n');
    logger.error(`Could not install: [ ${packageNames.join(', ')} ]\n${npmErrors || err.message}`);
    return false;
  }
}

// Prepare the config and dependencies for the bpmnlint runner.
// Returns false if a plugin referenced by the lintrc file is missing and could not be installed.
function prepareLintRunner(linterType, lintrcFullpath) {
  let revisedLintConfig;
  let pluginPackages = [];
  // read the provided config and collect the configs and dependencies
  let lintConfig = JSON.parse(fs.readFileSync(lintrcFullpath));

  // The baseline is to have whatever is on the lintrc file, otherwise use the default value
  logger.debug(`Preparing the config: ${JSON.stringify(lintConfig, null, 2)}`);
  revisedLintConfig = lintConfig || defaultLintConfig[linterType] || emptyLintConfig;
  if (revisedLintConfig.extends == null) {
    revisedLintConfig.extends = defaultLintConfig[linterType].extends || [];
  } else if (typeof revisedLintConfig.extends == 'string') {
    revisedLintConfig.extends = [revisedLintConfig.extends];
  }
  for (var idx = 0; idx < revisedLintConfig.extends.length; ++idx) {
    const pluginPackage = getPluginPackageName(revisedLintConfig.extends[idx], linterType);
    // if it's a plugin, keep track of the package it needs
    if (pluginPackage != null && !pluginPackages.includes(pluginPackage)) {
      pluginPackages.push(pluginPackage);
    }
  }
  logger.debug(`Prepared the revised config: ${JSON.stringify(revisedLintConfig, null, 2)}`);

  // write the revised lintrc file
  let revisedLintrcFile = path.join(LINT_RUNNER_PATH, `${path.basename(lintrcFullpath)}${LINTRC_REVISED_SUFFIX}`);
  logger.debug(`Writing lintrc revised file: ${revisedLintrcFile}`);
  fs.writeFileSync(revisedLintrcFile, JSON.stringify(revisedLintConfig, null, 2));

  // only install the plugins that aren't already available (most are bundled in the image),
  // so that no network access is needed when the lintrc file only uses bundled plugins
  logger.info(`Plugins referenced by ${lintrcFullpath}: [ ${pluginPackages.join(', ')} ]`);
  const missingPackages = pluginPackages.filter((pluginPackage) => !isPackageInstalled(pluginPackage));
  if (missingPackages.length == 0) {
    logger.info('All plugins are already installed.');
    return true;
  }

  logger.info(`Installing plugins: [ ${missingPackages.join(', ')} ]`);
  if (!installPackages(missingPackages)) {
    logger.error('Plugin installation failed! Check the plugin names in the lintrc file, and that npm can reach the registry.');
    return false;
  }
  logger.info('Plugins installed successfully.');
  return true;
}

// run the linter
function lint(linterType, projectPath) {
  let linterArgs = {};
  let lintExtension = linterType.toLowerCase();
  let lintrcFilename = `.${lintExtension}lintrc`;
  let lintrcRevisedFilename = `${lintrcFilename}${LINTRC_REVISED_SUFFIX}`;
  let lintrcFullpath = path.join(projectPath, lintrcFilename);
  let isBpmnLinterType = linterType == BPMN;

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
  if (!prepareLintRunner(linterType, lintrcFullpath)) {
    return false;
  }

  logger.info('Running the BPMN linter');
  logger.info('---------------------------------------------------');
  // prepare runner arguments
  linterArgs[argumentType] = linterType;

  // use the revised file that should have been generated
  linterArgs[argumentConfig] = path.join(LINT_RUNNER_PATH, lintrcRevisedFilename);
  linterArgs[argumentFilesToLint] = `${projectPath}/**/*.${lintExtension}`;

  if ((isBpmnLinterType && !isStringNullOrEmpty(process.env.BPMN_REPORT_FILEPATH)) || (!isBpmnLinterType && !isStringNullOrEmpty(process.env.DMN_REPORT_FILEPATH))) {
    linterArgs[argumentOutputPath] = isBpmnLinterType ? process.env.BPMN_REPORT_FILEPATH : process.env.DMN_REPORT_FILEPATH;
  } else {
    linterArgs[argumentOutputPath] = path.join(WORKING_DIR, `${isBpmnLinterType ? BPMN.toLowerCase() : DMN.toLowerCase()}-lint-report`);
  }

  linterArgs[argumentFormat] = process.env.REPORT_FORMAT || 'json';

  if ((isBpmnLinterType && !isStringNullOrEmpty(process.env.BPMN_RULES_PATH)) || (!isBpmnLinterType && !isStringNullOrEmpty(process.env.DMN_RULES_PATH))) {
    linterArgs[argumentRulesPath] = isBpmnLinterType ? process.env.BPMN_RULES_PATH : process.env.DMN_RULES_PATH;
    linterArgs[argumentRulesSeverity] = 'warn';
  }

  if (!isStringNullOrEmpty(process.env.CONSOLE_TABLE)) {
    linterArgs[argumentConsoleTable] = process.env.CONSOLE_TABLE;
  }

  if (linterArgs[argumentFilesToLint] == null) {
    exitWithErrorAndHelp(`Please provide files to be linted.`);
  }

  logger.debug(`Running linter with params: ${JSON.stringify(linterArgs, null, 2)}`);

  let cliCommand =
    ` --type=${linterArgs[argumentType].toLowerCase()}` +
    ` --config=${linterArgs[argumentConfig]}` +
    (linterArgs[argumentConsoleTable] && linterArgs[argumentConsoleTable] == 'false' ? ` --show-console-table=false` : ` --show-console-table`) +
    (linterArgs[argumentOutputPath] ? ` --output=${path.resolve(process.cwd(), linterArgs[argumentOutputPath])}` : ``) +
    ` --format=${linterArgs[argumentFormat]}` +
    (linterArgs[argumentRulesPath] ? ` --custom-rules-path=${linterArgs[argumentRulesPath]} --install-custom-deps` : ``) +
    (linterArgs[argumentRulesSeverity] ? ` --custom-rules-severity=${linterArgs[argumentRulesSeverity]}` : ``);

  // set the command to run if a valid type was provided
  cliCommand = `node ${lintRunnerPath} "${linterArgs[argumentFilesToLint]}" ${cliCommand}`;

  try {
    let basePath = path.resolve(process.cwd(), LINT_RUNNER_PATH);
    logger.debug(`Running '${cliCommand}' from '${basePath}'`);
    execSync(cliCommand, { cwd: basePath, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

//*************************************************************************
// Main run
//*************************************************************************
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
    overallSuccess = false;
  }
}

if (isModeBpmn) {
  const bpmnTarget = WORKING_DIR;
  logger.debug(`Running linter for ${BPMN} with path: ${bpmnTarget}`);
  if (!lint(BPMN, bpmnTarget)) {
    overallSuccess = false;
  }
}

if (isModeDmn) {
  const dmnTarget = WORKING_DIR;
  logger.debug(`Running linter for ${DMN} with path: ${dmnTarget}`);
  if (!lint(DMN, dmnTarget)) {
    overallSuccess = false;
  }
}

if (!overallSuccess) {
  process.exit(1);
} else if (!isModeSbom) {
  logger.info('Linting completed successfully.');
}
