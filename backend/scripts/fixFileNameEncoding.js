// Repairs File documents whose name/originalName were mangled by the old
// upload path decoding UTF-8 filenames as latin1 (see the "Fix UTF-8 file
// names in uploads" fix). Also fixes the matching GridFS files.files
// filename for the same gridFsId, since it mirrors File.name.
//
// Defaults to a dry run that only prints what it would change.
// Pass --apply to actually write the changes.
//
// Usage:
//   node backend/scripts/fixFileNameEncoding.js [--dry-run|--apply]

require('dotenv').config()
const mongoose = require('mongoose')
const File = require('../models/File')

const APPLY = process.argv.includes('--apply')

const FILENAME_COLLATION = {
  locale: 'en',
  strength: 2,
}

// The classic UTF-8-decoded-as-latin1 mojibake: the lead bytes of common
// accented letters (ä, ö, å, ü, é, ...) turn into "Ã" or "Â" plus another
// character once the wrong charset has already broken the name once.
function looksMisencoded(value) {
  return typeof value === 'string' && /[ÃÂ]/.test(value)
}

function repairEncoding(value) {
  return Buffer.from(value, 'latin1').toString('utf8')
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`Connected (mode: ${APPLY ? 'APPLY' : 'DRY RUN'})`)

  const gridFsFiles = mongoose.connection.db.collection(
    'files.files'
  )

  const candidates = await File.find({
    $or: [
      { name: { $regex: '[ÃÂ]' } },
      { originalName: { $regex: '[ÃÂ]' } },
    ],
  })

  console.log(
    `Found ${candidates.length} candidate file document(s).`
  )

  let fixedCount = 0
  let skippedCount = 0

  for (const file of candidates) {
    const nameNeedsFix = looksMisencoded(file.name)
    const originalNameNeedsFix = looksMisencoded(
      file.originalName
    )

    if (!nameNeedsFix && !originalNameNeedsFix) {
      continue
    }

    const newName = nameNeedsFix
      ? repairEncoding(file.name)
      : file.name

    const newOriginalName = originalNameNeedsFix
      ? repairEncoding(file.originalName)
      : file.originalName

    console.log(`\nFile ${file._id}:`)

    if (nameNeedsFix) {
      console.log(
        `  name:         "${file.name}" -> "${newName}"`
      )
    }

    if (originalNameNeedsFix) {
      console.log(
        `  originalName: "${file.originalName}" -> "${newOriginalName}"`
      )
    }

    if (nameNeedsFix) {
      const duplicate = await File.findOne({
        _id: { $ne: file._id },
        userId: file.userId,
        projectId: file.projectId,
        folderId: file.folderId,
        name: newName,
      }).collation(FILENAME_COLLATION)

      if (duplicate) {
        console.log(
          `  SKIPPED: a file named "${newName}" already exists in this folder (id ${duplicate._id})`
        )
        skippedCount += 1
        continue
      }
    }

    if (APPLY) {
      await File.updateOne(
        { _id: file._id },
        {
          $set: {
            ...(nameNeedsFix ? { name: newName } : {}),
            ...(originalNameNeedsFix
              ? { originalName: newOriginalName }
              : {}),
          },
        }
      )

      if (nameNeedsFix) {
        await gridFsFiles.updateOne(
          { _id: file.gridFsId },
          { $set: { filename: newName } }
        )
      }

      console.log('  APPLIED')
    }

    fixedCount += 1
  }

  console.log(
    `\n${APPLY ? 'Fixed' : 'Would fix'} ${fixedCount} file(s). Skipped ${skippedCount} due to a name conflict.`
  )

  if (!APPLY) {
    console.log(
      '\nThis was a dry run. Re-run with --apply to make changes.'
    )
  }

  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
