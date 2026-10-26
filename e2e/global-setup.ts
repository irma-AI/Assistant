import { startMailServer } from './mail'

// Runs once before the app starts; the returned function stops the mail server.
export default () => startMailServer()
