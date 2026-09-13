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
import { getLocalDateKey } from './data/dailyStories'
import { clearPendingLine, readPendingLine, type PendingLine } from './utils/pendingLine'

const EditorApp = lazy(() => import('./App.tsx'))

type ClientAppProps = {
  dailyStoryDateKey?: string
}

export function ClientApp({ dailyStoryDateKey }: ClientAppProps) {
  const [resolvedDailyStoryDateKey, setResolvedDailyStoryDateKey] = useState(dailyStoryDateKey)
  const [initialFile, setInitialFile] = useState<File | null>(null)
  const [submittedPendingLine, setSubmittedPendingLine] = useState<PendingLine | null>(null)
  const [editorRequested, setEditorRequested] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingLineRef = useRef<PendingLine | null>(null)

  useEffect(() => {
    pendingLineRef.current = readPendingLine()
  }, [])

  useEffect(() => {
    let midnightTimer: number | undefined

    const syncDate = () => {
      setResolvedDailyStoryDateKey(getLocalDateKey())
      const now = new Date()
      const nextLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      midnightTimer = window.setTimeout(syncDate, Math.max(1000, nextLocalDay.getTime() - now.getTime() + 50))
    }

    syncDate()
    return () => {
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer)
    }
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
      dailyStoryDateKey={resolvedDailyStoryDateKey}
    />
  )

  if (!editorRequested) return publicHome

  return (
    <Suspense fallback={publicHome}>
      <EditorApp initialFile={initialFile} pendingLine={submittedPendingLine} />
    </Suspense>
  )
}
