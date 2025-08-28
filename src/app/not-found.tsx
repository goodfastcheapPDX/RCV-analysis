import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container mx-auto p-6 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mb-6">
        Page Not Found
      </h2>
      <p className="text-gray-600 mb-8">
        The election or contest you're looking for doesn't exist or may have
        been moved.
      </p>
      <div className="space-x-4">
        <Link
          href="/e"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          View Elections
        </Link>
        <Link
          href="/"
          className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
