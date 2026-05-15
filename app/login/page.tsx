'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSessionId } from '@/utils/session';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const sessionId = ensureSessionId();
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Add a small delay to ensure cookie is set, then redirect
      setTimeout(() => {
        if (data.user?.role_name === 'Client') {
            router.push('/website');
        } else {
            router.push('/dashboard');
        }
      }, 500);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2FF] flex items-center justify-center p-4 font-sans">
      {/* Main Container */}
      <div className="w-full max-w-[1000px] h-full min-h-[600px] bg-white rounded-[40px] shadow-xl flex flex-col md:flex-row overflow-hidden">
        {/* Left Side - Welcome Section */}
        <div className="w-full md:w-1/2 p-12 flex flex-col items-center justify-center text-center relative overflow-hidden rounded-b-[80px] md:rounded-b-none md:rounded-r-[150px]"
          style={{
            backgroundColor: 'var(--theme-primary)',
          }}>
          <div className="relative z-10 space-y-8 px-6">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Hello, Welcome!
              </h1>
              <h2 className="text-2xl md:text-3xl font-semibold text-white/90">
                Innovexia
              </h2>
            </div>

            <div className="space-y-4">
              <p className="text-xl font-medium text-white/95">
                Advanced ERP System
              </p>
              <p className="text-white/80 text-lg leading-relaxed max-w-sm mx-auto">
                Seamlessly handle your Task Management, FMS, IMS, Help Desk, and Attendance in one place.
              </p>
            </div>
          </div>
          {/* Subtle decoration */}
          <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-100px] right-[-100px] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        {/* Right Side - Login Form Section */}
        <div className="w-full md:w-1/2 p-4 md:p-12 flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <h2 className="text-4xl font-bold text-gray-800 text-center mb-8">Login</h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm animate-shake">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username Input with Floating Label */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[var(--theme-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 pt-6 pb-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] text-gray-800 placeholder-transparent transition-all outline-none peer"
                    placeholder="Username"
                    disabled={loading}
                    required
                  />
                  <label
                    htmlFor="username"
                    className="absolute left-12 top-4 text-gray-400 text-sm transition-all pointer-events-none peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:top-1 peer-focus:text-xs peer-focus:text-[var(--theme-primary)] peer-[&:not(:placeholder-shown)]:top-1 peer-[&:not(:placeholder-shown)]:text-xs"
                  >
                    Username
                  </label>
                </div>
              </div>

              {/* Password Input with Floating Label */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[var(--theme-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 pt-6 pb-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[var(--theme-primary)] text-gray-800 placeholder-transparent transition-all outline-none peer"
                    placeholder="Password"
                    disabled={loading}
                    required
                  />
                  <label
                    htmlFor="password"
                    className="absolute left-12 top-4 text-gray-400 text-sm transition-all pointer-events-none peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:top-1 peer-focus:text-xs peer-focus:text-[var(--theme-primary)] peer-[&:not(:placeholder-shown)]:top-1 peer-[&:not(:placeholder-shown)]:text-xs"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-gray-600 transition-all z-10"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--theme-primary)] hover:opacity-90 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-md transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : 'Login'}
              </button>

              <div className="pt-2">
                <p className="text-center text-gray-400 text-sm mb-4">or login with social platforms</p>
                <div className="flex justify-center gap-3 flex-wrap">
                  {[
                    { id: 'google', path: 'M12.48 10.92v3.28h4.78c-.19 1.06-1.22 3.11-4.78 3.11-3.09 0-5.61-2.56-5.61-5.71s2.52-5.71 5.61-5.71c1.76 0 2.94.75 3.61 1.39l2.58-2.58C16.99 2.15 14.88 1.25 12.48 1.25c-5.91 0-10.75 4.84-10.75 10.75s4.84 10.75 10.75 10.75c6.19 0 10.28-4.35 10.28-10.47 0-.7-.08-1.23-.18-1.76h-10.1z' },
                    { id: 'facebook', path: 'M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.95z' },
                    { id: 'twitter', path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.497h2.039L6.486 3.24H4.298l13.309 17.41z' },
                    { id: 'instagram', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
                    { id: 'github', path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.22 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
                    { id: 'linkedin', path: 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z' },
                    { id: 'apple', path: 'M12.062 3.576A4.326 4.326 0 0013.15 1c-1.359.054-2.998.906-3.971 2.042-.873 1.019-1.642 2.622-1.417 4.195 1.517.117 3.01-.762 3.971-1.761 1.118-1.137 1.118-1.137 1.118-1.137zM17.18 13.911c-.042-3.23 2.645-4.783 2.768-4.86-.022-.036-2.185-3.13-5.266-3.13-2.585 0-3.414 1.583-4.735 1.583-1.341 0-2.39-1.583-4.63-1.583-2.858 0-5.594 2.186-5.594 6.777 0 1.31.258 2.68.766 4.014 1.042 2.732 2.698 4.784 4.305 4.784 1.293 0 1.815-.79 3.374-.79 1.543 0 2.02.79 3.375.79 1.645 0 3.076-1.84 4.11-3.328a11.2 11.2 0 001.51-3.1s-2.932-1.144-2.973-4.151z' }
                  ].map(social => (
                    <button
                      key={social.id}
                      type="button"
                      className="w-10 h-10 flex items-center justify-center border border-gray-100 rounded-xl hover:bg-gray-50 transition-all hover:scale-110 shadow-sm"
                      title={`Login with ${social.id.charAt(0).toUpperCase() + social.id.slice(1)}`}
                    >
                      <svg className="w-5 h-5 fill-[var(--theme-primary)]" viewBox="0 0 24 24">
                        <path d={social.path} />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Credentials */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">Test Credentials</p>
                <div className="flex justify-between text-xs text-gray-500 px-4">
                  <span>Username: <strong className="text-gray-600">admin</strong></span>
                  <span>Password: <strong className="text-gray-600">admin123</strong></span>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
