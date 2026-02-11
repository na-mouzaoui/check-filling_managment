// @ts-ignore
const runtimeConfig = typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL
export const API_BASE = runtimeConfig !== undefined ? runtimeConfig : (process.env.NEXT_PUBLIC_API_BASE_URL || "")
