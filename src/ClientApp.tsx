import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { PublicHome } from './components/PublicHome'
import { clearPendingLine, readPendingLine, type PendingLine } from './utils/pendingLine'

const EditorApp = lazy(() => import('./App.tsx'))

export function ClientApp() {
  const [initialFile, setInitialFile] = useState<File | null>(null)
  const [submittedPendingLine, setSubmittedPendingLine] = useState<PendingLine | null>(null)
  const [editorRequested, setEditorRequested] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingLineRef = useRef<PendingLine | null>(null)

  useEffect(() => {
    pendingLineRef.current = readPendingLine()
  }, [])

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    setInitialFile(file)
    setSubmittedPendingLine(pendingLineRef.current)
    clearPendingLine()
    setEditorRequested(true)
  }, [])

  const publicHome = (
    <PublicHome
      fileInputRef={fileInputRef}
      onFileChange={handleFileChange}
      onUpload={handleUpload}
    />
  )

  if (!editorRequested) return publicHome

  return (
    <Suspense fallback={publicHome}>
      <EditorApp initialFile={initialFile} pendingLine={submittedPendingLine} />
    </Suspense>
  )
}
