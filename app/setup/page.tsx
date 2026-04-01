// ─────────────────────────────────────────────
// TutorKanvas — /setup page
// ─────────────────────────────────────────────
import SetupWizard from '@/components/settings/SetupWizard'

export const metadata = {
  title: 'Set Up TutorKanvas',
  description: 'Configure your AI tutor in a few quick steps.',
}

export default function SetupPage() {
  return <SetupWizard />
}
