# FnO-CWL resources

*[CLT]: Command Line Tool
*[ET]: Expression Tool

- [ ] update all example namespaces to
    ```turtle
    @prefix ex:                   <http://www.example.com#> .
    ```

## Commands

Directory [`./commands`](commands/) consists of the following:

- [`ls.fno.ttl`](commands/ls.fno.ttl): FnO description for the execution of `ls <path>`.
- [`lsl.fno.ttl`](commands/lsl.fno.ttl): FnO description for the execution of `ls [-s] <path>`.

### Command Line Tool Option Arguments

There exist Command Line Tools with option arguments that serve as a flag.
The following shows 2 examples of a command with one option.

```bash
# PSEUDO
CMD option1
# Concrete example
ls -s
```

Currently, the use of option arguments is mimicked through a `PropertyParameterMapping`
that maps the property `option1` to an empty string.

## Example01

Directory [`./example01`](example01/) consists of the following:

- [`abstract-wf.cwl`](example01/abstract-wf.cwl): CWL Workflow description containing one *concrete* step (`echo`), and one *abstract* step (`uppercase`).
- [`abstract-wf.cwl.ttl`](example01/abstract-wf.cwl.ttl): RDF representation of the latter (serialization: Turtle).
- [`concrete-wf.cwl`](example01/concrete-wf.cwl): CWL Workflow description containing two *concrete* steps: `echo` and `uppercase`.
- [`concrete-wf.cwl.ttl`](example01/concrete-wf.cwl.ttl): RDF representation of the latter (serialization: Turtle).
- [`echo.cwl`](example01/echo.cwl): CWL CLT description of the `echo` command.
- [`uppercase.cwl`](example01/uppercase.cwl): CWL ET description that transforms an incoming message to uppercase.
- [`cwl2fno-expected-result-concrete-wf.ttl`](example01/cwl2fno-expected-result-concrete-wf.ttl): Manually converted FnO Function Composition of [`concrete-wf.cwl.ttl`](example01/concrete-wf.cwl.ttl). This document can be used to validate the result of automated approaches (e.g. SPARQL queries).
