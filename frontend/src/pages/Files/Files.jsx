import { useEffect, useRef, useState } from 'react'
import { getProjects } from '../../api/projects'
import {
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from '../../api/folders'
import {
  getFiles,
  uploadFile,
  downloadFile,
  updateFileContent,
  updateFile,
  deleteFile,
} from '../../api/files'
import './Files.css'

const NO_PROJECT = 'no-project'
const PROJECT_STORAGE_KEY = 'kreniter-files-project'
const FOLDER_DROP_MESSAGE =
  "Folders can't be uploaded. Open the folder and drag the files instead."
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024
const UPLOAD_SIZE_ERROR =
  'File is too large. Maximum size is 100 MB.'

// Shown inline inside whichever Files dialog is open, in the same style as
// the page-level actionError banner. An error for an in-progress dialog
// action belongs here rather than in actionError, which renders above the
// page content and would be hidden behind the dialog's backdrop -- this
// keeps it visible so the user can retry or cancel instead of the dialog
// just looking stuck.
function DialogError({ message }) {
  if (!message) {
    return null
  }

  return <div className="files-error">{message}</div>
}

function Files() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [folderStack, setFolderStack] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadingFileName, setUploadingFileName] = useState('')
  // Mirrors `uploading`, checked synchronously in uploadFiles so a drop or
  // file selection that fires before the state update from a previous
  // upload has re-rendered still can't start a second, concurrent queue.
  const uploadingRef = useRef(false)
  const [dragActive, setDragActive] = useState(false)
  const [dragOverFolderId, setDragOverFolderId] = useState(null)
  const [draggedFile, setDraggedFile] = useState(null)
  const [movingFile, setMovingFile] = useState(null)
  const [moveError, setMoveError] = useState('')
  const [folderTree, setFolderTree] = useState([])
  const [loadingFolderTree, setLoadingFolderTree] = useState(false)
  const [editorFile, setEditorFile] = useState(null)
  const [editorError, setEditorError] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [dialog, setDialog] = useState(null)
  const fileInputRef = useRef(null)
  // Latest-ref so the Escape-key effect below can call the current
  // handleDuplicateCancel without re-subscribing its listener every render.
  const handleDuplicateCancelRef = useRef(() => {})

  const currentFolder = folderStack[folderStack.length - 1] || null
  const projectValue = selectedProjectId || NO_PROJECT

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    setFolderStack([])
  }, [selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    loadCurrentFolder()
  }, [selectedProjectId, currentFolder?._id])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Close the open dialog/modal on Escape, following the same close condition
  // each one already uses for its Cancel/close button (or overlay click, where present).
  useEffect(() => {
    if (!dialog && !movingFile && !editorFile && !previewFile) {
      return
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') {
        return
      }

      if (dialog) {
        if (dialog.type === 'duplicate') {
          handleDuplicateCancelRef.current()
        } else {
          setDialog(null)
        }
        return
      }

      if (movingFile) {
        setMovingFile(null)
        return
      }

      if (editorFile) {
        if (!editorSaving) {
          setEditorFile(null)
          setEditorContent('')
        }
        return
      }

      setPreviewFile(null)
      setPreviewUrl('')
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dialog, movingFile, editorFile, previewFile, editorSaving])

  async function loadProjects() {
    try {
      const data = await getProjects()
      setProjects(data)

      const savedProjectId = localStorage.getItem(
        PROJECT_STORAGE_KEY
      )

      const projectExists = data.some(
        (project) =>
          String(project._id) === String(savedProjectId)
      )

      if (savedProjectId === NO_PROJECT) {
        setSelectedProjectId(NO_PROJECT)
      } else if (savedProjectId && projectExists) {
        setSelectedProjectId(String(savedProjectId))
      } else if (data.length > 0) {
        setSelectedProjectId(String(data[0]._id))
      } else {
        setSelectedProjectId(NO_PROJECT)
      }
    } catch (error) {
      setError(error.message || 'Failed to load projects.')
    }
  }

  async function loadCurrentFolder() {
    try {
      setLoading(true)
      setError('')

      const [folderData, fileData] = await Promise.all([
        getFolders(
          projectValue,
          currentFolder?._id || null
        ),
        getFiles(
          projectValue,
          currentFolder?._id || null
        ),
      ])

      setFolders(folderData)
      setFiles(fileData)
    } catch (error) {
      setError(error.message || 'Failed to load files.')
      setFolders([])
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  function handleProjectChange(event) {
    const value = event.target.value
    setSelectedProjectId(value)
    localStorage.setItem(PROJECT_STORAGE_KEY, value)
    setActionError('')
  }

  function openFolder(folder) {
    setFolderStack((current) => [
      ...current,
      folder,
    ])
  }

  function goBack() {
    setFolderStack((current) => current.slice(0, -1))
  }

  function handleBreadcrumbClick(index) {
    setFolderStack((current) =>
      current.slice(0, index + 1)
    )
  }

  function handleCreateFolder() {
    setDialog({
      type: 'input',
      action: 'create-folder',
      title: 'New folder',
      label: 'Folder name',
      value: '',
      confirmLabel: 'Create folder',
    })
  }

  function handleRenameFolder(folder) {
    setDialog({
      type: 'input',
      action: 'rename-folder',
      targetId: folder._id,
      title: 'Rename folder',
      label: 'Folder name',
      value: folder.name,
      confirmLabel: 'Save',
    })
  }

  function handleDeleteFolder(folder) {
    setDialog({
      type: 'confirm',
      action: 'delete-folder',
      targetId: folder._id,
      title: 'Delete folder',
      message: `Delete folder "${folder.name}"?`,
      confirmLabel: 'Delete',
    })
  }

  async function createFolderAction(name) {
    try {
      setActionError('')
      await createFolder(
        name.trim(),
        projectValue === NO_PROJECT
          ? null
          : projectValue,
        currentFolder?._id || null
      )
      setDialog(null)
      await loadCurrentFolder()
    } catch (error) {
      // A 409 duplicate keeps the dialog open with the error shown inline,
      // so the user can fix the name without retyping it.
      if (error.status === 409) {
        setDialog((current) => ({
          ...current,
          error: error.message,
        }))
        return
      }

      setActionError(
        error.message || 'Failed to create folder.'
      )
    }
  }

  async function renameFolderAction(folderId, name) {
    try {
      setActionError('')
      await renameFolder(folderId, name.trim())
      setDialog(null)
      await loadCurrentFolder()
    } catch (error) {
      if (error.status === 409) {
        setDialog((current) => ({
          ...current,
          error: error.message,
        }))
        return
      }

      setActionError(
        error.message || 'Failed to rename folder.'
      )
    }
  }

  async function deleteFolderAction(folderId) {
    try {
      setActionError('')

      const [childFolders, childFiles] =
        await Promise.all([
          getFolders(projectValue, folderId),
          getFiles(projectValue, folderId),
        ])

      if (
        childFolders.length > 0 ||
        childFiles.length > 0
      ) {
        setDialog(null)
        setActionError(
          'The folder must be empty before it can be deleted.'
        )
        return
      }

      await deleteFolder(folderId)
      setDialog(null)
      await loadCurrentFolder()
    } catch (error) {
      // Keeps the confirm dialog open with the error shown inline, so the
      // user can retry or cancel instead of losing the dialog's context.
      setDialog((current) => ({
        ...current,
        error: error.message || 'Failed to delete folder.',
      }))
    }
  }

  function openUploadDialog() {
    fileInputRef.current?.click()
  }

  async function handleFileSelection(event) {
    const selectedFiles = Array.from(
      event.target.files || []
    )

    event.target.value = ''

    await uploadFiles(selectedFiles)
  }

  async function uploadFiles(
    selectedFiles,
    targetFolderId = currentFolder?._id || null,
    { preserveActionError = false } = {}
  ) {
    if (selectedFiles.length === 0) {
      return
    }

    if (uploadingRef.current) {
      setActionError(
        'Please wait for the current upload to finish.'
      )
      return
    }

    const tooLargeFiles = selectedFiles.filter(
      (file) => file.size > MAX_UPLOAD_SIZE
    )
    const uploadableFiles = selectedFiles.filter(
      (file) => file.size <= MAX_UPLOAD_SIZE
    )

    if (tooLargeFiles.length > 0) {
      setActionError(
        tooLargeFiles.length === selectedFiles.length
          ? UPLOAD_SIZE_ERROR
          : `${UPLOAD_SIZE_ERROR} Skipped: ${tooLargeFiles
              .map((file) => file.name)
              .join(', ')}`
      )
    } else if (!preserveActionError) {
      setActionError('')
    }

    if (uploadableFiles.length === 0) {
      return
    }

    await processUploadQueue(uploadableFiles, targetFolderId)
  }

  // Uploads the queue one file at a time. A 409 duplicate pauses the queue
  // for a user decision (Replace / Keep both / Cancel); every other outcome
  // moves on to the next file so one duplicate never blocks the rest.
  async function processUploadQueue(
    queue,
    targetFolderId,
    onDuplicate = null
  ) {
    if (queue.length === 0) {
      setUploading(false)
      uploadingRef.current = false
      setUploadingFileName('')
      await loadCurrentFolder()
      return
    }

    const [nextFile, ...remainingFiles] = queue

    try {
      setUploading(true)
      uploadingRef.current = true
      setUploadingFileName(nextFile.name)

      await uploadFile(
        nextFile,
        projectValue === NO_PROJECT
          ? null
          : projectValue,
        targetFolderId,
        onDuplicate
      )

      await processUploadQueue(remainingFiles, targetFolderId)
    } catch (error) {
      if (error.status === 409 && error.data?.existingFileId) {
        setUploading(false)
        uploadingRef.current = false
        setUploadingFileName('')
        setDialog({
          type: 'duplicate',
          file: nextFile,
          existingFileId: error.data.existingFileId,
          targetFolderId,
          remainingFiles,
        })
        return
      }

      setUploading(false)
      uploadingRef.current = false
      setUploadingFileName('')
      setActionError(
        error.message === 'Failed to fetch'
          ? 'Upload failed. Check your connection and try again.'
          : error.message || 'Failed to upload file.'
      )
    }
  }

  async function handleDuplicateReplace() {
    if (!dialog || dialog.type !== 'duplicate') {
      return
    }

    const {
      file,
      existingFileId,
      targetFolderId,
      remainingFiles,
    } = dialog

    setDialog(null)

    try {
      setUploading(true)
      uploadingRef.current = true
      setUploadingFileName(file.name)
      setActionError('')
      await updateFileContent(existingFileId, file)
    } catch (error) {
      setActionError(
        error.message === 'Failed to fetch'
          ? 'Upload failed. Check your connection and try again.'
          : error.message || 'Failed to replace file.'
      )
    }

    await processUploadQueue(remainingFiles, targetFolderId)
  }

  async function handleDuplicateKeepBoth() {
    if (!dialog || dialog.type !== 'duplicate') {
      return
    }

    const { file, targetFolderId, remainingFiles } = dialog

    setDialog(null)

    await processUploadQueue(
      [file, ...remainingFiles],
      targetFolderId,
      'rename'
    )
  }

  function handleDuplicateCancel() {
    if (!dialog || dialog.type !== 'duplicate') {
      return
    }

    const { targetFolderId, remainingFiles } = dialog

    setDialog(null)
    processUploadQueue(remainingFiles, targetFolderId)
  }

  handleDuplicateCancelRef.current = handleDuplicateCancel

  function handleFileDragStart(event, file) {
    setDraggedFile(file)
    setDragActive(false)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', file._id)
  }

  function handleFileDragEnd() {
    setDraggedFile(null)
    setDragOverFolderId(null)
  }

  function handleDragOver(event) {
    if (draggedFile) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()

    if (
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return
    }

    setDragActive(false)
  }

  // Separates a drop's files from any dropped folders. webkitGetAsEntry is
  // the reliable way to tell them apart; when a browser doesn't support it,
  // fall back to treating a zero-size or unreadable item as a folder.
  async function classifyDroppedEntries(dataTransfer) {
    const items = dataTransfer?.items

    if (!items || items.length === 0) {
      return {
        files: Array.from(dataTransfer?.files || []),
        folderCount: 0,
      }
    }

    // Read every item and its entry synchronously first -- the browser only
    // guarantees the drag data store is valid for the duration of the drop
    // event, so nothing here can be deferred until after an await.
    const candidates = []

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]

      if (item.kind !== 'file') {
        continue
      }

      const getEntry = item.webkitGetAsEntry
      const entry =
        typeof getEntry === 'function'
          ? getEntry.call(item)
          : null

      candidates.push({ entry, file: item.getAsFile() })
    }

    const files = []
    let folderCount = 0

    for (const { entry, file } of candidates) {
      if (entry) {
        if (entry.isDirectory) {
          folderCount += 1
        } else if (file) {
          files.push(file)
        }
        continue
      }

      if (!file) {
        continue
      }

      if (file.size === 0) {
        folderCount += 1
        continue
      }

      try {
        await file.slice(0, 1).arrayBuffer()
        files.push(file)
      } catch {
        folderCount += 1
      }
    }

    return { files, folderCount }
  }

  async function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const { files: droppedFiles, folderCount } =
      await classifyDroppedEntries(event.dataTransfer)

    if (folderCount > 0) {
      setActionError(FOLDER_DROP_MESSAGE)
    }

    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles, undefined, {
        preserveActionError: folderCount > 0,
      })
    }
  }

  function handleFolderDragOver(event, folderId) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    setDragOverFolderId(folderId)
  }

  function handleFolderDragLeave(event, folderId) {
    event.preventDefault()
    event.stopPropagation()

    if (
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return
    }

    if (dragOverFolderId === folderId) {
      setDragOverFolderId(null)
    }
  }

  async function handleFolderDrop(event, folder) {
    event.preventDefault()
    event.stopPropagation()
    setDragOverFolderId(null)

    if (draggedFile) {
      if (
        String(draggedFile.folderId || '') ===
        String(folder._id || '')
      ) {
        setDraggedFile(null)
        return
      }

      try {
        setActionError('')
        await updateFile(draggedFile._id, {
          folderId: folder._id,
        })
        setDraggedFile(null)
        await loadCurrentFolder()
      } catch (error) {
        setActionError(
          error.message || 'Failed to move file.'
        )
        setDraggedFile(null)
      }

      return
    }

    const { files: droppedFiles, folderCount } =
      await classifyDroppedEntries(event.dataTransfer)

    if (folderCount > 0) {
      setActionError(FOLDER_DROP_MESSAGE)
    }

    if (droppedFiles.length === 0) {
      return
    }

    await uploadFiles(droppedFiles, folder._id, {
      preserveActionError: folderCount > 0,
    })
  }

  function handleRenameFile(file) {
    setDialog({
      type: 'input',
      action: 'rename-file',
      targetId: file._id,
      title: 'Rename file',
      label: 'File name',
      value: file.name,
      confirmLabel: 'Save',
    })
  }

  function handleDeleteFile(file) {
    setDialog({
      type: 'confirm',
      action: 'delete-file',
      targetId: file._id,
      title: 'Delete file',
      message: `Delete file "${file.name}"?`,
      confirmLabel: 'Delete',
    })
  }

  async function renameFileAction(fileId, name) {
    try {
      setActionError('')
      await updateFile(fileId, {
        name: name.trim(),
      })
      setDialog(null)
      await loadCurrentFolder()
    } catch (error) {
      // A 409 duplicate keeps the dialog open with the error shown inline,
      // so the user can fix the name without retyping it.
      if (error.status === 409) {
        setDialog((current) => ({
          ...current,
          error: error.message,
        }))
        return
      }

      setActionError(
        error.message || 'Failed to rename file.'
      )
    }
  }

  async function deleteFileAction(fileId) {
    try {
      setActionError('')
      await deleteFile(fileId)
      setDialog(null)
      await loadCurrentFolder()
    } catch (error) {
      // Keeps the confirm dialog open with the error shown inline, so the
      // user can retry or cancel instead of losing the dialog's context.
      setDialog((current) => ({
        ...current,
        error: error.message || 'Failed to delete file.',
      }))
    }
  }

  async function handleDialogSubmit(event) {
    event.preventDefault()

    if (!dialog) {
      return
    }

    if (dialog.type === 'input') {
      const value = dialog.value?.trim() || ''

      if (!value) {
        return
      }

      if (
        dialog.action === 'create-folder'
      ) {
        await createFolderAction(value)
        return
      }

      if (
        dialog.action === 'rename-folder'
      ) {
        await renameFolderAction(
          dialog.targetId,
          value
        )
        return
      }

      if (dialog.action === 'rename-file') {
        await renameFileAction(
          dialog.targetId,
          value
        )
      }

      return
    }

    if (dialog.action === 'delete-folder') {
      await deleteFolderAction(dialog.targetId)
      return
    }

    if (dialog.action === 'delete-file') {
      await deleteFileAction(dialog.targetId)
    }
  }

  async function handleDownloadFile(file) {
    try {
      setActionError('')
      const blob = await downloadFile(file._id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setActionError(
        error.message || 'Failed to download file.'
      )
    }
  }

  async function buildFolderTree(
    projectId,
    parentFolderId = null,
    level = 0
  ) {
    const data = await getFolders(
      projectId,
      parentFolderId
    )

    const result = []

    for (const folder of data) {
      const children = await buildFolderTree(
        projectId,
        folder._id,
        level + 1
      )

      result.push({
        ...folder,
        level,
        children,
      })
    }

    return result
  }

  async function openMoveDialog(file) {
    try {
      setMovingFile(file)
      setMoveError('')
      setLoadingFolderTree(true)
      setActionError('')

      const tree = await buildFolderTree(
        projectValue
      )

      setFolderTree(tree)
    } catch (error) {
      setMovingFile(null)
      setActionError(
        error.message || 'Failed to load folders.'
      )
    } finally {
      setLoadingFolderTree(false)
    }
  }

  async function moveFile(folderId) {
    if (!movingFile) {
      return
    }

    if (
      String(movingFile.folderId || '') ===
      String(folderId || '')
    ) {
      setMovingFile(null)
      return
    }

    try {
      setActionError('')
      setMoveError('')
      await updateFile(movingFile._id, {
        folderId: folderId || null,
      })
      setMovingFile(null)
      await loadCurrentFolder()
    } catch (error) {
      // Keeps the move dialog open with the error shown inline, so the
      // user can pick another folder or cancel.
      setMoveError(
        error.message || 'Failed to move file.'
      )
    }
  }

  function getFileExtensionValue(name) {
    const value = String(name || '').toLowerCase()
    const index = value.lastIndexOf('.')

    if (index === -1) {
      return ''
    }

    return value.slice(index + 1)
  }

  function isEditableFile(file) {
    const extension = getFileExtensionValue(file.name)
    const editableExtensions = [
      'txt',
      'md',
      'json',
      'js',
      'jsx',
      'ts',
      'tsx',
      'css',
      'html',
      'htm',
      'xml',
      'csv',
      'yml',
      'yaml',
      'sql',
      'php',
      'py',
      'java',
      'c',
      'cpp',
      'h',
      'hpp',
      'tsv',
      'svg',
    ]

    return editableExtensions.includes(extension)
  }

  function isImageFile(file) {
    const extension = getFileExtensionValue(file.name)
    const mimeType = String(file.mimeType || '').toLowerCase()

    const imageExtensions = [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'bmp',
      'avif',
      'ico',
      'svg',
    ]

    // Some browsers/OSes report no MIME type (or a non-image one) for .ico
    // files, so an empty MIME type is accepted for that extension only.
    const icoMimeTypes = [
      '',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ]

    if (extension === 'ico') {
      return (
        mimeType.startsWith('image/') ||
        icoMimeTypes.includes(mimeType)
      )
    }

    return (
      mimeType.startsWith('image/') ||
      imageExtensions.includes(extension)
    )
  }

  // SVGs are images, but only ever rendered through <img src={blobUrl}> --
  // never in an iframe or injected as HTML -- since <img> won't execute any
  // <script> the SVG contains. Keep this check separate from isImageFile so
  // the editor-launch logic below stays correct if that list ever changes.
  function isSvgFile(file) {
    const extension = getFileExtensionValue(file.name)

    return (
      extension === 'svg' ||
      String(file.mimeType || '').toLowerCase() ===
        'image/svg+xml'
    )
  }

  function isPdfFile(file) {
    return (
      getFileExtensionValue(file.name) === 'pdf' ||
      String(file.mimeType || '').toLowerCase() ===
        'application/pdf'
    )
  }

  function isOfficeFile(file) {
    const extension = getFileExtensionValue(file.name)

    return [
      'doc',
      'docx',
      'docm',
      'dot',
      'dotx',
      'dotm',
      'xls',
      'xlsx',
      'xlsm',
      'xlsb',
      'xlt',
      'xltx',
      'xltm',
      'ppt',
      'pptx',
      'pptm',
      'pot',
      'potx',
      'potm',
      'pps',
      'ppsx',
      'ppsm',
      'odt',
      'ods',
      'odp',
    ].includes(extension)
  }

  async function openEditor(file) {
    try {
      setEditorLoading(true)
      setEditorFile(file)
      setEditorContent('')
      setEditorError('')
      setActionError('')

      const blob = await downloadFile(file._id)
      const text = await blob.text()
      setEditorContent(text)
    } catch (error) {
      setEditorFile(null)
      setActionError(
        error.message || 'Failed to open file.'
      )
    } finally {
      setEditorLoading(false)
    }
  }

  async function openFile(file) {
    // Checked before isEditableFile so SVGs (which are both an editable
    // text format and an image) open as a preview first; editing them is a
    // separate action -- see the "Edit" row button.
    if (isImageFile(file) || isPdfFile(file)) {
      try {
        setPreviewLoading(true)
        setPreviewFile(file)
        setActionError('')

        const blob = await downloadFile(file._id)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
      } catch (error) {
        setPreviewFile(null)
        setActionError(
          error.message || 'Failed to open file.'
        )
      } finally {
        setPreviewLoading(false)
      }

      return
    }

    if (isEditableFile(file)) {
      await openEditor(file)
      return
    }

    if (isOfficeFile(file)) {
      await handleDownloadFile(file)
      return
    }

    await handleDownloadFile(file)
  }

  function closePreview() {
    setPreviewFile(null)
    setPreviewUrl('')
  }

  function closeEditor() {
    if (editorSaving) {
      return
    }

    setEditorFile(null)
    setEditorContent('')
  }

  async function saveEditor() {
    if (!editorFile) {
      return
    }

    try {
      setEditorSaving(true)
      setActionError('')
      setEditorError('')

      const file = new File(
        [editorContent],
        editorFile.name,
        {
          type:
            editorFile.mimeType ||
            'text/plain',
        }
      )

      const updated = await updateFileContent(
        editorFile._id,
        file
      )

      setEditorFile(updated)
      await loadCurrentFolder()
    } catch (error) {
      // Keeps the editor dialog open with the error shown inline, so the
      // user can retry saving or cancel without losing their edits.
      setEditorError(
        error.message || 'Failed to save file.'
      )
    } finally {
      setEditorSaving(false)
    }
  }

  function flattenFolderTree(tree) {
    return tree.flatMap((folder) => [
      folder,
      ...flattenFolderTree(folder.children || []),
    ])
  }

  function formatFileSize(size) {
    const value = Number(size) || 0

    if (value < 1024) {
      return `${value} B`
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`
    }

    if (value < 1024 * 1024 * 1024) {
      return `${(
        value /
        (1024 * 1024)
      ).toFixed(1)} MB`
    }

    return `${(
      value /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`
  }

  function getFileExtension(name) {
    const value = String(name || '')
    const index = value.lastIndexOf('.')

    if (index === -1) {
      return 'FILE'
    }

    return value
      .slice(index + 1)
      .toUpperCase()
      .slice(0, 5)
  }

  const moveFolders = flattenFolderTree(folderTree)

  return (
    <main className="files-page">
      <div className="files-intro">
        <div>
          <div className="files-kicker">WORKSPACE</div>
          <h1 className="files-title">Files</h1>
          <p className="files-description">
            Manage your project files and folders.
          </p>
        </div>

        <div className="files-project-selector">
          <label htmlFor="files-project">
            Project
          </label>
          <select
            id="files-project"
            value={projectValue}
            onChange={handleProjectChange}
          >
            <option value={NO_PROJECT}>
              No project
            </option>
            {projects.map((project) => (
              <option
                key={project._id}
                value={project._id}
              >
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section
        className={`files-workspace ${
          dragActive ? 'files-drag-active' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="files-toolbar">
          <div className="files-breadcrumb">
            {folderStack.length > 0 && (
              <button
                type="button"
                className="files-back-button"
                onClick={goBack}
                aria-label="Go back"
              >
                ←
              </button>
            )}

            <button
              type="button"
              className={`files-breadcrumb-item ${
                folderStack.length === 0
                  ? 'active'
                  : ''
              }`}
              onClick={() => setFolderStack([])}
            >
              Files
            </button>

            {folderStack.map((folder, index) => (
              <span
                className="files-breadcrumb-part"
                key={folder._id}
              >
                <span>/</span>
                <button
                  type="button"
                  className={`files-breadcrumb-item ${
                    index === folderStack.length - 1
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    handleBreadcrumbClick(index)
                  }
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>

          <div className="files-actions">
            <button
              type="button"
              className="files-action-button"
              onClick={handleCreateFolder}
            >
              + New folder
            </button>
            <button
              type="button"
              className="files-upload-button"
              onClick={openUploadDialog}
              disabled={uploading}
            >
              {uploading
                ? 'Uploading...'
                : '+ Upload files'}
            </button>
            <input
              ref={fileInputRef}
              className="files-input"
              type="file"
              multiple
              onChange={handleFileSelection}
            />
          </div>
        </div>

        {uploading && uploadingFileName && (
          <div className="files-status">
            Uploading {uploadingFileName}…
          </div>
        )}

        {(error || actionError) && (
          <div className="files-error">
            {actionError || error}
          </div>
        )}

        {dragActive && (
          <div className="files-drop-overlay">
            <strong>Drop files here</strong>
            <span>Upload them to this folder</span>
          </div>
        )}

        <div className="files-content">
          {loading ? (
            <div className="files-state">
              Loading files...
            </div>
          ) : folders.length === 0 &&
            files.length === 0 ? (
            <div className="files-empty">
              <div className="files-empty-icon">
                +
              </div>
              <h2>This folder is empty</h2>
              <p>
                Create a folder or upload files to
                start organizing your workspace.
              </p>
            </div>
          ) : (
            <div className="files-list">
              {folders.map((folder) => (
                <div
                  className={`files-row ${
                    dragOverFolderId === folder._id
                      ? 'files-folder-drag-active'
                      : ''
                  }`}
                  key={folder._id}
                  onDragOver={(event) =>
                    handleFolderDragOver(event, folder._id)
                  }
                  onDragLeave={(event) =>
                    handleFolderDragLeave(event, folder._id)
                  }
                  onDrop={(event) =>
                    handleFolderDrop(event, folder)
                  }
                >
                  <button
                    type="button"
                    className="files-row-main"
                    onDoubleClick={() =>
                      openFolder(folder)
                    }
                    onClick={() =>
                      openFolder(folder)
                    }
                  >
                    <span className="files-item-icon files-folder-icon">
                      □
                    </span>
                    <span className="files-item-info">
                      <strong>{folder.name}</strong>
                      <span>Folder</span>
                    </span>
                  </button>

                  <div className="files-row-actions">
                    <button
                      type="button"
                      onClick={() =>
                        handleRenameFolder(folder)
                      }
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteFolder(folder)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {files.map((file) => (
                <div
                  className="files-row"
                  key={file._id}
                  draggable
                  onDragStart={(event) =>
                    handleFileDragStart(event, file)
                  }
                  onDragEnd={handleFileDragEnd}
                >
                  <button
                    type="button"
                    className="files-row-main"
                    onDoubleClick={() =>
                      openFile(file)
                    }
                    onClick={() => openFile(file)}
                  >
                    <span className="files-item-icon files-file-icon">
                      {getFileExtension(file.name)}
                    </span>
                    <span className="files-item-info">
                      <strong>{file.name}</strong>
                      <span>
                        {formatFileSize(file.size)}
                      </span>
                    </span>
                  </button>

                  <div className="files-row-actions">
                    <button
                      type="button"
                      onClick={() =>
                        handleRenameFile(file)
                      }
                    >
                      Rename
                    </button>
                    {isSvgFile(file) && (
                      <button
                        type="button"
                        onClick={() =>
                          openEditor(file)
                        }
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openMoveDialog(file)
                      }
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadFile(file)
                      }
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteFile(file)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {dialog && (
        <div
          className={`files-modal-backdrop ${
            dialog.type === 'confirm' || dialog.type === 'duplicate'
              ? 'files-delete-dialog-overlay'
              : ''
          }`}
          onClick={() => {
            if (dialog.type === 'confirm') {
              setDialog(null)
            } else if (dialog.type === 'duplicate') {
              handleDuplicateCancel()
            }
          }}
        >
          {dialog.type === 'confirm' ? (
            <div
              className="files-delete-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="files-delete-dialog-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="files-delete-dialog-kicker">
                CONFIRM ACTION
              </span>

              <h3 id="files-delete-dialog-title">{dialog.title}</h3>

              <p>
                {dialog.message}
              </p>

              <DialogError message={dialog.error} />

              <div className="files-delete-dialog-actions">
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>

                <button
                  className="files-delete-dialog-confirm"
                  type="button"
                  onClick={handleDialogSubmit}
                >
                  {dialog.confirmLabel ||
                    (dialog.action === 'delete-folder'
                      ? 'Delete folder'
                      : 'Delete file')}
                </button>
              </div>
            </div>
          ) : dialog.type === 'duplicate' ? (
            <div
              className="files-delete-dialog files-replace-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="files-duplicate-dialog-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="files-delete-dialog-kicker">
                CONFIRM ACTION
              </span>

              <h3 id="files-duplicate-dialog-title">
                File already exists
              </h3>

              <p>
                A file named{' '}
                <strong>{dialog.file.name}</strong> already
                exists in this folder.
              </p>

              <div className="files-delete-dialog-actions">
                <button
                  type="button"
                  onClick={handleDuplicateCancel}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDuplicateKeepBoth}
                >
                  Keep both
                </button>

                <button
                  className="files-delete-dialog-confirm"
                  type="button"
                  onClick={handleDuplicateReplace}
                >
                  Replace
                </button>
              </div>
            </div>
          ) : (
            <div
              className="files-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="files-input-dialog-title"
            >
              <div className="files-modal-header">
                <div>
                  <div className="files-modal-kicker">
                    EDIT
                  </div>
                  <h2 id="files-input-dialog-title">{dialog.title}</h2>
                </div>
                <button
                  type="button"
                  className="files-modal-close"
                  onClick={() => setDialog(null)}
                >
                  ×
                </button>
              </div>

              <form
                className="files-dialog-form"
                onSubmit={handleDialogSubmit}
              >
                <label htmlFor="files-dialog-input">
                  {dialog.label}
                </label>
                <input
                  id="files-dialog-input"
                  className="files-dialog-input"
                  value={dialog.value}
                  onChange={(event) =>
                    setDialog((current) => ({
                      ...current,
                      value: event.target.value,
                      error: '',
                    }))
                  }
                  autoFocus
                />
              </form>

              <DialogError message={dialog.error} />

              <div className="files-dialog-actions">
                <button
                  type="button"
                  className="files-action-button"
                  onClick={() => setDialog(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="files-upload-button"
                  onClick={handleDialogSubmit}
                >
                  {dialog.confirmLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {movingFile && (
        <div className="files-modal-backdrop">
          <div
            className="files-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="files-move-dialog-title"
          >
            <div className="files-modal-header">
              <div>
                <div className="files-modal-kicker">
                  MOVE FILE
                </div>
                <h2 id="files-move-dialog-title">{movingFile.name}</h2>
              </div>
              <button
                type="button"
                className="files-modal-close"
                onClick={() => setMovingFile(null)}
              >
                ×
              </button>
            </div>

            <DialogError message={moveError} />

            <div className="files-move-list">
              <button
                type="button"
                className="files-move-item"
                onClick={() => moveFile(null)}
              >
                <span>□</span>
                <strong>Root</strong>
              </button>

              {loadingFolderTree ? (
                <p>Loading folders...</p>
              ) : moveFolders.length === 0 ? (
                <p>No other folders.</p>
              ) : (
                moveFolders.map((folder) => (
                  <button
                    type="button"
                    className="files-move-item"
                    style={{
                      paddingLeft: `${16 +
                        folder.level * 20}px`,
                    }}
                    key={folder._id}
                    onClick={() =>
                      moveFile(folder._id)
                    }
                  >
                    <span>□</span>
                    <strong>{folder.name}</strong>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {editorFile && (
        <div className="files-modal-backdrop">
          <div
            className="files-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="files-editor-dialog-title"
          >
            <div className="files-modal-header">
              <div>
                <div className="files-modal-kicker">
                  EDIT FILE
                </div>
                <h2 id="files-editor-dialog-title">{editorFile.name}</h2>
              </div>
              <button
                type="button"
                className="files-modal-close"
                onClick={closeEditor}
              >
                ×
              </button>
            </div>

            {editorLoading ? (
              <div className="files-editor-loading">
                Loading file...
              </div>
            ) : (
              <textarea
                className="files-editor"
                value={editorContent}
                onChange={(event) =>
                  setEditorContent(event.target.value)
                }
                aria-label="File content"
                spellCheck="false"
              />
            )}

            <DialogError message={editorError} />

            <div className="files-editor-actions">
              <button
                type="button"
                className="files-action-button"
                onClick={closeEditor}
                disabled={editorSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="files-upload-button"
                onClick={saveEditor}
                disabled={
                  editorLoading || editorSaving
                }
              >
                {editorSaving
                  ? 'Saving...'
                  : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <div className="files-modal-backdrop">
          <div
            className="files-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="files-preview-dialog-title"
          >
            <div className="files-modal-header">
              <div>
                <div className="files-modal-kicker">
                  PREVIEW
                </div>
                <h2 id="files-preview-dialog-title">{previewFile.name}</h2>
              </div>
              <button
                type="button"
                className="files-modal-close"
                onClick={closePreview}
              >
                ×
              </button>
            </div>

            <div className="files-preview-content">
              {previewLoading ? (
                <div className="files-state">
                  Loading preview...
                </div>
              ) : isImageFile(previewFile) ? (
                <img
                  src={previewUrl}
                  alt={previewFile.name}
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewFile.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Files
