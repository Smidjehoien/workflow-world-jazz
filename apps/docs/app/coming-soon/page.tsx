export default function ComingSoon() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 z-50 fixed inset-0">
      <div className="text-center space-y-8 max-w-lg mx-auto px-6">
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-black rounded-lg flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 76 65"
              fill="none"
              className="text-white"
              aria-label="Vercel logo"
            >
              <path d="M37.59.25l36.95 64H.64l36.95-64z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Coming Soon</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            We're working hard to bring you something amazing. Check back soon
            for updates on Workflows SDK.
          </p>
        </div>

        <div className="pt-4">
          <p className="text-sm text-gray-500">
            Powered by{' '}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-700 hover:text-black transition-colors"
            >
              Vercel
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
