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
  + lint
    + bpmn
      + tasksWithoutUsers.js
    + dmn
      + unresolvedExpressions.js
    + output
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
    --env PROJECT_PATH=/project \
        bp3global/camunda-lint help
A CI/CD automation wrapper for linting a Camunda 8 Web Modeler project.

Usage: [COMMAND]

Available Commands:
  lint               Apply lint to BPMN + DMN files
  bpmnlint           Apply lint to just the BPMN files
  dmnlint            Apply lint to just the DMN files
  sbom               Generate the SBOM for the linters

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
Adding npm hosted rules package/s to the lintrc file will automatically include them when running the linter.

The full npm name for our package is `@bp3global/my-plugin` (or `@bp3global/my-plugin@^0.0.1` if we include the version). 

Adding a package to the lintrc file requires `plugin` as a prefix and a ruleset, typically `/recommended` or `/all` are used as rulesets, but this can vary.

The typical custom rule package specification is thus
```shell
# .bpmnlintrc
{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:@bp3global/my_plugin/recommended"
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
    "plugin:@bp3global/my_plugin@^0.0.1/recommended"
  ],
  "rules": {}
}
```

[Filipe] Need to check this behaves as intended with all the latest changes.

You must also use the "alias" in the `rules` section if you have one
```shell
# .bpmnlintrc
{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:@bp3global/my_plugin/recommended"
  ],
  "rules": {
    "@bp3global/my_plugin/my-custom-rule":"off"
  }
}
```

or with a version
```shell
# .bpmnlintrc
{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:@bp3global/my_plugin@^0.0.1/recommended"
  ],
  "rules": {
    "@bp3global/my_plugin/my-custom-rule":"off"
  }
}
```

#### Using an alternative registry for your package
1. If your packages are not in the npmjs.org registry, or are there and private,
   you will need to add an `.npmrc` file with details of where to find your packages and/or auth details


#### Using local/ad-hoc rules
When developing a new rule `my-new-bpmn-rule` locally and would like to include it without having to create and publish a plugin, this is possible.

Using the typical project example, it'd be recommended to have it under `lint/bpmn` if it's a bpmn lint rule or `lint/dmn` if it's a dmn one.

**IMPORTANT**: If, and only if, the rule needs additional dependencies, just add a `package.json` with the corresponding dependencies. for example:

```javascript
{
  "dependencies": {
    "bpmnlint-utils": "^1.1.1",
    "semver": "^6.3.1"
  }
}
```

Which would cause the project to look like this:
```
+ my-process-project
  + .bpmnlintrc
  + .dmnlintrc
  + model
    + process.bpmn
    + rules.dmn
  + lint
    + bpmn
      + tasksWithoutUsers.js
      + my-new-bpmn-rule.js       <=
      + package.json              <=
    + dmn
      + unresolvedExpressions.js
    + output
  + spec
    + bpmn.feature
    + dmn.feature
```

When running the linter, just provide the path for the rules folder to be included and it'll be dynamically loaded 
by the runner with the severity set to `warn`.

For bpmn set the `BPMN_RULES_PATH` environment variable, if dmn set the `DMN_RULES_PATH` environment variable, or both:

bpmn:
```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/my-process-project,dst=/project \
    --env PROJECT_PATH=/project \
    --env BPMN_RULES_PATH=/project/lint/bpmn \
        bp3global/camunda-lint bpmnlint
```

dmn:
```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/my-process-project,dst=/project \
    --env PROJECT_PATH=/project \
    --env DMN_RULES_PATH=/project/lint/dmn \
        bp3global/camunda-lint dmnlint
```

both:
```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/my-process-project,dst=/project \
    --env PROJECT_PATH=/project \
    --env BPMN_RULES_PATH=/project/lint/bpmn \
    --env DMN_RULES_PATH=/project/lint/dmn \
        bp3global/camunda-lint lint
```


#### Using a local/unpublished package or your own plugin directory
If you have been developing a new rule `my-new-rule` locally as part of your `local-rule-package` and want to try it without 
publishing the package, then there are a couple of options to tackle this:
1. Treat the plugin as ad-hoc rules
1. Mount the project folder and add an ad-hoc alias to the package.json


The ad-hoc rules were just described above, hence let's dive into mounting the project folder


In order to try using that new rule `my-new-rule` inside the local package `local-rule-package` - without publishing the package - 
you can mount `local-rule-package` separately into the `camunda-lint` container while making sure to add an alias for it on the 
custom rules `package.json` and that you include it in the lintrc file.


**IMPORTANT:** The following elements must be in place for this to work:
1. **package.json** :: placed on the custom rules folder, setting up an alias for the local package
1. **lintrc file/s** :: ensure .bpmnlintrc and .dmnlintrc files reference the alias accordingly
1. the plugin implementation:
    - rules
    - package.json (up to date)
    - node_modules (up to date)


**NOTE:** The local plugin must include the prefix `bpmnlint-plugin-` so it'll match the alias format required in `package.json` 
and also use the `plugin:` and ruleset as any other plugin.

```shell
# .bpmnlintrc

{
  "extends": [
    "bpmnlint:recommended", 
    "plugin:bpmnlint-plugin-local-rule-package/recommended"
  ],
  "rules": {}
}
```

**NOTE:** Adding a dependency for a local plugin must include the prefix `bpmnlint-plugin-` and use the `file:<path>` syntax to indicate its location.

```shell
# package.json

{
  "dependencies": {
    "bpmnlint-plugin-local-rule-package": "file:/plugin",
  }
}
```

Finally, run the linter mounting the package and ensuring to include the `package.json` references:
```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/my-process-project,dst=/project \
    --mount type=bind,src=${HOME}/local-rule-package,dst=/plugin -w /plugin \
    --env BPMN_RULES_PATH=/project/lint/bpmn \
    --env DMN_RULES_PATH=/project/lint/dmn \
    --env PROJECT_PATH=/project \
        bp3global/camunda-lint lint
```


#### Reporting options
As this is intended to be used in CI/CD pipelines, reporting output options have been added.
Reporting options include:
- console
- html  (html file extension)
- json  (json file extension)
- junit (xml  file extension)

**IMPORTANT:** the `console` format will only write to the console and not write to a file.

In order to get a report it requires to select a file and a format.
Using the project structure example from above:

```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/my-process-project,dst=/project \
    --env PROJECT_PATH=/project \
    --env BPMN_REPORT_FILEPATH=/project/lint/output/bpmnLintReport \
    --env DMN_REPORT_FILEPATH=/project/lint/output/dmnLintReport \
    --env REPORT_FORMAT=junit \
        bp3global/camunda-lint lint
```

Running the command above will create the following files if there's anything to report:
- /project/lint/output/bpmnLintReport.xml
- /project/lint/output/dmnLintReport.xml


#### Verbose
This is self-explanatory, will tell all the components in `camunda-lint` to output any and all available information about its execution to assist with any debugging that might be needed.

**NOTE:** For the packages to be verbose as well, need them to be aware of the `VERBOSE` environment variable.

The recommended use of this capability is as below:
```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/my-process-project,dst=/project \
    --env PROJECT_PATH=/project \
    --env VERBOSE=true \
        bp3global/camunda-lint lint
```


## Software Bill of Materials (SBOM)
This project generates a Software Bill of Materials (SBOM) to provide a comprehensive inventory of all software components, libraries, and dependencies. This is critical for security analysis, compliance, and understanding our software supply chain.
We use the CycloneDX standard, a lightweight and modern SBOM specification.

The recommended use of this capability is as below:
```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/output-files,dst=/output-files \
    --env SBOM_REPORT_PATH=/output-files \
        bp3global/camunda-lint sbom
```

This will output the file under `/output-files/camunda-lint-sbom.json`.



With that said, here's an alternative example for camunda-lint-sbom in XML:
```shell
docker run -it --rm \
    --mount type=bind,src=${HOME}/output-files,dst=/output-files \
    --env SBOM_REPORT_PATH=/output-files \
    --env SBOM_REPORT_FORMAT=XML \
        bp3global/camunda-lint sbom
```
