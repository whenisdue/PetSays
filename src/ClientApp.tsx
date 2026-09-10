import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { PublicHome } from './components/PublicHome'

const EditorApp = lazy(() => import('./App.tsx'))

export function ClientApp() {
  const [initialFile, setInitialFile] = useState<File | null>(null)
  const [editorRequested, setEditorRequested] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    setInitialFile(file)
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
      <EditorApp initialFile={initialFile} />
    </Suspense>
  )
}
