const express = require('express')
const multer = require('multer')
const { google } = require('googleapis')
const { OAuth2Client } = require('google-auth-library')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

// ── Multer: save uploaded audio temporarily ──
const upload = multer({ dest: '/tmp/recordings/' })

// ── Google Auth via OAuth2 ──
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
})
const drive = google.drive({ version: 'v3', auth: oauth2Client })
const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

const MASTER_FOLDER_ID = process.env.DRIVE_MASTER_FOLDER_ID
const SHEET_ID = process.env.GOOGLE_SHEET_ID

// ── Helper: get or create agent subfolder ──
async function getOrCreateAgentFolder(agentName) {
  const res = await drive.files.list({
    q: `'${MASTER_FOLDER_ID}' in parents and name='${agentName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)'
  })
  if (res.data.files.length > 0) {
    return res.data.files[0].id
  }
  const folder = await drive.files.create({
    requestBody: {
      name: agentName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [MASTER_FOLDER_ID]
    },
    fields: 'id',
    supportsAllDrives: true
  })
  return folder.data.id
}

// ── Helper: upload audio file to Drive ──
function getMimeType(ext) {
  const map = {
    mp3: 'audio/mpeg', mp2: 'audio/mpeg',
    aac: 'audio/aac',
    m4a: 'audio/mp4', mp4: 'audio/mp4', alac: 'audio/mp4',
    ogg: 'audio/ogg', opus: 'audio/opus',
    wma: 'audio/x-ms-wma', amr: 'audio/amr',
    '3gp': 'audio/3gpp', wav: 'audio/wav',
    flac: 'audio/flac', aiff: 'audio/aiff',
    ape: 'audio/x-ape', gsm: 'audio/gsm',
    vox: 'audio/vox', au: 'audio/basic'
  }
  return map[ext.toLowerCase()] || 'audio/octet-stream'
}

async function uploadToDrive(filePath, fileName, folderId) {
  const ext = path.extname(fileName).slice(1)
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId]
    },
    media: {
      mimeType: getMimeType(ext),
      body: fs.createReadStream(filePath)
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true
  })
  return res.data
}

// ── Helper: log row to Google Sheet ──
async function logToSheet(agentId, fileName, duration, driveLink, timestamp) {
  const date = new Date(Number(timestamp))
  const dateStr = date.toLocaleDateString('en-IN')
  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit'
  })
  const durationMin = Math.round(Number(duration) / 60) + ' min'

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        dateStr,      // A - Date
        timeStr,      // B - Time
        agentId,      // C - Agent
        fileName,     // D - Filename
        durationMin,  // E - Duration
        driveLink,    // F - Drive Link
        'Pending'     // G - Status
      ]]
    }
  })
}

// ── Health check ──
app.get('/', (req, res) => {
  res.json({ status: 'CallBridge server running' })
})

// ── Main upload endpoint ──
app.post('/upload-recording', upload.single('audio'), async (req, res) => {
  const { agentId, duration, timestamp } = req.body
  const tempFile = req.file

  if (!tempFile || !agentId) {
    return res.status(400).json({ error: 'Missing file or agentId' })
  }

  try {
    // 1. Get or create agent subfolder in Drive
    const agentFolderId = await getOrCreateAgentFolder(agentId)

    // 2. Build filename: AgentName_08Jun2026_1430.mp3
    const date = new Date(Number(timestamp))
    const dateStr = date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).replace(/ /g, '')
    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(':', '')
    const originalExt = path.extname(tempFile.originalname || tempFile.filename || '').slice(1) || 'mp3'
    const fileName = `${agentId}_${dateStr}_${timeStr}.${originalExt}`

    // 3. Upload to Drive
    const driveFile = await uploadToDrive(tempFile.path, fileName, agentFolderId)

    // 4. Log to Sheet
    await logToSheet(agentId, fileName, duration, driveFile.webViewLink, timestamp)

    // 5. Delete temp file
    fs.unlinkSync(tempFile.path)

    console.log(`Uploaded: ${fileName} for ${agentId}`)

    res.json({
      success: true,
      fileName,
      driveLink: driveFile.webViewLink
    })

  } catch (error) {
    console.error('Upload error:', error)
    if (tempFile?.path) {
      try { fs.unlinkSync(tempFile.path) } catch (e) {}
    }
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`CallBridge server running on port ${PORT}`)
})
