# Camunda Lint

This project packages the [bpmnlint](https://github.com/bpmn-io/bpmnlint) and
[dmnlint](https://github.com/bpmn-io/dmnlint) tools into a docker image that can be
easily leveraged in a CI/CD pipeline.

First we describe how to use the OOTB rules from Camunda. But, obviously, the real power of the linter
comes from being able to develop your own rules and we will describe those below

## Using Camunda Lint
Mount your project files into the `camunda-lint` container.
There is no particular restriction on where you mount your project - in the examples below you will see us using `/project`.

`camunda-lint` will the recurse through all the directories looking for files that it can apply linting to.
You may provide a `.bpmnlintrc` or `.dmnlintrc` file, to control rules as described in the
[bpmnlint](https://github.com/bpmn-io/bpmnlint?tab=readme-ov-file#configuration) and 
[dmnlint](https://github.com/bpmn-io/dmnlint?tab=readme-ov-file#configuration) documentation.

A typical project will have the following layout

```
+ my-process-project
  + .bpmnlintrc
  + .dmnlintrc
  + model
    + process.bpmn
    + rules.dmn
  + spec
    + bpmn.feature
    + dmn.feature
```

To run the linter on the files in this project then use the following commands
```shell
cd my-process-project

# Use the "help" command to see options
docker run -it --rm \
    --mount type=bind,src=${PWD},dst=/project \
    -e PROJECT_DIR=/project \
        bp3global/camunda-lint help
A CI/CD automation wrapper for linting a Camunda 8 Web Modeler project.

Usage: [COMMAND]

Available Commands:
  lint               Apply lint to BPMN + DMN files
  bpmnlint           Apply lint to just the BPMN files
  dmnlint            Apply lint to just the DMN files

The configuration options for the commands are defined in environment variables
as this is intended to run as part of a CI/CD pipeline.
See https://github.com/BP3/camunda-lint for more details.
```

## Customising the linter with your own linting rules
We recommend that you build your rules into an `npm` package and that you publish it to a suitable registry
(e.g. [npmjs.org](npmjs.org))

1. Follow the documentation here to create your own rule(s) package(s)
1. Publish your rules
1. Add these rules into your `.bpmnlintrc` or `.dmnlintrc` file

### Create your rule project
The following command creates a new rule project `my-plugin` using the `bpmn-plugin` template provided by Camunda
(see [bpmn-plugin](https://github.com/nikku/create-bpmnlint-plugin))
```shell
npm init --scope=@bp3global bpmnlint-plugin my-plugin
cd my-plugin
```
### Publish your rule project
[Joe] Can we give an example of `.npmrc`? What should it contain that is important
```shell
# requires .npmrc
npm publish --access public
# pushed into npmjs.org
```

### Add rules package(s) to lintrc file
**NOTE:** Unfortunately the Camaunda linter doesn't support the "standard" package naming formats you might expect in the lintrc file.
But it will still find your package if you use the following rules to reference it from the lintrc file.

In our case the full name for our package is `@bp3global/my-plugin` (or `@bp3global/my-plugin@^0.0.1` if we include the version), 
but we can't use this form directly in the lintrc file. 
Instead we must reference it as follows `__bp3global__my_plugin` for `@bp3global/my-plugin` - essentially you must
replace `@` and `/` with `__`

Adding your package to the lintrc file requires `plugin` as a prefix and a ruleset, typically `/recommended` is used.
The minimal custom rule package specification is thus
```shell
# .bpmnlintrc
{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:__bp3global__my_plugin/recommended"
  ],
  "rules": {}
}
```
or if you want to specify a specific version
```shell
# .bpmnlintrc
{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:__bp3global__my_plugin__0.0.1/recommended"
  ],
  "rules": {}
}
```

You must also use the "alias" in the `rules` section if you have one
```shell
# .bpmnlintrc
{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:__bp3global__my_plugin/recommended"
  ],
  "rules": {
    "__bp3global__my_plugin/my-custom-rule":"off"
  }
}
```

or with a verion
```shell
# .bpmnlintrc
{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:__bp3global__my_plugin__0.0.1/recommended"
  ],
  "rules": {
    "__bp3global__my_plugin__0.0.1/my-custom-rule":"off"
  }
}
```

#### Using an alternative registry for your package
1. If your packages are not in the npmjs.org registry, or are there and private,
   you will need to add an `.npmrc` file with details of where to find your packages and/or auth details

#### Using a local/unpublished package
If you have been developing a new rule `my-new-rule` locally as part of your `local-rule-package` and want to try it without publishing the package
then you need to mount the rule project `local-rule-package` separately into the `camunda-lint` container

```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/my-process-project,dst=/project \
    --mount type=bind,src=${HOME}/local-rule-package,dst=/plugin -w /plugin \
    -e PROJECT_DIR=/project \
        bp3global/camunda-lint
```

## Developing
```shell
docker build -t bp3global/camunda-lint .
```

## Using your own plugin directory

It is possible to have a separate directory with a plugin ready to run.<br/>
This means that the plugin directory should have:
- package.json (up to date)
- node_modules (up to date)
- any relevant lintrc files (".bpmnlintrc", ".dmnlintrc", etc...)
- the plugin implementation (this can be just installed locally, but can be also the project used for development)

For this example the following structure is used:
- host /project => docker /local
- host /plugin => docker /linter

The environment var is set for docker:
- PROJECT_DIR=/local

The working directory on the docker image is:
- /linter

For that purpose you need to set the working directory to that separate directory with the plugin and set the PROJECT_DIR to where the project files are kept<br/><br/>
### Running the container locally
```shell
docker run -it --rm \
    --mount type=bind,src=${PWD}/project,dst=/local \
    --mount type=bind,src=${PWD}/plugin,dst=/linter -w /linter \
    -e PROJECT_DIR=/local \
        bp3global/camunda-lint lint
```

### On Windows Command Line
```shell
docker run -it --rm \
    --mount type=bind,src=%cd%\project,dst=/local \
    --mount type=bind,src=%cd%\plugin,dst=/linter -w /linter \
    -e PROJECT_DIR=/local \
        bp3global/camunda-lint lint
```

