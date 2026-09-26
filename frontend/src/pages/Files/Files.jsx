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
  const [dragActive, setDragActive] = useState(false)
  const [movingFile, setMovingFile] = useState(null)
  const [folderTree, setFolderTree] = useState([])
  const [loadingFolderTree, setLoadingFolderTree] = useState(false)
  const [editorFile, setEditorFile] = useState(null)
  const [editorContent, setEditorContent] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [dialog, setDialog] = useState(null)
  const fileInputRef = useRef(null)

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
      setActionError(
        error.message || 'Failed to delete folder.'
      )
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

  async function uploadFiles(selectedFiles) {
    if (selectedFiles.length === 0) {
      return
    }

    try {
      setUploading(true)
      setActionError('')

      for (const file of selectedFiles) {
        await uploadFile(
          file,
          projectValue === NO_PROJECT
            ? null
            : projectValue,
          currentFolder?._id || null
        )
      }

      await loadCurrentFolder()
    } catch (error) {
      setActionError(
        error.message || 'Failed to upload file.'
      )
    } finally {
      setUploading(false)
    }
  }

  function handleDragOver(event) {
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

  async function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(
      event.dataTransfer.files || []
    )

    await uploadFiles(droppedFiles)
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
      setActionError(
        error.message || 'Failed to delete file.'
      )
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
      await updateFile(movingFile._id, {
        folderId: folderId || null,
      })
      setMovingFile(null)
      await loadCurrentFolder()
    } catch (error) {
      setActionError(
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

    return (
      String(file.mimeType || '')
        .toLowerCase()
        .startsWith('image/') &&
      extension !== 'svg'
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
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'odt',
      'ods',
      'odp',
    ].includes(extension)
  }

  async function openFile(file) {
    if (isEditableFile(file)) {
      try {
        setEditorLoading(true)
        setEditorFile(file)
        setEditorContent('')
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

      return
    }

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
      setActionError(
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
                : 'Upload files'}
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
                  className="files-row"
                  key={folder._id}
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
            dialog.type === 'confirm'
              ? 'files-delete-dialog-overlay'
              : ''
          }`}
          onClick={() => {
            if (dialog.type === 'confirm') {
              setDialog(null)
            }
          }}
        >
          {dialog.type === 'confirm' ? (
            <div
              className="files-delete-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="files-delete-dialog-kicker">
                CONFIRM ACTION
              </span>

              <h3>{dialog.title}</h3>

              <p>
                Are you sure you want to delete{' '}
                <strong>{dialog.targetName}</strong>?
                This action cannot be undone.
              </p>

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
                  {dialog.action === 'delete-folder'
                    ? 'Delete folder'
                    : 'Delete file'}
                </button>
              </div>
            </div>
          ) : (
            <div className="files-confirm-modal">
              <div className="files-modal-header">
                <div>
                  <div className="files-modal-kicker">
                    EDIT
                  </div>
                  <h2>{dialog.title}</h2>
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
                    }))
                  }
                  autoFocus
                />
              </form>

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
          <div className="files-modal">
            <div className="files-modal-header">
              <div>
                <div className="files-modal-kicker">
                  MOVE FILE
                </div>
                <h2>{movingFile.name}</h2>
              </div>
              <button
                type="button"
                className="files-modal-close"
                onClick={() => setMovingFile(null)}
              >
                ×
              </button>
            </div>

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
          <div className="files-editor-modal">
            <div className="files-modal-header">
              <div>
                <div className="files-modal-kicker">
                  EDIT FILE
                </div>
                <h2>{editorFile.name}</h2>
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
                spellCheck="false"
              />
            )}

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
          <div className="files-preview-modal">
            <div className="files-modal-header">
              <div>
                <div className="files-modal-kicker">
                  PREVIEW
                </div>
                <h2>{previewFile.name}</h2>
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
