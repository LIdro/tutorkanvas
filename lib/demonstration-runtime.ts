import type { DemonstrationAction, LessonScene, LessonScript, LessonStep } from '@/types'

const MAX_SPEECH_WAIT_MS = 15000

export type DemonstrationRuntimeState =
  | 'idle'
  | 'preparing'
  | 'speaking'
  | 'acting'
  | 'waiting_for_user'
  | 'completed'

export interface DemonstrationRuntimeTools {
  speak?: (text: string) => Promise<void> | void
  onAskCheckQuestion?: (prompt: string) => Promise<void> | void
  onAction?: (action: DemonstrationAction, scene: LessonScene) => Promise<LessonScene | void> | LessonScene | void
  wait?: (ms: number) => Promise<void>
}

export class DemonstrationRuntime {
  private state: DemonstrationRuntimeState = 'idle'
  private scene: LessonScene | null = null

  constructor(private readonly tools: DemonstrationRuntimeTools = {}) {}

  getState() {
    return this.state
  }

  getScene() {
    return this.scene
  }

  setScene(scene: LessonScene) {
    this.scene = scene
    this.state = 'idle'
  }

  async play(script: LessonScript): Promise<LessonScene> {
    this.scene = script.scene
    this.state = 'preparing'

    for (const step of script.steps) {
      await this.playStep(step)
    }

    this.state = 'completed'
    return this.scene
  }

  async playStep(step: LessonStep): Promise<void> {
    if (!this.scene) return

    this.state = 'speaking'
    if (step.speech) {
      try {
        await Promise.race([
          Promise.resolve(this.tools.speak?.(step.speech)),
          defaultWait(MAX_SPEECH_WAIT_MS).then(() => {
            console.warn('[lesson] Speech step timed out, continuing:', step.id)
          }),
        ])
      } catch (error) {
        console.error('[lesson] Speech step failed:', step.id, error)
      }
    }

    this.state = 'acting'
    for (const action of step.actions) {
      if (action.type === 'pause') {
        const wait = this.tools.wait ?? defaultWait
        await wait(action.durationMs)
        continue
      }

      if (action.type === 'ask_check_question') {
        this.state = 'waiting_for_user'
        await this.tools.onAskCheckQuestion?.(action.prompt)
        continue
      }

      const result: LessonScene | void = await this.tools.onAction?.(action, this.scene)
      if (result !== undefined) this.scene = result
    }

    if (step.waitFor === 'user') {
      this.state = 'waiting_for_user'
      return
    }

    this.state = 'idle'
  }
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
