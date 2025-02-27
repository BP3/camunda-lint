# Camunda Lint

This image simply re-packages the [bpmnlint](https://github.com/bpmn-io/bpmnlint) and [dmnlint](https://github.com/bpmn-io/dmnlint) tools into a docker image so that it is more easily consumed in a CI/CD pipeline.

## Using Camunda Lint
You need to mount your Process Project into the `camunda-lint` container and then set the mount point as the
current working directory - you can see how to do this in the examples below.

`camunda-lint` will then recurse through all of the sub-directories from its working directory looking for files
that it can apply linting to.

If you provide a file `.bpmnlintrc` then it will be used as described in the documentation.
The same applies with the file `.dmnlintrc`

So, a typical project will have the following layout

```
+ my-process-project
  + .bpmnlintrc
  + .dmnlintrc
  + model
  | + process.bpmn
  | + rules.dmn
  + spec
    + bpmn.feature
    + dmn.feature
```

### On Linux or Windows PowerShell
```shell
cd my-process-project
docker run -it --rm --mount type=bind,src=${PWD}/local,dst=/local --workdir /local bp3global/camunda-lint
```

### On Windows Command Line
```shell
docker run -it --rm --mount type=bind,src=%cd%\local,dst=/local --workdir /local bp3global/camunda-lint
```
