import AirCanvas from './components/AirCanvas.jsx';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold">Air Canvas</h1>
          <p className="mt-3 text-sm sm:text-base opacity-70 max-w-xl mx-auto">
            Draw in the air with your index finger. Raise two fingers to move
            without drawing. Everything runs in your browser &mdash; video
            never leaves your device.
          </p>
        </header>

        <AirCanvas />

        <footer className="text-center text-xs font-mono opacity-50 mt-12 pb-4">
          Built with MediaPipe hand landmarks &middot; 21 keypoints tracked
          per hand, all on-device
        </footer>
      </div>
    </div>
  );
}

export default App;
