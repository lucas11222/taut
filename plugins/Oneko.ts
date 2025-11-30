// Oneko plugin
// Cat follows cursor :3
// Author: @joshuajohncohen using @adryd325's code

import { TautPlugin } from '../core/Plugin'

const SCRIPT_URL = 'https://raw.githubusercontent.com/adryd325/oneko.js/refs/heads/main/oneko.js'
const SCRIPT_ID = 'oneko-colon3'
  
export default class Oneko extends TautPlugin {
  start(): void {
    let s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = SCRIPT_URL
    s.type = 'text/javascript'
    document.head.appendChild(s)
  }

  stop(): void {
    (document.getElementById(SCRIPT_ID)) ? document.getElementById(SCRIPT_ID).remove()
  }
}
