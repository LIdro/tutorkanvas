// ─────────────────────────────────────────────
// TutorKanvas — Landing Page
// ─────────────────────────────────────────────
import Link from 'next/link'
import AuthActions from '@/components/auth/AuthActions'

export const metadata = {
  title: 'TutorKanvas — AI Maths Tutor for Kids',
  description: 'An open-source, privacy-first AI maths canvas for children. Bring your own API key.',
}

const FEATURES = [
  { emoji: '📸', title: 'Snap & Solve', desc: 'Take a photo of classwork — Max analyses it and explains step by step.' },
  { emoji: '🎤', title: 'Talk to Max', desc: 'Hold the mic and ask any maths question out loud.' },
  { emoji: '🎮', title: 'Play Games', desc: 'Fill-in-the-blank, MCQ, and timed speed rounds make practice fun.' },
  { emoji: '🔒', title: 'Your Keys, Your Data', desc: 'BYOK — keys never leave your browser. No signup required.' },
  { emoji: '🧠', title: 'Adaptive', desc: 'Max remembers what each child finds tricky and adjusts difficulty.' },
  { emoji: '🌐', title: 'Multi-LLM', desc: 'Works with OpenRouter, OpenAI, Anthropic, Google & local Ollama.' },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-3xl">📐</span>
          <span className="font-bold text-purple-700 dark:text-purple-400 text-xl">TutorKanvas</span>
        </div>
        <div className="flex items-center gap-3">
          <AuthActions />
          <a href="https://github.com/LIdro/tutorkanvas" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white/70 dark:bg-gray-800/70">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.11.82-.26.82-.577v-2.234c-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.605-2.665-.3-5.467-1.332-5.467-5.93 0-1.31.468-2.38 1.235-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 013.003-.404c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.233 1.91 1.233 3.22 0 4.61-2.807 5.625-5.48 5.92.43.372.823 1.102.823 2.222v3.293c0 .32.218.694.825.576C20.565 21.796 24 17.297 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-lg font-mono">MIT</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-16 px-6 max-w-3xl mx-auto space-y-6">
        <div className="text-8xl">🤖</div>
        <h1 className="text-5xl font-extrabold text-gray-900 dark:text-gray-50 leading-tight">
          Meet <span className="text-purple-600 dark:text-purple-400">Max</span>,<br />your AI maths tutor
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          An infinite canvas where kids snap their classwork, talk to an AI tutor, and play maths games — all with <strong>your own API key</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/setup"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-4 rounded-2xl text-lg shadow-lg transition-all hover:scale-105">
            Get Started 🚀
          </Link>
          <a href="https://github.com/LIdro/tutorkanvas" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500 text-gray-700 dark:text-gray-200 font-semibold px-8 py-4 rounded-2xl text-lg transition-all hover:scale-105">
            View Source
          </a>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">No signup. No subscription. Keys stay in your browser.</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow border border-transparent dark:border-gray-700/50">
              <div className="text-4xl mb-3">{f.emoji}</div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-1">{f.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white dark:bg-gray-900 py-16 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto text-center space-y-10">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '1', icon: '🔑', title: 'Add your key', desc: 'Paste a free OpenRouter key. It lives in your browser, nowhere else.' },
              { step: '2', icon: '📐', title: 'Open the canvas', desc: 'Infinite whiteboard with drawing tools, ready for any problem.' },
              { step: '3', icon: '💬', title: 'Ask Max anything', desc: 'Type, speak, or snap a photo. Max explains and adapts to each child.' },
            ].map((s) => (
              <div key={s.step} className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-bold text-lg flex items-center justify-center mx-auto">{s.step}</div>
                <div className="text-3xl">{s.icon}</div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-100">{s.title}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
          <Link href="/setup"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-4 rounded-2xl text-lg shadow-lg transition-all hover:scale-105">
            Try TutorKanvas →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-400 dark:text-gray-600 text-sm space-y-1">
        <p>TutorKanvas is open source under the MIT licence.</p>
        <p>
          <a href="https://github.com/LIdro/tutorkanvas" className="text-purple-400 hover:underline">github.com/LIdro/tutorkanvas</a>
        </p>
      </footer>
    </main>
  )
}
