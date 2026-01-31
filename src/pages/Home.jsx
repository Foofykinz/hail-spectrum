import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="text-7xl mb-8">🧊</div>
          <h1 className="text-6xl font-bold mb-6">HailSpectrum</h1>
          <p className="text-2xl mb-4 text-blue-100">Free Hail Damage Tracking</p>
          <p className="text-xl mb-10 text-blue-200 max-w-2xl mx-auto">
            Track severe weather events with satellite imagery and accurate residential data - 100% free
          </p>
          <Link to="/map" className="inline-block bg-white text-blue-600 px-10 py-5 rounded-2xl font-bold text-xl hover:bg-blue-50 transition-all shadow-2xl hover:shadow-xl transform hover:scale-105">
            Launch Hail Map →
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">Everything You Need</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <div className="text-5xl mb-4">🗺️</div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">Interactive Maps</h3>
            <p className="text-gray-600">View hail events with satellite imagery and street views</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <div className="text-5xl mb-4">🏠</div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">Residential Data</h3>
            <p className="text-gray-600">Property details and impact estimates from US Census</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">Historical Data</h3>
            <p className="text-gray-600">Complete records from 2012 to present</p>
          </div>
        </div>
      </div>
    </div>
  );
}