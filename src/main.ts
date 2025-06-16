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

    //core.summary.addHeading('JSON Schema Check Results', 1)
    //core.summary.addHeading('Validate JSON Schema', 3)

    core.info(`Reading schema file from ${schemaPath}`)
    const data: string = fs.readFileSync(schemaPath, 'utf8')
    core.info('Parsing schema.')
    const schema = JSON.parse(data)

    let validationErrors: boolean = false
    if (validate) {
      core.info('Running schema validation.')
      const succeed = ajv.validateSchema(schema, false)

      if (succeed) {
        core.info('Schema validation succeeded.')
        message += ':white_check_mark: The schema is valid JSON.\n'
        //core.summary.addRaw(':white_check_mark: The schema is valid JSON.')
      } else {
        core.error('Schema validation failed.')
        message +=
          ':x: Validation of the schema failed!\n' +
          '```json\n' +
          JSON.stringify(ajv.errors) +
          '\n```\n'
        //core.summary.addRaw(':x: Validation of the schema failed!')
      }
    } else {
      core.info('Skipping schema validation.')
      message +=
        ':grey_question: No information available as validation was not configured. \n'
      validationErrors = false
      //core.summary.addRaw(':grey_question: Schema validation skipped.')
    }

    message += '\n### Diff to Latest Release\n\n'
    //core.summary.addHeading('Diff to Latest Release', 3)
    //core.summary.addEOL()
    if (diff) {
      core.info('Running diff to previous version.')
      const content: string | undefined = await obtainLastVersion(schemaPath)
      if (content) {
        const diffResult: string = diffString(content, data, { color: false })

        console.log(diffResult)

        if (diffResult.length > 1000) {
          core.warning(
            'Difference is larger than 1000 characters. Diff formatting may be broken.'
          )
        }

        message += '```diff\n' + diffResult + '\n```\n\n'
      } else {
        message += '```diff\nNo previous schema version found.\n```\n\n'
      }
      //core.summary.addRaw('```diff\n' + diffResult + '\n```\n\n')
    } else {
      core.info('Diff skipped.')
      message +=
        ':grey_question: No information available as diff creation was not configured. \n'
      //core.summary.addRaw(':grey_question: Diff creation skipped.')
    }

    core.info('Finalizing output message.')
    message += '\n### Next Steps\n\n'
    //core.summary.addHeading('Next Steps', 3)

    const list: Array<string> = []

    if (validationErrors) {
      message += '- [ ] Fix validation errors\n'
      list.push('[ ] Fix validation errors')
    } else {
      message += '- [X] Fix validation errors\n'
      list.push('[X] Fix validation errors')
    }

    if (diff) {
      message += '- [ ] Check backwards compatibility based on diff\n'
      list.push('[ ] Check backwards compatibility based on diff')
    } else {
      message += '- [X] Check backwards compatibility based on diff\n'
      list.push('[X] Check backwards compatibility based on diff')
    }
    message += '- [ ] React with :thumbsup: to mark the PR as ready'
    list.push('[ ] React with :thumbsup: to mark the PR as ready')
    core.info('Setting output message.')
    core.setOutput('message', message)

    core.info('Action succeeded.')
    core.summary.addRaw(message)
    await core.summary.addList(list).write()
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
