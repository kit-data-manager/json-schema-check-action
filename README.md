# JSON Schema Check Action

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This action is intended to be part of CI workflows in repositories used for JSON
schema development. Its goal is to ensure, that the coming version of the JSON
schema is syntactically valid and that the developer is informed about possible
breaking changes between schema versions, such that semantic versioning can be
used accordingly and migration rules can be provided if necessary.

## Under the hood

Before going into details, let's take a look under the hood of the action.
According to its goals, the action performs four tasks:

1. Validate the schema identified by its filename.
2. Diff to previous version.
   1. Determine the most recent release and obtain the schema.
   2. Create a diff between the schema's current development version and the
      most recent release version.
3. Create and print a summary and provide the summary as output for follow-up
   actions.

In order to get access to the current source code, of course, a checkout action
has to be executed in advance. Tasks 1 and 2 are optional, such that only
validation, only diff, or both of them can be executed. You may also skip both,
but this seems not to make sense. ;-)

## Usage

Let's come to
