'use client'

import { useEffect, useRef } from 'react'

export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div', ...rest }) {
  const ref = useRef(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      element.classList.add('is-in')
      return
    }
    element.classList.add('is-pending')
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.remove('is-pending')
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    observer.observe(element)
    return () => {
      observer.disconnect()
      element.classList.remove('is-pending')
    }
  }, [])

  return (
    <Tag ref={ref} className={`osr-reveal ${className}`} style={{ '--osr-delay': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  )
}
