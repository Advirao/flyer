import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Flyer Generator — AI-Powered For-Sale Flyers',
}

const features = [
  {
    icon: '📷',
    title: 'Upload any photo',
    desc: 'Drag and drop or tap to upload a photo of the item you want to sell. Any format works.',
  },
  {
    icon: '🤖',
    title: 'AI writes the copy',
    desc: 'Our AI analyzes your photo and instantly writes a compelling title, description, and Facebook Marketplace listing.',
  },
  {
    icon: '🏷️',
    title: 'Download your flyer',
    desc: 'Get a polished, print-ready PNG flyer plus ready-to-paste Facebook Marketplace copy — in seconds.',
  },
]

const steps = [
  { n: '1', label: 'Upload a photo', desc: 'Take a picture of your item and upload it — no account needed.' },
  { n: '2', label: 'AI writes the copy', desc: 'Our AI instantly generates a title, description, and FB Marketplace listing.' },
  { n: '3', label: 'Download & share', desc: 'Get your flyer and FB Marketplace copy instantly.' },
]

export default function LandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Flyer Generator',
    description:
      'AI-powered for-sale flyer generator. Upload a photo, get a print-ready flyer and Facebook Marketplace copy in seconds.',
    url: 'https://flyergenerator.vercel.app',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'AI-generated flyer titles and descriptions',
      'Facebook Marketplace copy generation',
      'PNG flyer download',
      'No design skills required',
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-gray-900 text-lg">
              <span className="text-2xl">🏷️</span>
              <span>Flyer Generator</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition shadow-sm"
              >
                Get started free
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="bg-gradient-to-b from-blue-50 via-indigo-50 to-white py-24 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
              No design skills or sign up needed
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              Turn any photo into a{' '}
              <span className="text-blue-600">for-sale flyer</span>{' '}
              in seconds
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload a photo of your item. Our AI instantly writes the title, description, and
              Facebook Marketplace listing. Download a print-ready PNG flyer in seconds.
            </p>
            <div className="flex justify-center">
              <Link
                href="/auth/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                Try It — Create an Account →
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
              Everything you need to sell faster
            </h2>
            <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
              Stop spending hours writing listings. Let AI do the work while you focus on what matters.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all"
                >
                  <div className="text-4xl mb-4">{f.icon}</div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4 bg-gradient-to-b from-white to-blue-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              How it works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {steps.map((s) => (
                <div key={s.n} className="text-center">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg">
                    {s.n}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{s.label}</h3>
                  <p className="text-gray-500 text-sm">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-blue-600 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Ready to sell smarter?
            </h2>
            <p className="text-blue-100 mb-8 text-lg">
              Join thousands of people who use Flyer Generator to sell items faster on Facebook Marketplace and beyond.
            </p>
            <div className="flex justify-center">
              <Link
                href="/auth/signup"
                className="inline-block bg-white text-blue-600 font-bold text-lg px-10 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                Try It — Create an Account →
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-10 px-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <span className="text-xl">🏷️</span>
              <span>Flyer Generator</span>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} Flyer Generator. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm">
              <Link href="/auth/signin" className="hover:text-white transition">Sign in</Link>
              <Link href="/auth/signup" className="hover:text-white transition">Sign up</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
