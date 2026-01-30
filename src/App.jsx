import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HailMap from './pages/HailMap';
import Home from './pages/Home';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="text-4xl">🧊</div>
              <div>
                <h1 className="text-2xl font-bold text-blue-700">HailSpectrum</h1>
                <p className="text-xs text-gray-500">Free Hail Tracking</p>
              </div>
            </Link>
            <nav className="flex gap-6 text-sm font-semibold">
              <Link to="/" className="text-gray-700 hover:text-blue-600">Home</Link>
              <Link to="/map" className="text-gray-700 hover:text-blue-600">Map</Link>
            </nav>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<HailMap />} />
        </Routes>
        <footer className="bg-gray-900 text-white py-8 mt-20">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-sm">© 2026 HailSpectrum • 100% Free Forever</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}