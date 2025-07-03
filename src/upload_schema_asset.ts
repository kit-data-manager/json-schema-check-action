import * as core from '@actions/core'
import * as github from '@actions/github'
import fetch from 'node-fetch'
import * as fs from 'fs'
import * as path from 'path'

export async function upload(filePath: string, token: string) {
  try {
    const { context } = github
    const uploadUrlTemplate = context.payload.release.upload_url // has {?name,label}
    const fileName = path.basename(filePath)
    const uploadUrl =
      uploadUrlTemplate.replace(/\{.*$/, '') +
      `?name=${encodeURIComponent(fileName)}`

    const fileData = fs.readFileSync(filePath)
    const stats = fs.statSync(filePath)

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip', // adjust if needed
        'Content-Length': stats.size.toString()
      },
      body: fileData
    })

    //if (!response.ok) {
    //  const errorBody = await response.text()
    //  throw new Error(
    //    `Failed to upload asset: ${response.status} ${response.statusText}\n${errorBody}`
    //  )
    //}

    const result: number = response.status
    if (result === 200) {
      core.info(`✅ Asset uploaded succeeded`)
    } else {
      core.error(`❌ Asset uploaded failed with status ${result}`)
      core.setFailed(`Asset uploaded failed with status ${result}`)
    }
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}
