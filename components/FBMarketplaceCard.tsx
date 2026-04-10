'use client'

import { useState } from 'react'
import type { FBData } from './FlyerApp'

interface Settings {
  pickupAddress: string
  contact: string
}

interface Props {
  data: FBData
  imageDataUrl: string
  settings: Settings
}

export default function FBMarketplaceCard({ data, imageDataUrl, settings }: Props) {
  const fullDescription = `${data.description}\n\n📍 Pickup: ${settings.pickupAddress}\n✉️ ${settings.contact}`
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (field: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Mock FB listing card */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        {/* Image */}
        {imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageDataUrl}
            alt="Item"
            className="w-full max-h-80 object-contain bg-gray-50"
          />
        )}
        <div className="p-5 space-y-3">
          {/* Price + Title */}
          <div>
            <div className="text-2xl font-bold text-gray-900">${data.price}</div>
            <div className="text-base font-semibold text-gray-800 mt-0.5">{data.title}</div>
          </div>
          {/* Location chip */}
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>📍</span>
            <span>{settings.pickupAddress}</span>
          </div>
          {/* Description */}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{fullDescription}</p>
        </div>
      </div>

      {/* Copy fields */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h3 className="font-bold text-gray-900 text-sm">📋 Copy for Facebook Marketplace</h3>

        <CopyRow
          label="Title"
          value={data.title}
          copied={copied === 'title'}
          onCopy={() => copy('title', data.title)}
        />
        <CopyRow
          label="Price"
          value={`$${data.price}`}
          copied={copied === 'price'}
          onCopy={() => copy('price', data.price)}
        />
        <CopyRow
          label="Description"
          value={fullDescription}
          multiline
          copied={copied === 'desc'}
          onCopy={() => copy('desc', fullDescription)}
        />

        <button
          onClick={() => copy('all', `Title: ${data.title}\nPrice: $${data.price}\n\n${fullDescription}`)}
          className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 min-h-[44px]"
        >
          {copied === 'all' ? '✅ Copied!' : '📋 Copy Everything'}
        </button>
      </div>
    </div>
  )
}

function CopyRow({
  label,
  value,
  multiline = false,
  copied,
  onCopy,
}: {
  label: string
  value: string
  multiline?: boolean
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <button
          onClick={onCopy}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-1 px-3 py-2 rounded-md hover:bg-blue-50 min-h-[44px]"
        >
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
      </div>
      {multiline ? (
        <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{value}</p>
      ) : (
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      )}
    </div>
  )
}
