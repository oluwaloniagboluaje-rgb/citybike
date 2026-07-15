'use client' // Error boundaries must be Client Components
 
import { useEffect } from 'react'
 
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])
 
  return (
    <div className='h-screen flex justify-center items-center flex-col gap-3'>
        <h2 className='text-3xl'>🥲</h2>
      <h2 className='text-3xl font-bold text-red-600'>Something went wrong!</h2>
      <button
      className='px-4 py-2 bg-red-900 rounded-sm text-white'
        onClick={
          // Attempt to recover by re-fetching and re-rendering the segment
          () => unstable_retry()
        }
      >
        Try again
      </button>
    </div>
  )
}