import * as core from '@actions/core'
import { diffString } from 'json-diff'
import Ajv from 'ajv'
import Ajv2019 from 'ajv'
import Ajv2020 from 'ajv'
import * as github from '@actions/github'
import fetch from 'node-fetch'
import * as $RefParser from '@apidevtools/json-schema-ref-parser'
import * as path from 'path'
import { upload } from './upload_schema_asset'
import { writeFile } from 'fs/promises'

export async function run(): Promise<void> {
  try {
    const schemaPath: string = core.getInput('schemaPath')
    const { eventName, payload } = github.context
    if (eventName === 'release' && payload.action === 'published') {
      //only run on release.published trigger
      const tagName: string = github.context.payload.release.tag_name
      const filename: string = `bundled-${tagName}.json`
      const token: string = core.getInput('token', { required: true })
      try {
        core.info(`Reading schema file from ${schemaPath}`)
        const data: object = await bundleJson(schemaPath)
        const json = JSON.stringify(data, null, 2)
        core.info(`Writing schema file to ${filename}`)
        await writeFile(filename, json, 'utf-8')
        core.info(`✅ JSON saved to ${filename}`)
      } catch (error) {
        core.error(`❌ Failed to write JSON: ${(error as Error).message}`)
      }
      core.info(`Uploading schema file ${filename} as release asset.`)
      await upload(filename, token)
    } else {
      const validate: boolean = core.getBooleanInput('validate')
      const diff: boolean = core.getBooleanInput('createDiff')
      const schemaVersion: string = core.getInput('schemaVersion')

      core.info(`Checking schema path: ${schemaPath}`)
      core.info(`Performing validate: ${validate}`)
      core.info(`Performing diff: ${diff}`)

      let ajv = undefined
      if (schemaVersion === '2019') {
        ajv = new Ajv2019()
      } else if (schemaVersion === '2020') {
        ajv = new Ajv2020()
      } else {
        ajv = new Ajv()
      }

      let message: string =
        '# JSON Schema Check Results\n' +
        '\n' +
        '### Validate JSON Schema\n' +
        '\n'

      core.info(`Reading schema file from ${schemaPath}`)
      const data: object = await bundleJson(schemaPath)

      let validationErrors: boolean = true
      let diffResult: string = ''

      if (validate) {
        core.info('Running schema validation.')
        const succeed = ajv.validateSchema(data, false)

        if (succeed) {
          core.info('Schema validation succeeded.')
          message += ':white_check_mark: The schema is valid JSON.\n'
          validationErrors = false
        } else {
          core.error('Schema validation failed.')
          message +=
            ':x: Validation of the schema failed!\n' +
            '```json\n' +
            JSON.stringify(ajv.errors) +
            '\n```\n'
          message +=
            '> [!TIP]\n' +
            '> To check and correct validation errors, you may use any online JSON schema validator, e.g., [jsonschemavalidator.net](https://www.jsonschemavalidator.net/).\n\n'
        }
      } else {
        core.info('Skipping schema validation.')
        message +=
          ':grey_question: No information available as validation was not configured. \n'
        validationErrors = false
      }

      message += '\n### Diff to Latest Release\n\n'
      if (diff) {
        core.info('Running diff to previous version.')
        const previousData: string | undefined = await obtainLastVersion()

        if (previousData) {
          const previousSchemaParsed = JSON.parse(previousData)
          diffResult = diffString(previousSchemaParsed, data, {
            color: false
          })

          if (diffResult.length == 0) {
            core.info('No difference found to previous version.')
            message +=
              '```diff\nNo difference found to previous version.\n```\n\n'
          } else {
            core.info(diffResult)

            if (diffResult.length > 1000) {
              core.warning(
                'Difference is larger than 1000 characters. Diff formatting may be broken.'
              )
            }

            message += '```diff\n' + diffResult + '\n```\n\n'
            message +=
              '> [!TIP]\n' +
              '> To check schema backwards compatibility, you may use any AI chatbot with a prompt like:\n' +
              '> \n' +
              '>   **Assuming I have two JSON schemas, both are different according to the following diff, are both schemas compatible?\n' +
              '>   <PASTE_DIFF_HERE>**\n' +
              '>\n' +
              '> If you like, you may add additional rendering instructions, e.g.:\n' +
              '>\n' +
              '> **Render the result as table showing the changed attributes, a columns to check backward compatibility, ' +
              '> and a column to provide comments on why a certain property is not backwards compatible.**\n' +
              '>\n' +
              '> Furthermore, you can also use the diff to get a hint on which schema version to use next:\n' +
              '>    **Assuming I have a JSON schema in version 1.0.0 and the next version has the following changes in diff format. Which would be the next version number following semantic versioning principles?\n' +
              '>   <PASTE_DIFF_HERE>**\n'
          }
        } else {
          message += '```diff\nNo previous schema version found.\n```\n\n'
        }
      } else {
        core.info('Diff skipped.')
        message +=
          ':grey_question: No information available as diff creation was not configured. \n'
      }
      const summary: string = message
      core.info('Finalizing output message.')
      message += '\n### Next Steps\n\n'

      if (validationErrors) {
        message += '- [ ] Fix validation errors\n'
      } else {
        message += '- [X] Fix validation errors\n'
      }

      if (diff) {
        message += '- [ ] Check backwards compatibility based on diff\n'
      } else {
        message += '- [X] Check backwards compatibility based on diff\n'
      }
      message += '- [ ] React with :thumbsup: to mark the PR as ready'
      message += '\n\n'

      core.info('Setting output message.')
      core.setOutput('message', message)
      core.info('Setting action summary.')
      await core.summary.addRaw(summary).write()
    }
    core.info('Action succeeded.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('Failed with unknown error. ' + error)
  }
}

async function obtainLastVersion(): Promise<string | undefined> {
  try {
    const token: string = core.getInput('token', { required: true })
    const octokit = github.getOctokit(token)
    const { owner, repo } = github.context.repo

    core.info(`Obtaining tags for repo ${owner}/${repo}`)
    // Step 1: Get the latest tag
    const tagsResponse = await octokit.rest.repos.listTags({
      owner,
      repo,
      per_page: 1
    })

    core.info(`Received ${tagsResponse.data.length} tags.`)
    const latestTag = tagsResponse.data[0]?.name
    if (!latestTag) {
      core.warning(
        'No tags found in the repository. Returning empty previous version.'
      )
      return undefined
    }
    core.info(`Latest tag: ${latestTag}`)

    // Step 2: Construct URL to fetch the file from the tag
    const fileUrl: string = `https://github.com/${owner}/${repo}/releases/download/${latestTag}/bundled-${latestTag}.json`
    core.info(`Fetching previous version from: ${fileUrl}`)

    const response = await fetch(fileUrl)

    if (!response.ok) {
      core.warning(`Failed to fetch previous version: ${response.statusText}`)
      return undefined
    }

    return await response.text()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else core.warning('Failed with unknown error. ' + error)
  }
  return undefined
}

async function bundleJson(inputFile: string): Promise<object> {
  try {
    core.info(`Bundling input schema from ${inputFile}`)
    const input = path.resolve(inputFile)
    // Resolve and bundle all references
    return await $RefParser.bundle(input)
  } catch (err) {
    console.error('Failed to bundle schema:', err)
    core.setFailed('Failed to bundle schema. ' + err)
    return {}
  }
}
