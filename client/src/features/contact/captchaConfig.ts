export const captchaSiteKey = (import.meta.env.VITE_CAPTCHA_SITE_KEY ?? '').trim()
export const captchaAction = (import.meta.env.VITE_CAPTCHA_ACTION ?? 'volunteer_signup').trim() || 'volunteer_signup'
export const isCaptchaEnabled = captchaSiteKey.length > 0
