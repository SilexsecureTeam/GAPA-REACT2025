export type RatingProps = {
  value: number // 0-5, decimals supported in 0.5 steps
  count?: number
  className?: string
  size?: number // px size of star
  color?: string // star color
}

export default function Rating({ value, count, className = '', size = 18, color = '#F2C94C' }: RatingProps) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const starValue = i + 1
    const filled = value >= starValue
    const half = !filled && value >= starValue - 0.5

    return (
      <span key={i} aria-hidden className="inline-flex">
        {/* Star outline */}
        <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? color : 'currentColor'} className={filled ? '' : 'text-gray-300'}>
          <path d="M12 17.3l-6.2 3.4 1.2-6.9-5-4.9 6.9-1 3.1-6.3 3.1 6.3 6.9 1-5 4.9 1.2 6.9z" strokeWidth="1.5" />
        </svg>
        {half && (
          <span className="-ml-[18px] mr-2.5" style={{ width: size / 2, overflow: 'hidden' }}>
            <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
              <path d="M12 17.3l-6.2 3.4 1.2-6.9-5-4.9 6.9-1 3.1-6.3 3.1 6.3 6.9 1-5 4.9 1.2 6.9z" />
            </svg>
          </span>
        )}
      </span>
    )
  })

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="inline-flex items-center gap-0.5">{stars}</span>
      {typeof count === 'number' && (
        <span className="text-[12px] text-gray-500">{count.toLocaleString()}</span>
      )}
    </span>
  )
}
