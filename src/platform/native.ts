import { Capacitor } from '@capacitor/core'

// The one place that asks whether the code runs inside the iOS or Android app.
export const isNative = () => Capacitor.isNativePlatform()
