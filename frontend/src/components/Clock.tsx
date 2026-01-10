import { useEffect, useState } from 'react'

export function Clock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const hour24 = time.getHours()
  const hour12 = hour24 % 12 || 12
  const hours = hour12.toString().padStart(2, '0')
  const minutes = time.getMinutes().toString().padStart(2, '0')
  const seconds = time.getSeconds().toString().padStart(2, '0')

  const dayOfWeek = time.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const dayOfMonth = time.getDate().toString()
  const month = time.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
  const year = time.getFullYear().toString()

  const currentHour = time.getHours()
  const isDaytime = currentHour >= 6 && currentHour < 18
  const bgColor = isDaytime ? 'bg-white' : 'bg-gray-800'

  return (
    <div className={`flex h-screen items-center justify-center ${bgColor}`}>
      <div className="text-center">
        {/* Year */}
        <div className="-mb-4 text-2xl font-light tracking-widest text-pink-300">{year}</div>

        {/* Time Cards - Tilted and Overlapping */}
        <div className="relative flex items-center justify-center" style={{ height: '280px' }}>
          {/* Hours Card - Left, tilted left */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              transform: 'rotate(6deg)',
              left: '-220px',
              top: '10px',
              zIndex: 1,
            }}
          >
            <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-blue-500 shadow-2xl">
              <span className="text-8xl font-light text-white">{hours}</span>
            </div>
            <div className="mt-4 text-xl font-semibold tracking-wider text-blue-500">
              {dayOfWeek}
            </div>
          </div>

          {/* Minutes Card - Center, no tilt, highest z-index */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              transform: 'rotate(0deg)',
              zIndex: 3,
            }}
          >
            <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-red-500 shadow-2xl">
              <span className="text-8xl font-light text-white">{minutes}</span>
            </div>
            <div className="mt-4 text-2xl font-semibold text-red-500">{dayOfMonth}</div>
          </div>

          {/* Seconds Card - Right, tilted right */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              transform: 'rotate(-6deg)',
              right: '-220px',
              top: '10px',
              zIndex: 2,
            }}
          >
            <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-yellow-400 shadow-2xl">
              <span className="text-8xl font-light text-white">{seconds}</span>
            </div>
            <div className="mt-4 text-xl font-semibold tracking-wider text-yellow-500">{month}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
