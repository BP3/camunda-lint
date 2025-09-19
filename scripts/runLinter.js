//#! /usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { execSync } = require('node:child_process');
const BPMN_PREFIX = 'bpmn';
const DMN_PREFIX = 'dmn';
const BPMNLINT_RUNNER = 'bpmnlint-runner';
const DMNLINT_RUNNER = 'dmnlint-runner';

const REVISED_SUFFIX = 'Revised';

const argumentType = 'type';
const argumentConfig = 'config';
const argumentOutputPath = 'output';
const argumentFormat = 'format';
const argumentRulesPath = 'rulespath';
const argumentRulesSeverity = 'rulesseverity';
const argumentVerbose = 'verbose';
const argumentFilesToLint = 'files';

// Show the help text on how to use this utility
//
function showHelp() {
  console.error(`
    ---------
    runLinter
    ---------

    A utility that configures and runs either the bpmn or dmn linter.

    Usage: node runLinter.js --${argumentType}=<bpmn|dmn> --${argumentConfig}=<path to lintrc file> --${argumentFilesToLint}=<path to the files to be linted>

    Required Arguments:
      --${argumentType}=<bpmn|dmn>
                                                                    Specifies the linter type to run.
      --${argumentConfig}=<path to lintrc file>
                                                                    Specifies the lintrc file path.
                                                                    NOTE: please use an absolute path!
      --${argumentFilesToLint}=<path to the files to be linted>
                                                                    Specifies the path to the files to be linted.

    Optional Arguments
      --${argumentOutputPath}=<output file path>
                                                                    Specifies the output filepath.
                                                                    The file extension is determined by the format argument.
                                                                    NOTE: please use an absolute path!
      --${argumentFormat}=<format option>
                                                                    Specifies the format output.
                                                                    Possible options are: console (default), html, json, junit
                                                                    NOTE: 'console' does not generate a file even if one is specified.
                                                                    NOTE: 'junit' generates a file with the xml extension.
      --${argumentRulesPath}=<path to ad-hoc/custom rules>
                                                                    Specifies the path to the ad-hoc/custom rules to include when running.
                                                                    NOTE: please use an absolute path!
      --${argumentRulesSeverity}=<severity to apply to ad-hoc/custom rules>
                                                                    Specifies the ad-hoc/custom rules severity to apply when running.
                                                                    NOTE: This argument is only relevant if used with '${argumentRulesPath}'.
      --${argumentVerbose}
                                                                    Enables the tool to be verbose and output the steps to the console.

    Examples:
      node runLinter.js --${argumentType}=bpmn --${argumentConfig}=.bpmnlintrc /project/*.bpmn
      node runLinter.js --${argumentType}=dmn --${argumentConfig}=.dmnlintrc /project/*.dmn
  `);
  process.exit(1);
}

// Exit while showing an error to interrupt any pipeline
//
function exitWithError(doShowHelp, errorMessage, errorDetails) {
  console.error(`\n\n    ERROR: ${errorMessage}${errorDetails != null ? `\n           Detailed ${errorDetails}` : ``}`);
  if (doShowHelp) {
    showHelp();
  }
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
  const configFilename = fs.existsSync(`${path.join(process.cwd(), args[argumentConfig])}${REVISED_SUFFIX}`) 
                           ? `${path.join(process.cwd(), args[argumentConfig])}${REVISED_SUFFIX}`
                           : path.join(process.cwd(), args[argumentConfig])
                         ;
  if (!fs.existsSync(configFilename)) {
    console.error(`\n\n    ERROR: please provide a lintrc file\n`);
    showHelp();
  } else {
    // the configs and parameters are all ready now
    let cliCommand = `-c ${configFilename}`
                    + (args[argumentVerbose] ? ` -v` : ``)
                    + (args[argumentOutputPath] ? ` -o ${path.resolve(process.cwd(), args[argumentOutputPath])}` : ``)
                    + (args[argumentFormat] ? ` -f ${args[argumentFormat]}` : ` -f console`)
                    + (args[argumentRulesPath] ? ` -r ${args[argumentRulesPath]} -i` : ``)
                    + (args[argumentRulesSeverity] ? ` -s ${args[argumentRulesSeverity]}` : ``);

    // determine the lint runner
    let lintRunner = null;
    if (args[argumentType] == BPMN_PREFIX) {
      lintRunner = BPMNLINT_RUNNER;
    } else if (args[argumentType] == DMN_PREFIX) {
      lintRunner = DMNLINT_RUNNER;
    } else {
      exitWithError(true, `Invalid linter type.`, null);
    }

    // set the command to run if a valid type was provided
    //
    cliCommand = `node ${path.join(process.cwd(), lintRunner, lintRunner + '.js')}`
                   + ` ${path.resolve(process.cwd(), args[argumentFilesToLint])}`
                   + ` ${cliCommand}`;

    try {
      if (args[argumentVerbose]) {
        console.log(`\nVERBOSE: Running '${cliCommand}' from '${path.join(process.cwd(), lintRunner)}'`);
      }
      execSync(cliCommand, {cwd: path.join(process.cwd(), lintRunner), stdio: 'inherit'});
    } catch(err) {
      exitWithError(false, `There was an error while running the linter.`, err);
    }
  }
}

// install plugins if lintrc provided or show some help
//
let args = parseArgs();

if (process.argv.length > 4) {

  if (!fs.existsSync(args[argumentConfig])) {
    exitWithError(true, `Please provide a valid lintrc file.`, null);
  }

  if (args[argumentFilesToLint] == null) {
    exitWithError(true, `Please provide files to be linted.`, null);
  }

  runLinter(args);

} else {
  // present any error first
  //
  if (process.argv[2].toLowerCase().match(/((\-)+)?help/igm) != null) {
    showHelp();
  } else if (process.argv.length <= 4) {
	exitWithError(true, `Please provide all the required parameters.`, null);
  } else if(!fs.existsSync(args[argumentConfig])) {
    exitWithError(true, `Invalid path to lintrc file: ${args[argumentConfig]}.`, null);
  }
  // if there wasn't an error, but just a help request
  //
  showHelp();
}
