//#! /usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { execSync } = require('node:child_process');

// --- Constants for clarity and maintainability ---
const LINTER_TYPE_LIST = ['bpmn', 'dmn'];
const LINT_RUNNERS = {
    "bpmn": "bpmnlint-runner",
    "dmn": "dmnlint-runner"
}
const REVISED_SUFFIX = 'Revised';

const argumentType = 'type';
const argumentConfig = 'config';
const argumentFilesToLint = 'files';
const argumentRunnerPath = 'runnerpath';
const argumentOutputPath = 'output';
const argumentFormat = 'format';
const argumentRulesPath = 'rulespath';
const argumentRulesSeverity = 'rulesseverity';
const argumentConsoleTable = 'consoletable';
const argumentVerbose = 'verbose';

// --- Zero-Dependency Color Logging using ANSI Escape Codes ---
const ANSI_COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  gray: '\x1b[90m',
  red: '\x1b[91m', // Bright Red
  yellow: '\x1b[93m', // Bright Yellow
  blue: '\x1b[94m', // Bright Blue
};

const logger = {
  isVerbose: false,
  log: (...args) => {
    if (logger.isVerbose) {
      console.log(`${ANSI_COLORS.gray}VERBOSE:${ANSI_COLORS.reset}`, ...args);
    }
  },
  info: (...args) => {
    console.log(`${ANSI_COLORS.bold}${ANSI_COLORS.blue}INFO:${ANSI_COLORS.reset}`, ...args);
  },
  warn: (...args) => {
    console.warn(`${ANSI_COLORS.bold}${ANSI_COLORS.yellow}WARN:${ANSI_COLORS.reset}`, ...args);
  },
  error: (...args) => {
    console.error(`${ANSI_COLORS.bold}${ANSI_COLORS.red}ERROR:${ANSI_COLORS.reset}`, ...args);
  },
};

// Show the help text on how to use this utility
//
function showHelp() {
  console.error(`
    ---------
    runLinter
    ---------

    A utility that configures and runs either the bpmn or dmn linter.

    Usage: node runLinter.js --${argumentType}=<bpmn|dmn> --${argumentConfig}=<path to lintrc file> --${argumentFilesToLint}=<path to the files to be linted> --${argumentRunnerPath}=<path to the lint runner>

    Required Arguments:
      --${argumentType}=<bpmn|dmn>
                                                                    Specifies the linter type to run.
      --${argumentConfig}=<path to lintrc file>
                                                                    Specifies the lintrc file path.
                                                                    NOTE: please use an absolute path!
      --${argumentFilesToLint}=<path to the files to be linted>
                                                                    Specifies the path to the files to be linted.
      --${argumentRunnerPath}=<path to the lint runner>
                                                                    Specifies the path to the lint runner files, where package.json is

    Optional Arguments
      --${argumentOutputPath}=<output file path>
                                                                    Specifies the output filepath.
                                                                    The file extension is determined by the format argument.
                                                                    NOTE: please use an absolute path!
      --${argumentFormat}=<format option>
                                                                    Specifies the format output.
                                                                    Possible options are: json (default), html, junit
                                                                    NOTE: 'junit' generates a file with the xml extension.
      --${argumentRulesPath}=<path to ad-hoc/custom rules>
                                                                    Specifies the path to the ad-hoc/custom rules to include when running.
                                                                    NOTE: please use an absolute path!
      --${argumentRulesSeverity}=<severity to apply to ad-hoc/custom rules>
                                                                    Specifies the ad-hoc/custom rules severity to apply when running.
                                                                    NOTE: This argument is only relevant if used with '${argumentRulesPath}'.
      --${argumentConsoleTable}=<true|false>
                                                                    Specifies whether the tool should present the report table to the console.
      --${argumentVerbose}
                                                                    Enables the tool to be verbose and output the steps to the console.

    Examples:
      node runLinter.js --${argumentType}=bpmn --${argumentConfig}=.bpmnlintrc /project/*.bpmn
      node runLinter.js --${argumentType}=dmn --${argumentConfig}=.dmnlintrc /project/*.dmn
  `);
  process.exit(1);
}

// Exit while showing an error to interrupt any pipeline and showing help if relevant
//
function exitWithErrorAndHelp(errorMessage, errorDetails) {
  logger.error(`${errorMessage}${errorDetails != null ? `\n       Detailed ${errorDetails}\n` : ``}`);
  showHelp();
}

function exitWithError(errorMessage, errorDetails) {
  logger.error(`${errorMessage}${errorDetails != null ? `\n       Detailed ${errorDetails}\n` : ``}`);
  process.exit(1);
}

// Parse the command line arguments
//
function parseArgs() {
  const result = {};
  // process.argv contains: [0: node executable, 1: script path, 2+: arguments]
  const argumentsList = process.argv.slice(2);

  for (let idx = 0; idx < argumentsList.length; idx++) {
    const arg = argumentsList[idx];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      // Handles --key=value
      if (value != null && value.trim() != '') {
        result[key] = value;
        // Handles any other flags without value (e.g.: --verbose)
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

// Run the selected linter with the corresponding arguments
//
function runLinter(args) {
  const expectedConfigPath = path.resolve(process.cwd(), args[argumentConfig]); //path.join(process.cwd(), args[argumentConfig])
  const configFilename = fs.existsSync(`${expectedConfigPath}${REVISED_SUFFIX}`) ? `${expectedConfigPath}${REVISED_SUFFIX}` : expectedConfigPath;
  if (!fs.existsSync(configFilename)) {
    exitWithErrorAndHelp(`ERROR: please provide a lintrc file\n`);
  } else {
    // the configs and parameters are all ready now
    let cliCommand = `-c ${configFilename}`
                    + (args[argumentVerbose] && args[argumentVerbose] == 'false' ? `` : ` -v`)
                    + (args[argumentConsoleTable] && args[argumentConsoleTable] == 'false' ? ` -t false` : ` -t`)
                    + (args[argumentOutputPath] ? ` -o ${path.resolve(process.cwd(), args[argumentOutputPath])}` : ``)
                    + (args[argumentFormat] ? ` -f ${args[argumentFormat]}` : ` -f json`)
                    + (args[argumentRulesPath] ? ` -r ${args[argumentRulesPath]} -i` : ``)
                    + (args[argumentRulesSeverity] ? ` -s ${args[argumentRulesSeverity]}` : ``);

    // determine the linter type
    if (!LINTER_TYPE_LIST.includes(args[argumentType])) {
      exitWithErrorAndHelp(`Invalid linter type: ${args[argumentType]}`);
    }

    //determine the lint runner path
    const lintRunner = `${args[argumentType]}lint-runner.js`;
    let lintRunnerPath = path.resolve(process.cwd(), args[argumentRunnerPath]);
    let lintRunnerExec = path.resolve(lintRunnerPath, lintRunner);
    if (!fs.existsSync(lintRunnerExec)) {
      exitWithErrorAndHelp(`Invalid lint runner path "${args[argumentRunnerPath]}". Could not find "${lintRunnerExec}"`);
    }

    // set the command to run if a valid type was provided
    //
    cliCommand = `node ${lintRunnerPath}` + ` "${path.resolve(process.cwd(), args[argumentFilesToLint])}"` + ` ${cliCommand}`;

    try {
      if (args[argumentVerbose]) {
        logger.log(`\nVERBOSE: Running '${cliCommand}' from '${path.resolve(process.cwd(), lintRunner)}'`);
      }
      execSync(cliCommand, { cwd: lintRunnerPath, stdio: 'inherit' });
    } catch (err) {
      exitWithError(`There was an error while running the linter.`, err);
    }
  }
}

// run the appropriate linter with the provided arguments
//
let args = parseArgs();

// VERBOSE: doing a type check in case a string is provided or just the
//          parameter without value, this simplifies additional scripting
//
logger.isVerbose = typeof args[argumentVerbose] == 'string' ? args[argumentVerbose] == 'true' : !!args[argumentVerbose];

logger.log('Arguments Parsed:', JSON.stringify(args));

if (process.argv.length > 5) {
  if (!LINTER_TYPE_LIST.includes(args[argumentType])) {
    exitWithErrorAndHelp(`Invalid linter type '${args[argumentType]}' provided. Must be one of: ${LINTER_TYPE_LIST.join(', ')}`);
  }

  if (!fs.existsSync(path.resolve(process.cwd(), args[argumentConfig])) && !fs.existsSync(`${path.resolve(process.cwd(), args[argumentConfig])}${REVISED_SUFFIX}`)) {
    exitWithErrorAndHelp(`The specified config file is not valid, '${path.resolve(process.cwd(), args[argumentConfig])}' does not exist.`);
  }

  if (args[argumentFilesToLint] == null) {
    exitWithErrorAndHelp(`Please provide files to be linted.`);
  }

  runLinter(args);

} else {
  // present any additional error
  //
  if (process.argv.length <= 5) {
    exitWithErrorAndHelp(`Please provide all the required parameters.`);
  }
  // fallback, just present a help request
  //
  showHelp();
}
