import * as core from '@actions/core'
import { diffString } from 'json-diff'
import Ajv from 'ajv'
import * as fs from 'fs'
import * as github from '@actions/github'
import fetch from 'node-fetch'

export async function run(): Promise<void> {
  try {
    const schemaPath: string = core.getInput('schemaPath')
    const validate: boolean = core.getBooleanInput('validate')
    const diff: boolean = core.getBooleanInput('createDiff')
    core.info(`Checking schema path: ${schemaPath}`)
    core.info(`Performing validate: ${validate}`)
    core.info(`Performing diff: ${diff}`)

    const ajv = new Ajv()

    let message: string =
      '# JSON Schema Check Results\n' +
      '\n' +
      '### Validate JSON Schema\n' +
      '\n'

    core.info(`Reading schema file from ${schemaPath}`)
    const data: string = fs.readFileSync(schemaPath, {
      encoding: 'utf8',
      flag: 'r'
    })
    core.info('Parsing schema.')
    const schemaParsed = JSON.parse(data)

    let validationErrors: boolean = true
    let diffResult: string = ''

    if (validate) {
      core.info('Running schema validation.')
      const succeed = ajv.validateSchema(schemaParsed, false)

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
      const previousData: string | undefined =
        await obtainLastVersion(schemaPath)

      if (previousData) {
        const previousSchemaParsed = JSON.parse(previousData)
        diffResult = diffString(previousSchemaParsed, schemaParsed, {
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
            '> To check schema backwards compatibility, you may use any AI provider with a prompt like:\n' +
            '> \n' +
            '>   **Assuming I have two JSON schemas, both are different according to the following diff, are both schemas compatible?\n' +
            '>   <PASTE_DIFF_HERE>**\n' +
            '>\n' +
            '> If you like, you may add additional rendering instructions, e.g.:\n' +
            '>\n' +
            '> **Render the result as table showing the changed attributes, a columns to check backward compatibility, ' +
            '> and a column to provide comments on why a certain property is not backwards compatible.**\n'
        }
      } else {
        message += '```diff\nNo previous schema version found.\n```\n\n'
      }
    } else {
      core.info('Diff skipped.')
      message +=
        ':grey_question: No information available as diff creation was not configured. \n'
    }

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

    core.info('Action succeeded.')
    await core.summary.addRaw(message).write()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('Failed with unknown error. ' + error)
  }
}

async function obtainLastVersion(
  filename: string
): Promise<string | undefined> {
  try {
    const token: string = core.getInput('github_token', { required: true })
    const filePath: string = filename
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
    const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${latestTag}/${filePath}`
    core.info(`Fetching previous version from: ${fileUrl}`)

    const response = await fetch(fileUrl)

    if (!response.ok) {
      core.setFailed(`Failed to fetch previous version: ${response.statusText}`)
      return undefined
    }

    return await response.text()
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('Failed with unknown error. ' + error)
  }
  return undefined
}
