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

Let's come to the usage part. As this action is supposed to be used in GitHub CI
pipelines, you should start with creating a file
`.github/workflows/json_schema_check.yml` following the given folder structure.
Then, open the file and start adding your JSON Schema Check workflow.

As mentioned before, it is essential to check out the code before this action
can run. Therefore, you may start as follows:

```yaml
name: JSON Schema Check

on:
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
```

With this workflow definition, as soon as a pull request to the main branch is
created or modified, the workflow will start with checking out the branch it was
triggered at, e.g., a development branch.

Now we may add the actual JSON Schema Check action:

```yaml
name: JSON Schema Check

on:
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
      - name: JSON Schema Check
        uses: kit-data-manager/json-schema-check-action@v0.0.7
        with:
          schemaPath: 'schema.json'
          validate: true
          createDiff: true
          token: ${{ secrets.GITHUB_TOKEN }}
```

As you can see, there are a couple of arguments, where some of them are
mandatory and others are options. Details can be found in the following table.

| Argument        | Description                                                                                                                                                                                                                                                                                                | Mandatory          | Default |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------- |
| schemaPath      | The relative path where the schema is located in the repository.                                                                                                                                                                                                                                           | :white_check_mark: | -       |
| validate        | Enabled or disables validation of the schema. Supported values are _true_ or _false_.                                                                                                                                                                                                                      | :x:                | true    |
| createDiff      | Enabled or disables creation of diff to previous schema version. Supported values are _true_ or _false_.                                                                                                                                                                                                   | :x:                | true    |
| token           | A GitHub token used to authenticate API access for obtaining the most recent release. This argument is only mandatory, if createDiff is _true_.                                                                                                                                                            | :x:                | -       |
| previousVersion | The previous version/tag name to apply the diff against. This argument's value must be determined in an upstream action and should have a variable name as value, e.g., ${{ steps.determine-previous-version.outputs.version }}. Using this argument is only recommended for experts and in special cases. | :x:                | -       |

If configured correctly, the action will now run on each build for pull requests
to the main branch. You may modify the configuration according to your needs.

> [!IMPORTANT]  
> The action automatically selects the schema validator based on the URL given
> by the _$schema_ attribute. Currently, schema version draft-07, 2019-09, and
> 2020-12 are supported. While for 2019-09 and 2020-12 the https schema URLs are
> supported by the validator, for using schema draft-07 _$schema_ must be set to
> **https://json-schema.org/draft-07/schema**. If no _$schema_ attribute is
> found, the draft-07 validator is used.

For the first run, i.e., if your schema is not released, yet, you'll see a
message in the diff report, that no previous version could be obtained. In order
to allow the action to obtain it for an existing release, another CI workflow is
needed:

```yaml
name: Run on New Release

on:
  release:
    types: [published] # Triggers only when a release is published

jobs:
  on-release-job:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
      - name: JSON Schema Check
        uses: kit-data-manager/json-schema-check-action@v0.0.4
        with:
          schemaPath: 'schema.json'
          token: ${{ secrets.GITHUB_TOKEN }}
```

As you can see, the action can also be used on another trigger, which is the
publication of a new release. The purpose of this workflow is to publish the
schema as release artifact, such that it can be accessed directly instead of
checking out the code of a tagged version. Another advantage is, that this
action call creates a bundled schema, i.e., it resolves $ref elements in the
schema file, which could also be helpful for the schema applicability as some
tools cannot work with $refs very well. As a result, your release will contain a
file _bundled-<TAG>.json_, which is expected by this action for creating the
diff to the previous release. If the file was found, i.e., if at least one
release exists which has a file _bundled-<TAG>.json_ attached, you'll see the
following summary after each action run:

---

## JSON Schema Check Results

### Validate JSON Schema

:white_check_mark: The schema is valid JSON.

### Diff to Latest Release

```diff
 {
   properties: {
     name: {
-      description: "user name"
+      description: "Name of the user."
     }
     rating: {
-      description: "Workshop rating from 1 to 5"
+      description: "Workshop rating from 0 to 5"
-      minimum: 1
+      minimum: 0
     }
     feedback: {
-      maxLength: 512
+      maxLength: 256
     }
   }
 }
```

> [!TIP] To check schema backwards compatibility, you may use any AI provider
> with a prompt like:
>
> **Assuming I have two JSON schemas, both are different according to the
> following diff, are both schemas compatible? <PASTE_DIFF_HERE>**
>
> If you like, you may add additional rendering instructions, e.g.:
>
> **Render the result as table showing the changed attributes, a columns to
> check backward compatibility, and a column to provide comments on why a
> certain property is not backwards compatible.**

---

For further analysis of backwards compatibility, you may follow the tip at the
end. Putting the shown example in ChatGPT will bring the following result:

| **Property** | **Attribute Changed**  | **Backward Compatible?** | **Comments**                                                                               |
| ------------ | ---------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `name`       | `description`          | ✅ Yes                   | Description text change only; no effect on validation.                                     |
| `rating`     | `description`          | ✅ Yes                   | Description updated to match the new validation rule; not used for validation.             |
| `rating`     | `minimum: 1 ➝ 0`       | ✅ Yes                   | New schema accepts more values (0 is now valid); existing values (1–5) remain valid.       |
| `feedback`   | `maxLength: 512 ➝ 256` | ❌ No                    | New schema restricts `feedback` to 256 chars; values between 257–512 would now be invalid. |

As you can see, the change of the _feedback_ attribute will break backwards
compatibility, while all other changes keep compatibility. As a result, you may
offer some kind of migration or mapping between the previous schema version and
the new version and according to semantic versioning rules, the next version
will be a major release.

### Using a custom token

For the token argument you should typically use the value
_${{ secrets.GITHUB_TOKEN }}_, as this is the automatically generated token
intended to be used in CI workflows.

Alternatively, you can use your own token. Details on how to create GitHub
access tokens can be
[found here](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
For our purposes, **read** permissions to contents will be sufficient. Once
created, you have to make the created GitHub access token available to your
workflow actions. Details on how to do this can be
[found here](https://docs.github.com/de/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).
Afterward, you can use your token via _${{ secrets.YOUR_TOKEN_NAME }}_.

## License

This software is licensed under MIT License.
