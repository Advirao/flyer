'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import FlyerPreview from './FlyerPreview'
import FBMarketplaceCard from './FBMarketplaceCard'

type Provider = 'openrouter' | 'claude' | 'openai' | 'gemini'

interface Settings {
  pickupAddress: string
  contact: string
  provider?: Provider
  userApiKey?: string
}

export interface FlyerData {
  imageDataUrl: string
  title: string
  description: string
  price: string
  pickupAddress: string
  contact: string
}

export interface FBData {
  title: string
  price: string
  description: string
}

type Step = 'upload' | 'details' | 'preview'
type PreviewTab = 'flyer' | 'fb'

export default function FlyerApp() {
  const { data: session } = useSession()
  const [step, setStep] = useState<Step>('upload')
  const [settings, setSettings] = useState<Settings>({ pickupAddress: '', contact: '' })
  const [settingsDraft, setSettingsDraft] = useState<Settings>({ pickupAddress: '', contact: '' })
  const [showSettings, setShowSettings] = useState(false)

  const [imageDataUrl, setImageDataUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  // Flyer fields
  const [flyerTitle, setFlyerTitle] = useState('')
  const [flyerDescription, setFlyerDescription] = useState('')
  const [price, setPrice] = useState('')

  // FB Marketplace fields
  const [fbTitle, setFbTitle] = useState('')
  const [fbPrice, setFbPrice] = useState('')
  const [fbDescription, setFbDescription] = useState('')

  const [previewTab, setPreviewTab] = useState<PreviewTab>('flyer')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flyerSettings')
      if (saved) {
        const parsed = JSON.parse(saved) as Settings
        setSettings(parsed)
        setSettingsDraft(parsed)
        if (!parsed.pickupAddress || !parsed.contact) setShowSettings(true)
      } else {
        setShowSettings(true)
      }
    } catch {
      localStorage.removeItem('flyerSettings')
      setShowSettings(true)
    }
  }, [])

  const saveSettings = () => {
    if (!settingsDraft.pickupAddress.trim() || !settingsDraft.contact.trim()) return
    localStorage.setItem('flyerSettings', JSON.stringify(settingsDraft))
    setSettings(settingsDraft)
    setShowSettings(false)
  }

  const handleImageSelect = useCallback(async (file: File) => {
    setAnalyzeError('')

    // HEIC/HEIF files from iPhone have no MIME type in browsers — reject early with a clear message
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!file.type && (ext === 'heic' || ext === 'heif')) {
      setAnalyzeError('HEIC photos from iPhone aren\'t supported by web browsers. In your Photos app tap Share → "Export as JPEG", then upload the JPEG.')
      setStep('details')
      return
    }

    setStep('details')
    setFlyerTitle('')
    setFlyerDescription('')
    setFbTitle('')
    setFbPrice('')
    setFbDescription('')
    setPrice('')

    // Preview
    const reader = new FileReader()
    reader.onload = (e) => setImageDataUrl(e.target?.result as string)
    reader.readAsDataURL(file)

    // Base64 for API
    const base64 = await new Promise<string>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve((r.result as string).split(',')[1])
      r.readAsDataURL(file)
    })
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType, userApiKey: settings.userApiKey, provider: settings.provider ?? 'openrouter' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setFlyerTitle(data.flyer?.title ?? '')
      setFlyerDescription(data.flyer?.description ?? '')
      setFbTitle(data.fb?.title ?? '')
      setFbPrice(data.fb?.price ?? '')
      setFbDescription(data.fb?.description ?? '')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze image'
      setAnalyzeError(msg)
    } finally {
      setAnalyzing(false)
    }
  }, [settings.userApiKey])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) handleImageSelect(file)
    },
    [handleImageSelect]
  )

  const canPreview =
    imageDataUrl &&
    flyerTitle?.trim() &&
    flyerDescription?.trim() &&
    price?.trim() &&
    fbTitle?.trim() &&
    fbDescription?.trim() &&
    settings.pickupAddress &&
    settings.contact

  const flyerData: FlyerData = {
    imageDataUrl,
    title: flyerTitle,
    description: flyerDescription,
    price,
    pickupAddress: settings.pickupAddress,
    contact: settings.contact,
  }

  const fbData: FBData = {
    title: fbTitle,
    price: fbPrice || price,
    description: fbDescription,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl hidden sm:inline">🏷️</span>
          <span className="font-bold text-gray-900 text-base sm:text-lg">Flyer Generator</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSettingsDraft(settings); setShowSettings(true) }}
            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <span>⚙️</span><span className="hidden sm:inline">Settings</span>
          </button>
          {session?.user ? (
            <>
              <span className="hidden sm:block text-xs text-gray-400 max-w-[140px] truncate">
                {session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
                title="Sign out"
              >
                <span>→</span><span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {settings.pickupAddress ? 'Update Settings' : 'Welcome! Quick setup'}
                </h2>
                {!settings.pickupAddress && (
                  <p className="text-sm text-gray-500 mt-0.5">Enter your pickup address and contact once — saved locally.</p>
                )}
              </div>
              {settings.pickupAddress && (
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none">×</button>
              )}
            </div>
            <SetupForm draft={settingsDraft} onChange={setSettingsDraft} onSave={saveSettings} label={settings.pickupAddress ? 'Save' : 'Get Started'} />
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Upload + Details step */}
        {(step === 'upload' || step === 'details') && (
          <div className="grid md:grid-cols-5 gap-6">
            {/* Left col: upload + form (2/5) */}
            <div className="md:col-span-2 space-y-4">
              {/* Upload zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center min-h-[160px] flex flex-col items-center justify-center transition-all group overflow-hidden
                  ${analyzing ? 'border-blue-300 cursor-default' : 'border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30'}`}
              >
                {/* Transparent file input covers the entire zone for reliable click-to-browse */}
                {!analyzing && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }}
                  />
                )}

                {/* Spinner overlay while analyzing */}
                {analyzing && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl gap-3">
                    <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm font-semibold text-blue-600">Analyzing image…</p>
                    <p className="text-xs text-gray-400">AI is generating title, description &amp; FB content</p>
                  </div>
                )}

                {imageDataUrl ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageDataUrl} alt="Selected" className="w-full max-h-44 object-contain rounded-xl mx-auto" />
                    {!analyzing && <p className="text-xs text-gray-400 group-hover:text-blue-500">Click to change image</p>}
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <div className="text-4xl">📷</div>
                    <p className="font-semibold text-gray-700">Drop your photo here</p>
                    <p className="text-sm text-gray-400">or click to browse</p>
                  </div>
                )}
              </div>

              {/* Form */}
              {step === 'details' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
                  {analyzeError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      ⚠️ {analyzeError} — please fill fields manually.
                    </div>
                  )}

                  {/* Flyer section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">🏷️</span>
                      <h3 className="font-bold text-gray-900 text-sm">Flyer</h3>
                    </div>
                    <div className="space-y-3">
                      <Field label="Title">
                        {analyzing ? <Skeleton h="h-9" /> : (
                          <input value={flyerTitle} onChange={(e) => setFlyerTitle(e.target.value)}
                            placeholder="For Sale - Item Name"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        )}
                      </Field>
                      <Field label="Description">
                        {analyzing ? <Skeleton h="h-14" /> : (
                          <textarea value={flyerDescription} onChange={(e) => setFlyerDescription(e.target.value)}
                            placeholder="Brief description..." rows={2}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                        )}
                      </Field>
                      <Field label="Price">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                          <input value={price} onChange={(e) => setPrice(e.target.value)}
                            placeholder="10 (negotiable)"
                            className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">👥</span>
                      <h3 className="font-bold text-gray-900 text-sm">FB Marketplace</h3>
                    </div>
                    <div className="space-y-3">
                      <Field label="Title">
                        {analyzing ? <Skeleton h="h-9" /> : (
                          <input value={fbTitle} onChange={(e) => setFbTitle(e.target.value)}
                            placeholder="Marketplace listing title"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        )}
                      </Field>
                      <Field label="Suggested Price">
                        {analyzing ? <Skeleton h="h-9" /> : (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
                            <input value={fbPrice} onChange={(e) => setFbPrice(e.target.value)}
                              placeholder="AI suggested price"
                              className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                        )}
                      </Field>
                      <Field label="Description">
                        {analyzing ? <Skeleton h="h-20" /> : (
                          <textarea value={fbDescription} onChange={(e) => setFbDescription(e.target.value)}
                            placeholder="FB listing description..." rows={4}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                        )}
                      </Field>
                    </div>
                  </div>

                  {/* Saved info */}
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-1.5"><span>📍</span><span>{settings.pickupAddress}</span></div>
                    <div className="flex items-center gap-1.5"><span>✉️</span><span>{settings.contact}</span></div>
                    <button onClick={() => { setSettingsDraft(settings); setShowSettings(true) }} className="text-blue-500 hover:underline">Edit</button>
                  </div>

                  <button
                    onClick={() => { if (canPreview) { setPreviewTab('flyer'); setStep('preview') } }}
                    disabled={!canPreview || analyzing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition text-sm"
                  >
                    {analyzing ? 'Analyzing image…' : 'Preview →'}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile inline preview — shown below the form on small screens */}
            {step === 'details' && canPreview && (
              <div className="md:hidden col-span-full flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Flyer Preview</p>
                <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', width: '380px', marginBottom: '-76px' }}>
                  <FlyerPreview data={flyerData} />
                </div>
              </div>
            )}

            {/* Right: live preview (3/5) — desktop only */}
            <div className="md:col-span-3 hidden md:flex items-start justify-center pt-2">
              {step === 'details' && canPreview ? (
                <FlyerPreview data={flyerData} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center min-h-64 text-gray-300 space-y-3">
                  <div className="text-6xl">🏷️</div>
                  <p className="font-medium text-gray-400">Flyer preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview step */}
        {step === 'preview' && (
          <div className="space-y-4">
            <button onClick={() => setStep('details')} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
              ← Back to edit
            </button>

            {/* Tabs */}
            <div className="flex w-full sm:w-fit gap-1 bg-gray-100 p-1 rounded-xl">
              <TabBtn active={previewTab === 'flyer'} onClick={() => setPreviewTab('flyer')}>
                🏷️ Flyer
              </TabBtn>
              <TabBtn active={previewTab === 'fb'} onClick={() => setPreviewTab('fb')}>
                👥 FB Marketplace
              </TabBtn>
            </div>

            {previewTab === 'flyer' && (
              <div className="flex flex-col items-center gap-4">
                <FlyerPreview data={flyerData} downloadable />
              </div>
            )}

            {previewTab === 'fb' && (
              <FBMarketplaceCard data={fbData} imageDataUrl={imageDataUrl} settings={settings} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// Small helpers

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

function Skeleton({ h }: { h: string }) {
  return <div className={`${h} bg-gray-100 rounded-lg animate-pulse`} />
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 sm:flex-none px-4 py-3 sm:py-1.5 rounded-lg text-sm font-semibold transition ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

const PROVIDER_CONFIG: Record<Provider, { label: string; placeholder: string; hint: string; requiresKey: boolean }> = {
  openrouter: {
    label: 'OpenRouter',
    placeholder: 'sk-or-v1-... (leave blank to use the shared key)',
    hint: 'Free key at openrouter.ai → Keys. Leave blank to use the shared key (slower).',
    requiresKey: false,
  },
  claude: {
    label: 'Claude (Anthropic)',
    placeholder: 'sk-ant-api03-...',
    hint: 'Get a key at console.anthropic.com → API Keys. Fast & accurate.',
    requiresKey: true,
  },
  openai: {
    label: 'OpenAI',
    placeholder: 'sk-...',
    hint: 'Get a key at platform.openai.com → API Keys. Uses gpt-4o-mini.',
    requiresKey: true,
  },
  gemini: {
    label: 'Gemini (Google)',
    placeholder: 'AIza...',
    hint: 'Get a free key at aistudio.google.com → Get API Key. Uses gemini-2.0-flash.',
    requiresKey: true,
  },
}

function SetupForm({
  draft,
  onChange,
  onSave,
  label,
}: {
  draft: Settings
  onChange: (s: Settings) => void
  onSave: () => void
  label: string
}) {
  const [showKey, setShowKey] = useState(false)
  const provider: Provider = draft.provider ?? 'openrouter'
  const cfg = PROVIDER_CONFIG[provider]
  const valid = draft.pickupAddress.trim() && draft.contact.trim() &&
    (!cfg.requiresKey || (draft.userApiKey ?? '').trim().length > 0)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pickup / Address</label>
        <input
          value={draft.pickupAddress}
          onChange={(e) => onChange({ ...draft, pickupAddress: e.target.value })}
          placeholder="e.g. 26001 Budde Road, Spring, Texas"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact</label>
        <input
          value={draft.contact}
          onChange={(e) => onChange({ ...draft, contact: e.target.value })}
          placeholder="e.g. DM 346-395-8885 to get the exact pickup place"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* AI Provider */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">AI Provider</label>
          <select
            value={provider}
            onChange={(e) => onChange({ ...draft, provider: e.target.value as Provider, userApiKey: '' })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          >
            {(Object.keys(PROVIDER_CONFIG) as Provider[]).map(p => (
              <option key={p} value={p}>{PROVIDER_CONFIG[p].label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            API Key{!cfg.requiresKey && <span className="normal-case font-normal text-gray-400"> (optional)</span>}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={draft.userApiKey ?? ''}
              onChange={(e) => onChange({ ...draft, userApiKey: e.target.value })}
              placeholder={cfg.placeholder}
              className="w-full border border-gray-200 rounded-lg px-3 pr-16 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => setShowKey(p => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 px-1"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{cfg.hint}</p>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={!valid}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition text-sm"
      >
        {label}
      </button>
    </div>
  )
}
