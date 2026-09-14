// Where these checks find a browser.
//
// The pinned path is the one this project's dev container ships, and using it directly saves a download
// on every run. It does not exist anywhere else, though, and hardcoding it meant `npm run qa` died on the
// first line of a fresh clone. Fall through to Playwright's own resolution when it is absent, so the
// checks run for anyone who has done `npx playwright install chromium`.
import { existsSync } from 'node:fs'

const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

/** Passed straight to chromium.launch(); undefined tells Playwright to use the browser it installed. */
export const executablePath = process.env.PAURK_CHROMIUM || (existsSync(PINNED) ? PINNED : undefined)

/** Software rendering, so the globe's WebGL works on a headless box with no GPU. */
export const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
