import { useEffect } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useCommunityStore } from '../communityStore'
import { Dropdown } from './ui'

export function ThemeToggle() {
  const theme = useCommunityStore((s) => s.theme),
    setTheme = useCommunityStore((s) => s.setTheme)
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#151515' : '#f4f4f1')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  const Icon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun
  return (
    <Dropdown
      ariaLabel="Choose appearance"
      className="theme-toggle icon-button"
      align="right"
      width={180}
      label={<Icon size={18} />}
    >
      {(close) => (
        <>
          <span className="menu-eyebrow">APPEARANCE</span>
          {(['light', 'dark', 'system'] as const).map((value) => {
            const Option = value === 'light' ? Sun : value === 'dark' ? Moon : Monitor
            return (
              <button
                key={value}
                className="menu-item"
                aria-pressed={theme === value}
                onClick={() => {
                  setTheme(value)
                  close()
                }}
              >
                <Option size={15} />
                {value === 'system'
                  ? 'Use device setting'
                  : `${value[0].toUpperCase()}${value.slice(1)} theme`}
                {theme === value && <span>✓</span>}
              </button>
            )
          })}
        </>
      )}
    </Dropdown>
  )
}
