'use client'

import { useRef, useState } from 'react'
import type { FlyerData } from './FlyerApp'

interface Props {
  data: FlyerData
  downloadable?: boolean
}

export default function FlyerPreview({ data, downloadable = false }: Props) {
  const flyerRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!flyerRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(flyerRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ede8de',
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `flyer-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      {/* Scrollable wrapper so mobile can see the full 380px card */}
      <div style={{ overflowX: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
      {/* The actual flyer */}
      <div
        ref={flyerRef}
        className="flyer-card"
        style={{
          width: 380,
          background: '#ede8de',
          padding: '28px 24px 24px',
          fontFamily: "'Inter', system-ui, sans-serif",
          borderRadius: 4,
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#111',
            textAlign: 'center',
            lineHeight: 1.25,
            marginBottom: 16,
            letterSpacing: '-0.3px',
          }}
        >
          {data.title}
        </h1>

        {/* Photo */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #d8d2c6',
            borderRadius: 6,
            overflow: 'hidden',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            maxHeight: 260,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageDataUrl}
            alt="Item for sale"
            style={{
              width: '100%',
              height: '100%',
              maxHeight: 260,
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#cdc8be', marginBottom: 14 }} />

        {/* Description */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>🗒️</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111', display: 'block', marginBottom: 2 }}>
              Description:
            </span>
            <span style={{ fontSize: 13, color: '#333', lineHeight: 1.45 }}>{data.description}</span>
          </div>
        </div>

        {/* Price */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>💲</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111', display: 'block', marginBottom: 2 }}>
              Price:
            </span>
            <span style={{ fontSize: 13, color: '#333' }}>${data.price}</span>
          </div>
        </div>

        {/* Pickup Location */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>📍</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111', display: 'block', marginBottom: 2 }}>
              Pickup Location:
            </span>
            <span style={{ fontSize: 13, color: '#333' }}>{data.pickupAddress}</span>
          </div>
        </div>

        {/* Contact */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>✉️</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111', display: 'block', marginBottom: 2 }}>
              Contact:
            </span>
            <span style={{ fontSize: 13, color: '#333' }}>{data.contact}</span>
          </div>
        </div>
      </div>
      </div>

      {/* Download button */}
      {downloadable && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: downloading ? '#d1d5db' : '#16a34a',
            color: '#fff',
            fontWeight: 600,
            padding: '12px 24px',
            borderRadius: 12,
            border: 'none',
            cursor: downloading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            width: '100%',
          }}
        >
          {downloading ? (
            <><span>⏳</span> Generating…</>
          ) : (
            <><span>⬇️</span> Download Flyer (PNG)</>
          )}
        </button>
      )}
    </div>
  )
}
