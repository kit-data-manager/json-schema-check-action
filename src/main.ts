import * as core from '@actions/core'
//import { diffString } from 'json-diff'
import Ajv from 'ajv'
import * as fs from 'fs'

export async function run(): Promise<void> {
  try {
    const schemaPath: string = core.getInput('schemaPath')
    const validate: boolean = core.getBooleanInput('validate')
    const diff: boolean = core.getBooleanInput('createDiff')
    // @ts-expect-error Construction works
    const ajv = new Ajv()

    let message: string =
      '# JSON Schema Check Results\n' +
      '\n' +
      '### Validate JSON Schema\n' +
      '\n'

    const data: string = fs.readFileSync(schemaPath, 'utf8')
    const schema = JSON.parse(data)
    console.log(schema)
    let validationErrors: boolean = false
    if (validate) {
      const succeed = ajv.validateSchema(schema, false)

      if (succeed) {
        message += ':white_check_mark: The schema is valid JSON.\n'
      } else {
        message +=
          ':x: Validation of the schema failed!\n' +
          '```json\n' +
          JSON.stringify(ajv.errors) +
          '\n```\n'
      }
    } else {
      message +=
        ':grey_question: No information available as validation was not configured. \n'
      validationErrors = false
    }

    message += '\n' + '### Create Diff to Latest Release\n' + '\n'

    if (diff) {
      message +=
        '```diff\n' +
        '{\n' +
        '-  return 1 + 2\n' +
        '+  return num1 + num2\n' +
        '}\n' +
        '```\n' +
        '\n'
    } else {
      message +=
        ':grey_question: No information available as diff creation was not configured. \n'
    }

    message += '\n' + '### Next Steps\n' + '\n'

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

    core.setOutput('message', message)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
